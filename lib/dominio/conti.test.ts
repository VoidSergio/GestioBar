import { describe, it, expect } from 'vitest';
import {
  chiaveGruppo,
  comeDiminuire,
  raggruppaRighe,
  secondiPerCorreggere,
  totaleConto,
  type RigaMinima,
} from './conti';

const ORA = 1_700_000_000_000;

function riga(
  id: string,
  descrizione: string,
  prezzoUnitarioCent: number,
  quantita: number,
  creatoIl: number,
  extra: Partial<RigaMinima> = {},
): RigaMinima {
  return {
    id,
    prodottoId: `prod-${descrizione}-${prezzoUnitarioCent}`,
    descrizione,
    prezzoUnitarioCent,
    quantita,
    stornoDi: null,
    creatoIl,
    ...extra,
  };
}

describe('raggruppaRighe', () => {
  it('due tap sullo stesso prodotto si leggono come una voce ×2', () => {
    const righe = [
      riga('a', 'Ichnusa 0,33', 170, 1, ORA),
      riga('b', 'Ichnusa 0,33', 170, 1, ORA + 1000),
    ];
    const gruppi = raggruppaRighe(righe);
    expect(gruppi).toHaveLength(1);
    expect(gruppi[0]!.quantita).toBe(2);
    expect(gruppi[0]!.importoCent).toBe(340);
  });

  it('varianti diverse restano voci diverse', () => {
    // Un caffè normale e uno decaffeinato non sono la stessa cosa
    const righe = [
      riga('a', 'Caffè', 120, 1, ORA),
      riga('b', 'Caffè decaffeinato', 130, 1, ORA + 1000),
    ];
    expect(raggruppaRighe(righe)).toHaveLength(2);
  });

  it('lo stesso prodotto a prezzo diverso resta separato', () => {
    // Se il listino è cambiato a metà conto, il prezzo congelato è diverso
    // e le due righe non vanno sommate come se fossero uguali (DEC-05)
    const righe = [
      { ...riga('a', 'Caffè', 120, 1, ORA), prodottoId: 'p1' },
      { ...riga('b', 'Caffè', 130, 1, ORA + 1000), prodottoId: 'p1' },
    ];
    expect(raggruppaRighe(righe)).toHaveLength(2);
  });

  it('lo storno abbassa la quantità invece di comparire come voce a sé', () => {
    const righe = [
      riga('a', 'Ichnusa 0,33', 170, 1, ORA),
      riga('b', 'Ichnusa 0,33', 170, 1, ORA + 1000),
      riga('s', 'Ichnusa 0,33', 170, -1, ORA + 90_000, { stornoDi: 'b' }),
    ];
    const gruppi = raggruppaRighe(righe);
    expect(gruppi).toHaveLength(1);
    expect(gruppi[0]!.quantita).toBe(1);
    expect(gruppi[0]!.importoCent).toBe(170);
  });

  it('un gruppo che arriva a zero sparisce: "Ichnusa ×0" non serve a nessuno', () => {
    const righe = [
      riga('a', 'Ichnusa 0,33', 170, 1, ORA),
      riga('s', 'Ichnusa 0,33', 170, -1, ORA + 90_000, { stornoDi: 'a' }),
    ];
    expect(raggruppaRighe(righe)).toEqual([]);
  });

  it('mette in cima quello battuto per ultimo', () => {
    const righe = [
      riga('a', 'Caffè', 120, 1, ORA),
      riga('b', 'Spritz', 500, 1, ORA + 5000),
    ];
    expect(raggruppaRighe(righe)[0]!.descrizione).toBe('Spritz');
  });

  it('un conto vuoto dà un elenco vuoto', () => {
    expect(raggruppaRighe([])).toEqual([]);
  });
});

describe('totaleConto', () => {
  it('somma tutto, storni compresi', () => {
    const righe = [
      riga('a', 'Caffè', 120, 1, ORA),
      riga('b', 'Caffè', 120, 1, ORA),
      riga('c', 'Spritz', 500, 1, ORA),
      riga('s', 'Spritz', 500, -1, ORA + 90_000, { stornoDi: 'c' }),
    ];
    expect(totaleConto(righe)).toBe(240);
  });

  it('un conto vuoto vale zero', () => {
    expect(totaleConto([])).toBe(0);
  });
});

describe('comeDiminuire', () => {
  const chiave = chiaveGruppo(riga('x', 'Ichnusa 0,33', 170, 1, ORA));

  it('entro 60 secondi cancella: è un errore di battitura', () => {
    const righe = [riga('a', 'Ichnusa 0,33', 170, 1, ORA)];
    expect(comeDiminuire(righe, chiave, ORA + 30_000)).toEqual({
      tipo: 'elimina',
      rigaId: 'a',
    });
  });

  it('dopo 60 secondi storna: è diventata storia', () => {
    const righe = [riga('a', 'Ichnusa 0,33', 170, 1, ORA)];
    expect(comeDiminuire(righe, chiave, ORA + 61_000)).toEqual({
      tipo: 'storna',
      rigaId: 'a',
    });
  });

  it('esattamente a 60 secondi cancella ancora', () => {
    const righe = [riga('a', 'Ichnusa 0,33', 170, 1, ORA)];
    expect(comeDiminuire(righe, chiave, ORA + 60_000)?.tipo).toBe('elimina');
  });

  it('toglie l\'ultima battuta, non la prima', () => {
    // Chi ha sbagliato è l'ultimo tap, ed è anche l'unico ancora nei 60 secondi
    const righe = [
      riga('vecchia', 'Ichnusa 0,33', 170, 1, ORA),
      riga('recente', 'Ichnusa 0,33', 170, 1, ORA + 100_000),
    ];
    expect(comeDiminuire(righe, chiave, ORA + 110_000)).toEqual({
      tipo: 'elimina',
      rigaId: 'recente',
    });
  });

  it('non storna due volte la stessa riga', () => {
    const righe = [
      riga('a', 'Ichnusa 0,33', 170, 1, ORA),
      riga('b', 'Ichnusa 0,33', 170, 1, ORA + 1000),
      riga('s', 'Ichnusa 0,33', 170, -1, ORA + 90_000, { stornoDi: 'b' }),
    ];
    // 'b' è già stornata: tocca ad 'a'
    expect(comeDiminuire(righe, chiave, ORA + 100_000)).toEqual({
      tipo: 'storna',
      rigaId: 'a',
    });
  });

  it('non prova a stornare uno storno', () => {
    const righe = [
      riga('a', 'Ichnusa 0,33', 170, 1, ORA),
      riga('s', 'Ichnusa 0,33', 170, -1, ORA + 90_000, { stornoDi: 'a' }),
    ];
    expect(comeDiminuire(righe, chiave, ORA + 100_000)).toBeNull();
  });

  it('restituisce null se il gruppo non esiste', () => {
    expect(comeDiminuire([], chiave, ORA)).toBeNull();
    expect(comeDiminuire([riga('a', 'Caffè', 120, 1, ORA)], chiave, ORA)).toBeNull();
  });
});

describe('secondiPerCorreggere', () => {
  it('conta alla rovescia', () => {
    const r = riga('a', 'Caffè', 120, 1, ORA);
    expect(secondiPerCorreggere(r, ORA)).toBe(60);
    expect(secondiPerCorreggere(r, ORA + 45_000)).toBe(15);
  });

  it('non va sotto zero', () => {
    const r = riga('a', 'Caffè', 120, 1, ORA);
    expect(secondiPerCorreggere(r, ORA + 200_000)).toBe(0);
  });
});
