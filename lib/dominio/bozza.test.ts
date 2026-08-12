import { describe, it, expect } from 'vitest';
import {
  aggiungi,
  assegnaCliente,
  bozzaAlBanco,
  contiInAttesa,
  unisci,
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

describe('orario della voce', () => {
  it("la voce porta l'orario in cui è stata battuta", () => {
    const b = aggiungi(nuovaBozza('c1', null, 'Banco', ORA), CAFFE, ORA + 5000);
    expect(b.voci[0]!.battutaIl).toBe(ORA + 5000);
  });

  it("il secondo caffè non sposta l'orario del primo", () => {
    let b = aggiungi(nuovaBozza('c1', null, 'Banco', ORA), CAFFE, ORA + 1000);
    b = aggiungi(b, CAFFE, ORA + 90_000);
    expect(b.voci).toHaveLength(1);
    expect(b.voci[0]!.quantita).toBe(2);
    expect(b.voci[0]!.battutaIl).toBe(ORA + 1000);
  });

  it('prodotti diversi hanno orari diversi', () => {
    let b = aggiungi(nuovaBozza('c1', null, 'Banco', ORA), CAFFE, ORA + 1000);
    b = aggiungi(b, ICHNUSA, ORA + 60_000);
    const caffe = b.voci.find((v) => v.prodottoId === 'p-caffe');
    const birra = b.voci.find((v) => v.prodottoId === 'p-ichnusa');
    expect(caffe!.battutaIl).toBe(ORA + 1000);
    expect(birra!.battutaIl).toBe(ORA + 60_000);
  });
});

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

describe('assegnaCliente', () => {
  it('mette il nome su un conto che stava andando al banco', () => {
    const banco = aggiungi(nuovaBozza('c1', null, 'Banco', ORA), CAFFE, ORA);
    const intestato = assegnaCliente(banco, 'cli-1', 'Mario Rossi', ORA + 1000);

    expect(intestato.clienteId).toBe('cli-1');
    expect(intestato.etichetta).toBe('Mario Rossi');
    // Le voci non le tocca: si cambia l'intestazione, non l'ordinazione
    expect(intestato.voci).toEqual(banco.voci);
    expect(totaleBozza(intestato)).toBe(120);
  });

  it('non modifica la bozza di partenza', () => {
    const banco = aggiungi(nuovaBozza('c1', null, 'Banco', ORA), CAFFE, ORA);
    assegnaCliente(banco, 'cli-1', 'Mario', ORA + 1000);
    expect(banco.clienteId).toBeNull();
    expect(banco.etichetta).toBe('Banco');
  });
});

describe('unisci', () => {
  it('somma le voci uguali invece di duplicarle', () => {
    const suo = aggiungi(nuovaBozza('c1', 'cli-1', 'Mario', ORA), CAFFE, ORA);
    const banco = aggiungi(nuovaBozza('c2', null, 'Banco', ORA + 5000), CAFFE, ORA + 5000);

    const unito = unisci(suo, banco, ORA + 6000);

    expect(unito.voci).toHaveLength(1);
    expect(unito.voci[0]!.quantita).toBe(2);
    expect(totaleBozza(unito)).toBe(240);
  });

  it('fra due orari tiene il più vecchio: l ordinazione è cominciata lì', () => {
    const suo = aggiungi(nuovaBozza('c1', 'cli-1', 'Mario', ORA), CAFFE, ORA);
    const banco = aggiungi(nuovaBozza('c2', null, 'Banco', ORA + 5000), CAFFE, ORA + 5000);

    expect(unisci(suo, banco).voci[0]!.battutaIl).toBe(ORA);
    expect(unisci(banco, suo).voci[0]!.battutaIl).toBe(ORA);
  });

  it('le voci diverse restano separate e non si perde niente', () => {
    const suo = aggiungi(nuovaBozza('c1', 'cli-1', 'Mario', ORA), CAFFE, ORA);
    const banco = aggiungi(nuovaBozza('c2', null, 'Banco', ORA), ICHNUSA, ORA);

    const unito = unisci(suo, banco);

    expect(unito.voci).toHaveLength(2);
    expect(totaleBozza(unito)).toBe(120 + 170);
    // resta il conto del cliente: id, intestazione e apertura sono i suoi
    expect(unito.id).toBe('c1');
    expect(unito.clienteId).toBe('cli-1');
  });

  it('unire un conto vuoto non cambia niente', () => {
    const suo = aggiungi(nuovaBozza('c1', 'cli-1', 'Mario', ORA), CAFFE, ORA);
    const vuoto = nuovaBozza('c2', null, 'Banco', ORA);
    expect(unisci(suo, vuoto).voci).toEqual(suo.voci);
  });
});

describe('bozzaAlBanco', () => {
  it('trova il conto senza cliente', () => {
    const banco = nuovaBozza('c1', null, 'Banco', ORA);
    const mario = nuovaBozza('c2', 'cli-1', 'Mario', ORA + 1000);
    expect(bozzaAlBanco([mario, banco])?.id).toBe('c1');
  });

  it('se ce ne sono due vale il più recente: è quello su cui si stava lavorando', () => {
    const vecchio = nuovaBozza('c1', null, 'Banco', ORA);
    const nuovo = nuovaBozza('c2', null, 'Banco', ORA + 1000);
    expect(bozzaAlBanco([vecchio, nuovo])?.id).toBe('c2');
  });

  it('senza conti al banco restituisce null', () => {
    expect(bozzaAlBanco([])).toBeNull();
    expect(bozzaAlBanco([nuovaBozza('c1', 'cli-1', 'Mario', ORA)])).toBeNull();
  });
});

describe('contiInAttesa', () => {
  it('esclude quello in composizione', () => {
    const banco = nuovaBozza('c1', null, 'Banco', ORA);
    const mario = nuovaBozza('c2', 'cli-1', 'Mario', ORA + 1000);
    expect(contiInAttesa([banco, mario], 'c1').map((b) => b.id)).toEqual(['c2']);
  });

  it('un banco vuoto non è un conto aperto', () => {
    const banco = nuovaBozza('c1', null, 'Banco', ORA);
    const altroBanco = nuovaBozza('c2', null, 'Banco', ORA + 1000);
    expect(contiInAttesa([banco, altroBanco], 'c2')).toEqual([]);
  });

  it('un banco con qualcosa dentro invece sì: quei soldi sono sul bancone', () => {
    const banco = nuovaBozza('c1', null, 'Banco', ORA);
    const altroBanco = aggiungi(nuovaBozza('c2', null, 'Banco', ORA + 1000), CAFFE, ORA + 1000);
    expect(contiInAttesa([banco, altroBanco], 'c1').map((b) => b.id)).toEqual(['c2']);
  });

  it('un conto intestato resta anche se è vuoto: qualcuno lo ha aperto apposta', () => {
    const banco = nuovaBozza('c1', null, 'Banco', ORA);
    const mario = nuovaBozza('c2', 'cli-1', 'Mario', ORA + 1000);
    expect(contiInAttesa([banco, mario], 'c1').map((b) => b.id)).toEqual(['c2']);
  });

  it('sono in ordine, dal più recente', () => {
    const banco = nuovaBozza('c0', null, 'Banco', ORA);
    const a = nuovaBozza('c1', 'cli-1', 'Anna', ORA + 1000);
    const b = nuovaBozza('c2', 'cli-2', 'Bruno', ORA + 2000);
    expect(contiInAttesa([a, banco, b], 'c0').map((x) => x.id)).toEqual(['c2', 'c1']);
  });
});
