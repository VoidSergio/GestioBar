import { describe, it, expect } from 'vitest';
import { classificaErroreLettura, ErroreLettura, spiegaErroreLettura } from './errori';

describe('classificaErroreLettura', () => {
  it('offline è sempre un problema di rete, qualunque cosa dica il messaggio', () => {
    expect(classificaErroreLettura(new Error('boh'), true)).toBe('rete');
  });

  it('riconosce la richiesta che non è partita', () => {
    expect(classificaErroreLettura(new Error('Failed to fetch'))).toBe('rete');
    expect(classificaErroreLettura(new Error('NetworkError when attempting…'))).toBe('rete');
    expect(classificaErroreLettura(new Error('Load failed'))).toBe('rete');
  });

  it('riconosce una vista che non esiste: è una migrazione non eseguita', () => {
    // È il caso che mandava a controllare il wifi
    expect(
      classificaErroreLettura(new ErroreLettura('relation "v_scontrini" does not exist', '42P01')),
    ).toBe('struttura_mancante');

    expect(
      classificaErroreLettura(
        new ErroreLettura(
          "Could not find the table 'public.v_scontrini' in the schema cache",
          'PGRST205',
        ),
      ),
    ).toBe('struttura_mancante');
  });

  it('riconosce il permesso negato', () => {
    expect(classificaErroreLettura(new ErroreLettura('permission denied', '42501'))).toBe(
      'permesso',
    );
  });

  it('quello che non sa classificare non lo traveste da problema di rete', () => {
    expect(classificaErroreLettura(new Error('qualcosa di nuovo'))).toBe('sconosciuta');
  });
});

describe('spiegaErroreLettura', () => {
  it('col server irraggiungibile dice di controllare la connessione', () => {
    const s = spiegaErroreLettura(new Error('Failed to fetch'), { cosa: 'Lo storico' });
    expect(s.titolo).toMatch(/connessione/i);
    expect(s.titolo).toMatch(/^Lo storico/);
  });

  it('con la vista mancante NON parla di connessione, e dice cosa fare', () => {
    const s = spiegaErroreLettura(new ErroreLettura('does not exist', '42P01'));
    expect(s.titolo).not.toMatch(/connessione/i);
    expect(s.dettaglio).toMatch(/migrazion/i);
  });

  it('su un errore sconosciuto riporta il messaggio invece di inventarsi una causa', () => {
    const s = spiegaErroreLettura(new Error('column pippo does not…'));
    expect(s.causa).toBe('sconosciuta');
    expect(s.dettaglio).toBe('column pippo does not…');
  });
});
