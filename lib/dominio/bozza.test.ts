import { describe, it, expect } from 'vitest';
import {
  aggiungi,
  diminuisci,
  eVuota,
  nuovaBozza,
  ordinaBozze,
  quantiPezzi,
  togliVoce,
  totaleBozza,
  totaleBozzeAperte,
  type Bozza,
} from './bozza';

const ORA = 1_700_000_000_000;

const CAFFE = {
  idRiga: 'r1',
  prodottoId: 'p-caffe',
  descrizione: 'Caffè',
  prezzoUnitarioCent: 120,
};
const ICHNUSA = {
  idRiga: 'r2',
  prodottoId: 'p-ichnusa',
  descrizione: 'Ichnusa 0,33',
  prezzoUnitarioCent: 170,
};

function conCaffe(volte: number): Bozza {
  let b = nuovaBozza('c1', null, 'Banco', ORA);
  for (let i = 0; i < volte; i += 1) {
    b = aggiungi(b, { ...CAFFE, idRiga: `r${i}` }, ORA + i);
  }
  return b;
}

describe('aggiungi', () => {
  it('due caffè fanno UNA voce ×2, non due righe', () => {
    const b = conCaffe(2);
    expect(b.voci).toHaveLength(1);
    expect(b.voci[0]!.quantita).toBe(2);
    expect(totaleBozza(b)).toBe(240);
  });

  it('prodotti diversi restano voci diverse', () => {
    let b = nuovaBozza('c1', null, 'Banco', ORA);
    b = aggiungi(b, CAFFE, ORA);
    b = aggiungi(b, ICHNUSA, ORA + 1);
    expect(b.voci).toHaveLength(2);
    expect(totaleBozza(b)).toBe(290);
  });

  it('lo stesso prodotto a prezzo diverso non si somma', () => {
    // Se il listino cambia a metà conto, i due prezzi restano distinti
    let b = nuovaBozza('c1', null, 'Banco', ORA);
    b = aggiungi(b, CAFFE, ORA);
    b = aggiungi(b, { ...CAFFE, idRiga: 'r9', prezzoUnitarioCent: 130 }, ORA + 1);
    expect(b.voci).toHaveLength(2);
  });

  it('l\'ultimo battuto va in cima', () => {
    let b = nuovaBozza('c1', null, 'Banco', ORA);
    b = aggiungi(b, CAFFE, ORA);
    b = aggiungi(b, ICHNUSA, ORA + 1);
    expect(b.voci[0]!.descrizione).toBe('Ichnusa 0,33');
  });

  it('non modifica la bozza ricevuta', () => {
    const originale = nuovaBozza('c1', null, 'Banco', ORA);
    aggiungi(originale, CAFFE, ORA);
    expect(originale.voci).toHaveLength(0);
  });
});

describe('diminuisci', () => {
  it('toglie un\'unità e basta: nessuno storno, nessuna traccia', () => {
    const b = conCaffe(2);
    const dopo = diminuisci(b, b.voci[0]!.id, ORA + 10);
    expect(dopo.voci[0]!.quantita).toBe(1);
    expect(dopo.voci).toHaveLength(1);
    expect(totaleBozza(dopo)).toBe(120);
  });

  it('la voce sparisce quando arriva a zero', () => {
    const b = conCaffe(1);
    const dopo = diminuisci(b, b.voci[0]!.id, ORA + 10);
    expect(dopo.voci).toHaveLength(0);
    expect(eVuota(dopo)).toBe(true);
  });

  it('funziona anche dopo mezz\'ora: una bozza non invecchia', () => {
    // È la differenza con il conto registrato: lì dopo 60 secondi si storna
    const b = conCaffe(2);
    const dopo = diminuisci(b, b.voci[0]!.id, ORA + 1_800_000);
    expect(dopo.voci[0]!.quantita).toBe(1);
  });

  it('un id inesistente non rompe niente', () => {
    const b = conCaffe(2);
    expect(diminuisci(b, 'non-esiste', ORA).voci[0]!.quantita).toBe(2);
  });
});

describe('togliVoce', () => {
  it('elimina l\'intera voce anche se la quantità è alta', () => {
    const b = conCaffe(5);
    const dopo = togliVoce(b, b.voci[0]!.id, ORA);
    expect(dopo.voci).toHaveLength(0);
  });
});

describe('totali', () => {
  it('conta i pezzi, non le voci', () => {
    let b = conCaffe(3);
    b = aggiungi(b, ICHNUSA, ORA + 10);
    expect(b.voci).toHaveLength(2);
    expect(quantiPezzi(b)).toBe(4);
  });

  it('una bozza vuota vale zero', () => {
    const b = nuovaBozza('c1', null, 'Banco', ORA);
    expect(totaleBozza(b)).toBe(0);
    expect(quantiPezzi(b)).toBe(0);
    expect(eVuota(b)).toBe(true);
  });

  it('somma tutte le bozze aperte', () => {
    const a = conCaffe(2); // 2,40
    const b = aggiungi(nuovaBozza('c2', 'cli-1', 'Mario', ORA), ICHNUSA, ORA); // 1,70
    expect(totaleBozzeAperte([a, b])).toBe(410);
  });
});

describe('ordinaBozze', () => {
  it('mette in cima l\'ultima aperta', () => {
    const vecchia = nuovaBozza('c1', null, 'Banco', ORA);
    const nuova = nuovaBozza('c2', 'cli-1', 'Mario', ORA + 5000);
    expect(ordinaBozze([vecchia, nuova]).map((b) => b.id)).toEqual(['c2', 'c1']);
  });

  it('non modifica l\'elenco ricevuto', () => {
    const elenco = [nuovaBozza('c1', null, 'Banco', ORA), nuovaBozza('c2', null, 'x', ORA + 1)];
    ordinaBozze(elenco);
    expect(elenco[0]!.id).toBe('c1');
  });
});
