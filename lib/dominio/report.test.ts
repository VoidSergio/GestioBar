import { describe, it, expect } from 'vitest';
import {
  classifica,
  clientiSpariti,
  comeGiorno,
  descriviPunta,
  grigliaOraria,
  intervallo,
  prodottiFermi,
  raggruppaOperatori,
  raggruppaVenduto,
  sommaGiornate,
  spiegaVariazioneCredito,
} from './report';
import type {
  Giornata,
  OperatoreGiornata,
  OraDiPunta,
  RigaClassifica,
  VendutoProdotto,
} from '@/lib/supabase/tipi';

function giornata(g: Partial<Giornata> & { giornata: string }): Giornata {
  return {
    venduto_cent: 0,
    pezzi: 0,
    n_conti: 0,
    incassato_cent: 0,
    contanti_cent: 0,
    carta_cent: 0,
    altro_cent: 0,
    incassato_su_conti_cent: 0,
    credito_rientrato_cent: 0,
    credito_concesso_cent: 0,
    n_scontrini: 0,
    n_senza_scontrino: 0,
    ...g,
  };
}

function inClassifica(r: Partial<RigaClassifica> & { nome: string }): RigaClassifica {
  return {
    cliente_id: r.nome,
    soprannome: null,
    attivo: true,
    consumato_mese_cent: 0,
    consumato_sempre_cent: 0,
    pezzi_sempre: 0,
    pagato_mese_cent: 0,
    pagato_sempre_cent: 0,
    ultima_consumazione_il: null,
    ...r,
  };
}

describe('comeGiorno', () => {
  it('scrive la giornata locale, non quella UTC', () => {
    // All'una di notte del 12 agosto in Italia, toISOString() direbbe l'11:
    // il report della giornata mostrerebbe i numeri di ieri.
    const notte = new Date(2026, 7, 12, 1, 0, 0);
    expect(comeGiorno(notte)).toBe('2026-08-12');
    expect(notte.toISOString().slice(0, 10)).not.toBe('2026-08-12');
  });

  it('mette lo zero davanti a mesi e giorni', () => {
    expect(comeGiorno(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('intervallo', () => {
  // Mercoledì 12 agosto 2026.
  const mercoledi = new Date(2026, 7, 12, 15, 30);

  it('oggi è un giorno solo', () => {
    expect(intervallo('oggi', mercoledi)).toMatchObject({ da: '2026-08-12', a: '2026-08-12' });
  });

  it('ieri è ieri, non "da ieri a oggi"', () => {
    expect(intervallo('ieri', mercoledi)).toMatchObject({ da: '2026-08-11', a: '2026-08-11' });
  });

  it('la settimana comincia lunedì, non sette giorni fa', () => {
    expect(intervallo('settimana', mercoledi)).toMatchObject({ da: '2026-08-10', a: '2026-08-12' });
  });

  it('di lunedì la settimana comincia oggi', () => {
    const lunedi = new Date(2026, 7, 10, 6, 0);
    expect(intervallo('settimana', lunedi)).toMatchObject({ da: '2026-08-10', a: '2026-08-10' });
  });

  it('di domenica comprende tutta la settimana appena finita', () => {
    const domenica = new Date(2026, 7, 16, 22, 0);
    expect(intervallo('settimana', domenica)).toMatchObject({ da: '2026-08-10', a: '2026-08-16' });
  });

  it('il mese parte dal primo', () => {
    expect(intervallo('mese', mercoledi)).toMatchObject({ da: '2026-08-01', a: '2026-08-12' });
  });
});

describe('sommaGiornate', () => {
  const due = [
    giornata({
      giornata: '2026-08-11',
      venduto_cent: 40_000,
      incassato_cent: 25_000,
      contanti_cent: 20_000,
      carta_cent: 5_000,
      incassato_su_conti_cent: 22_000,
      credito_rientrato_cent: 3_000,
      credito_concesso_cent: 18_000,
      pezzi: 200,
      n_conti: 90,
    }),
    giornata({
      giornata: '2026-08-12',
      venduto_cent: 30_000,
      incassato_cent: 31_000,
      contanti_cent: 31_000,
      incassato_su_conti_cent: 26_000,
      credito_rientrato_cent: 5_000,
      credito_concesso_cent: 4_000,
      pezzi: 150,
      n_conti: 70,
    }),
  ];

  it('somma quello che c’è da sommare', () => {
    const t = sommaGiornate(due);
    expect(t.vendutoCent).toBe(70_000);
    expect(t.incassatoCent).toBe(56_000);
    expect(t.contantiCent).toBe(51_000);
    expect(t.cartaCent).toBe(5_000);
    expect(t.pezzi).toBe(350);
    expect(t.nConti).toBe(160);
    expect(t.giorniConMovimenti).toBe(2);
  });

  it('la variazione del credito è concesso meno rientrato', () => {
    expect(sommaGiornate(due).variazioneCreditoCent).toBe(22_000 - 8_000);
  });

  it('venduto meno incassato è la variazione del credito, non un ammanco', () => {
    const t = sommaGiornate(due);
    expect(t.vendutoCent - t.incassatoCent).toBe(t.variazioneCreditoCent);
  });

  it('le due identità delle viste reggono anche sommate', () => {
    const t = sommaGiornate(due);
    expect(t.incassatoCent).toBe(t.incassatoSuContiCent + t.creditoRientratoCent);
    expect(t.vendutoCent).toBe(t.incassatoSuContiCent + t.creditoConcessoCent);
  });

  it('nessuna giornata fa tutti zeri, non NaN', () => {
    const t = sommaGiornate([]);
    expect(t.vendutoCent).toBe(0);
    expect(t.variazioneCreditoCent).toBe(0);
    expect(t.giorniConMovimenti).toBe(0);
  });

  it('non tiene stato fra una chiamata e l’altra', () => {
    sommaGiornate(due);
    expect(sommaGiornate([]).vendutoCent).toBe(0);
  });
});

describe('spiegaVariazioneCredito', () => {
  it('dice cosa è successo al credito, non che manca qualcosa', () => {
    expect(spiegaVariazioneCredito(15_000)).toBe('il credito in giro è cresciuto');
    expect(spiegaVariazioneCredito(-2_000)).toBe('il credito in giro è calato');
    expect(spiegaVariazioneCredito(0)).toBe('il credito in giro non si è mosso');
  });
});

describe('raggruppaVenduto', () => {
  const righe: VendutoProdotto[] = [
    { giornata: '2026-08-11', descrizione: 'Caffè', quantita: 40, importo_cent: 4_800 },
    { giornata: '2026-08-12', descrizione: 'Caffè', quantita: 60, importo_cent: 7_200 },
    { giornata: '2026-08-12', descrizione: 'Cornetto', quantita: 30, importo_cent: 3_600 },
  ];

  it('somma lo stesso prodotto su più giornate', () => {
    const [primo] = raggruppaVenduto(righe);
    expect(primo).toEqual({ descrizione: 'Caffè', quantita: 100, importoCent: 12_000 });
  });

  it('ordina dal più venduto', () => {
    expect(raggruppaVenduto(righe).map((r) => r.descrizione)).toEqual(['Caffè', 'Cornetto']);
  });

  it('quello stornato del tutto non è "uscito zero volte": è fuori', () => {
    const conStorno: VendutoProdotto[] = [
      { giornata: '2026-08-12', descrizione: 'Spritz', quantita: 1, importo_cent: 500 },
      { giornata: '2026-08-12', descrizione: 'Spritz', quantita: -1, importo_cent: -500 },
    ];
    expect(raggruppaVenduto(conStorno)).toEqual([]);
  });

  it('a parità di quantità ordina per nome, così l’elenco non balla', () => {
    const pari: VendutoProdotto[] = [
      { giornata: '2026-08-12', descrizione: 'Zabaione', quantita: 5, importo_cent: 100 },
      { giornata: '2026-08-12', descrizione: 'Amaro', quantita: 5, importo_cent: 100 },
    ];
    expect(raggruppaVenduto(pari).map((r) => r.descrizione)).toEqual(['Amaro', 'Zabaione']);
  });
});

describe('prodottiFermi', () => {
  it('trova quello che sta a catalogo e non è uscito', () => {
    const venduto = raggruppaVenduto([
      { giornata: '2026-08-12', descrizione: 'Caffè', quantita: 10, importo_cent: 1_200 },
    ]);
    expect(prodottiFermi(['Caffè', 'Sambuca', 'Amaro'], venduto)).toEqual(['Amaro', 'Sambuca']);
  });

  it('se è uscito tutto non c’è niente da segnalare', () => {
    const venduto = raggruppaVenduto([
      { giornata: '2026-08-12', descrizione: 'Caffè', quantita: 1, importo_cent: 120 },
    ]);
    expect(prodottiFermi(['Caffè'], venduto)).toEqual([]);
  });
});

describe('classifica', () => {
  const righe = [
    inClassifica({ nome: 'Anna', consumato_mese_cent: 5_000, consumato_sempre_cent: 90_000 }),
    inClassifica({ nome: 'Bruno', consumato_mese_cent: 12_000, consumato_sempre_cent: 20_000 }),
    inClassifica({ nome: 'Carla', consumato_mese_cent: 0, consumato_sempre_cent: 40_000 }),
  ];

  it('ordina per la chiave chiesta, non sempre per la stessa', () => {
    expect(classifica(righe, 'consumato_mese_cent').map((r) => r.nome)).toEqual(['Bruno', 'Anna']);
    expect(classifica(righe, 'consumato_sempre_cent').map((r) => r.nome)).toEqual([
      'Anna',
      'Carla',
      'Bruno',
    ]);
  });

  it('chi è a zero nel periodo è fuori, non ultimo', () => {
    expect(classifica(righe, 'consumato_mese_cent').map((r) => r.nome)).not.toContain('Carla');
  });

  it('taglia alla lunghezza chiesta', () => {
    expect(classifica(righe, 'consumato_sempre_cent', 2)).toHaveLength(2);
  });

  it('non modifica l’elenco di partenza', () => {
    classifica(righe, 'consumato_mese_cent');
    expect(righe.map((r) => r.nome)).toEqual(['Anna', 'Bruno', 'Carla']);
  });
});

describe('clientiSpariti', () => {
  const adesso = new Date(2026, 7, 12, 10, 0);
  const giorniFa = (n: number) => new Date(2026, 7, 12 - n, 10, 0).toISOString();

  it('trova chi non passa da più del limite', () => {
    const righe = [
      inClassifica({ nome: 'Anna', ultima_consumazione_il: giorniFa(30) }),
      inClassifica({ nome: 'Bruno', ultima_consumazione_il: giorniFa(2) }),
    ];
    expect(clientiSpariti(righe, 21, adesso).map((s) => s.cliente.nome)).toEqual(['Anna']);
  });

  it('ordina dal più assente: quello sparito da più tempo è la domanda più grossa', () => {
    const righe = [
      inClassifica({ nome: 'Anna', ultima_consumazione_il: giorniFa(25) }),
      inClassifica({ nome: 'Bruno', ultima_consumazione_il: giorniFa(60) }),
    ];
    expect(clientiSpariti(righe, 21, adesso).map((s) => s.cliente.nome)).toEqual(['Bruno', 'Anna']);
  });

  it('chi non è mai passato non è sparito: non è mai arrivato', () => {
    const righe = [inClassifica({ nome: 'Nuovo', ultima_consumazione_il: null })];
    expect(clientiSpariti(righe, 21, adesso)).toEqual([]);
  });

  it('i clienti disattivati non contano: li hai tolti tu', () => {
    const righe = [
      inClassifica({ nome: 'Vecchio', attivo: false, ultima_consumazione_il: giorniFa(200) }),
    ];
    expect(clientiSpariti(righe, 21, adesso)).toEqual([]);
  });

  it('conta i giorni, non le ore', () => {
    const righe = [inClassifica({ nome: 'Anna', ultima_consumazione_il: giorniFa(21) })];
    expect(clientiSpariti(righe, 21, adesso)[0]?.giorni).toBe(21);
  });
});

describe('grigliaOraria', () => {
  const righe: OraDiPunta[] = [
    { giorno_settimana: 4, ora: 8, pezzi: 120, importo_cent: 14_400, n_conti: 60 },
    { giorno_settimana: 4, ora: 9, pezzi: 40, importo_cent: 4_800, n_conti: 20 },
    { giorno_settimana: 6, ora: 18, pezzi: 90, importo_cent: 30_000, n_conti: 30 },
  ];

  it('trova l’ora di punta', () => {
    expect(grigliaOraria(righe).punta).toMatchObject({ giornoSettimana: 4, ora: 8, pezzi: 120 });
  });

  it('disegna solo le ore in cui si lavora davvero', () => {
    const g = grigliaOraria(righe);
    expect(g.primaOra).toBe(8);
    expect(g.ultimaOra).toBe(18);
  });

  it('il massimo dà la scala al colore', () => {
    expect(grigliaOraria(righe).massimoPezzi).toBe(120);
  });

  it('senza dati non esplode e propone un orario plausibile', () => {
    const g = grigliaOraria([]);
    expect(g.celle).toEqual([]);
    expect(g.punta).toBeNull();
    expect(g.primaOra).toBeLessThan(g.ultimaOra);
  });

  it('le ore a zero non contano come ore lavorate', () => {
    const conZeri: OraDiPunta[] = [
      { giorno_settimana: 1, ora: 3, pezzi: 0, importo_cent: 0, n_conti: 0 },
      ...righe,
    ];
    expect(grigliaOraria(conZeri).primaOra).toBe(8);
  });
});

describe('descriviPunta', () => {
  it('lo dice come lo direbbe una persona', () => {
    expect(descriviPunta({ giornoSettimana: 4, ora: 8, pezzi: 120 })).toBe('giovedì verso le 8');
    expect(descriviPunta({ giornoSettimana: 7, ora: 19, pezzi: 10 })).toBe('domenica verso le 19');
  });

  it('senza punta non inventa una frase', () => {
    expect(descriviPunta(null)).toBeNull();
  });
});

describe('raggruppaOperatori', () => {
  const righe: OperatoreGiornata[] = [
    {
      giornata: '2026-08-11',
      operatore_id: 'u1',
      operatore: 'Marco',
      venduto_cent: 20_000,
      n_conti: 80,
      incassato_cent: 18_000,
    },
    {
      giornata: '2026-08-12',
      operatore_id: 'u1',
      operatore: 'Marco',
      venduto_cent: 10_000,
      n_conti: 40,
      incassato_cent: 9_000,
    },
    {
      giornata: '2026-08-12',
      operatore_id: 'u2',
      operatore: 'Lucia',
      venduto_cent: 35_000,
      n_conti: 120,
      incassato_cent: 30_000,
    },
  ];

  it('somma le giornate di ciascuno', () => {
    const marco = raggruppaOperatori(righe).find((r) => r.nome === 'Marco');
    expect(marco).toMatchObject({ vendutoCent: 30_000, incassatoCent: 27_000, nConti: 120 });
  });

  it('ordina da chi ha battuto di più', () => {
    expect(raggruppaOperatori(righe).map((r) => r.nome)).toEqual(['Lucia', 'Marco']);
  });

  it('tiene i conti accanto all’incasso: l’incasso da solo sembra una pagella', () => {
    for (const r of raggruppaOperatori(righe)) {
      expect(r.nConti).toBeGreaterThan(0);
    }
  });

  it('quello battuto prima che il database firmasse le righe è "senza nome"', () => {
    const orfane: OperatoreGiornata[] = [
      {
        giornata: '2026-08-01',
        operatore_id: null,
        operatore: null,
        venduto_cent: 5_000,
        n_conti: 20,
        incassato_cent: 5_000,
      },
    ];
    expect(raggruppaOperatori(orfane)[0]?.nome).toBe('Senza nome');
  });

  it('chi non ha fatto niente non compare', () => {
    const vuote: OperatoreGiornata[] = [
      {
        giornata: '2026-08-12',
        operatore_id: 'u3',
        operatore: 'Fermo',
        venduto_cent: 0,
        n_conti: 0,
        incassato_cent: 0,
      },
    ];
    expect(raggruppaOperatori(vuote)).toEqual([]);
  });
});
