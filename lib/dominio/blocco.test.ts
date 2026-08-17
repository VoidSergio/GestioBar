import { describe, it, expect } from 'vitest';
import { attesaDopoErrori, CIFRE_PIN, deveBloccare, improntaPin, pinValido } from './blocco';

describe('pinValido', () => {
  it('accetta esattamente quattro cifre', () => {
    expect(pinValido('1234')).toBe(true);
    expect(pinValido('0000')).toBe(true);
    expect(CIFRE_PIN).toBe(4);
  });

  it('rifiuta tutto il resto', () => {
    expect(pinValido('123')).toBe(false);
    expect(pinValido('12345')).toBe(false);
    expect(pinValido('')).toBe(false);
    expect(pinValido('12a4')).toBe(false);
    expect(pinValido('12 4')).toBe(false);
  });
});

describe('improntaPin', () => {
  it('lo stesso PIN dà sempre la stessa impronta', () => {
    expect(improntaPin('1234')).toBe(improntaPin('1234'));
  });

  it('PIN diversi danno impronte diverse', () => {
    const viste = new Set<string>();
    for (let n = 0; n < 10_000; n += 1) {
      viste.add(improntaPin(String(n).padStart(4, '0')));
    }
    // Su diecimila PIN qualche collisione è tollerabile, ma non tante: se
    // fossero tante, due PIN diversi aprirebbero lo stesso telefono.
    expect(viste.size).toBeGreaterThan(9_900);
  });

  it('non contiene il PIN in chiaro: è l’unica cosa che deve garantire', () => {
    expect(improntaPin('1234')).not.toContain('1234');
    expect(improntaPin('0000')).not.toContain('0000');
  });

  it('è un testo corto e stabile, adatto a localStorage', () => {
    expect(improntaPin('1234')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('deveBloccare', () => {
  const adesso = 1_700_000_000_000;

  it('con "subito" copre lo schermo appena si posa il telefono', () => {
    expect(deveBloccare(adesso, 0, adesso)).toBe(true);
  });

  it('prima dell’attesa scelta non blocca', () => {
    expect(deveBloccare(adesso - 60_000, 2, adesso)).toBe(false);
  });

  it('allo scadere blocca', () => {
    expect(deveBloccare(adesso - 120_000, 2, adesso)).toBe(true);
    expect(deveBloccare(adesso - 200_000, 2, adesso)).toBe(true);
  });

  it('un’ora è un’ora', () => {
    expect(deveBloccare(adesso - 59 * 60_000, 60, adesso)).toBe(false);
    expect(deveBloccare(adesso - 60 * 60_000, 60, adesso)).toBe(true);
  });
});

describe('attesaDopoErrori', () => {
  it('i primi errori non costano niente: le mani sono bagnate e c’è fila', () => {
    expect(attesaDopoErrori(0)).toBe(0);
    expect(attesaDopoErrori(1)).toBe(0);
    expect(attesaDopoErrori(2)).toBe(0);
  });

  it('poi si aspetta, ma poco', () => {
    expect(attesaDopoErrori(3)).toBe(5_000);
    expect(attesaDopoErrori(4)).toBe(10_000);
  });

  it('non supera mai il mezzo minuto', () => {
    expect(attesaDopoErrori(50)).toBe(30_000);
    expect(attesaDopoErrori(1_000)).toBe(30_000);
  });
});
