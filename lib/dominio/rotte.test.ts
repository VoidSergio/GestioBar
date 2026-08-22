import { describe, it, expect } from 'vitest';
import { passaDalProxy, rottaPubblica, ROTTE_PUBBLICHE } from './rotte';

describe('rottaPubblica', () => {
  it('il login è pubblico: è la porta', () => {
    expect(rottaPubblica('/login')).toBe(true);
    expect(rottaPubblica('/login?vai=/crediti')).toBe(true);
  });

  it('la pagina "senza rete" è pubblica', () => {
    // Proteggerla con un controllo che interroga il server vorrebbe dire
    // chiedere di autenticarsi proprio quando il server non risponde.
    expect(rottaPubblica('/offline')).toBe(true);
  });

  it('tutto il resto no', () => {
    for (const p of ['/', '/crediti', '/clienti', '/report', '/magazzino', '/persone']) {
      expect(rottaPubblica(p), p).toBe(false);
    }
  });

  it('sono due, e si contano: se qualcuno ne aggiunge una, questo test lo fa notare', () => {
    expect(ROTTE_PUBBLICHE).toEqual(['/login', '/offline']);
  });
});

describe('passaDalProxy', () => {
  it('le schermate passano dal controllo di accesso', () => {
    for (const p of ['/', '/crediti', '/clienti/abc', '/conto/abc', '/report', '/magazzino']) {
      expect(passaDalProxy(p), p).toBe(true);
    }
  });

  it('il service worker no — era il bug del 12 agosto', () => {
    // Passando di qui, da scollegati tornava un rimando a /login: il browser
    // riceveva HTML al posto di JavaScript e non registrava il service worker.
    expect(passaDalProxy('/sw.js')).toBe(false);
  });

  it('la pagina senza rete nemmeno', () => {
    // Il service worker la mette in cache all'installazione: se quella
    // richiesta viene rimandata al login, la cache rifiuta di conservarla e
    // l'installazione fallisce.
    expect(passaDalProxy('/offline')).toBe(false);
  });

  it('i file statici restano fuori: interrogare Supabase per un’icona è lavoro buttato', () => {
    for (const p of [
      '/_next/static/chunk.js',
      '/_next/image',
      '/favicon.ico',
      '/manifest.json',
      '/icone/icona-192.png',
      '/qualcosa.png',
      '/qualcosa.svg',
    ]) {
      expect(passaDalProxy(p), p).toBe(false);
    }
  });

  it('quello che passa dal proxy e non è pubblico è protetto: nessuna terza via', () => {
    const protette = ['/', '/crediti', '/report'];
    for (const p of protette) {
      expect(passaDalProxy(p) && !rottaPubblica(p), p).toBe(true);
    }
  });
});
