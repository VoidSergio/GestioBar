import { describe, it, expect } from 'vitest';
import {
  oraDelMovimento,
  conSaldoProgressivo,
  etichettaGiorno,
  raggruppaPerGiorno,
  anzianitaDebito,
  filtraCrediti,
  messaggioSollecito,
  numeroPerWhatsApp,
  ordinaPerAnzianita,
  scorciatoieChiusura,
  scorciatoieIncasso,
  soloDebitori,
  totaleDaIncassare,
  verificaChiusuraConto,
  verificaIncasso,
} from './crediti';
import type { MovimentoEstrattoConto, SaldoCliente } from '@/lib/supabase/tipi';

function mov(
  data: string,
  importoCent: number,
  tipo: 'consumazione' | 'pagamento' = 'consumazione',
): MovimentoEstrattoConto {
  return {
    cliente_id: 'cli-1',
    data,
    tipo,
    descrizione: tipo === 'pagamento' ? 'Pagamento contanti' : 'Caffè',
    quantita: 1,
    importo_cent: importoCent,
    conto_numero: 1,
    movimento_id: `${data}-${importoCent}`,
    e_storno: false,
    conto_id: 'con-1',
    prezzo_unitario_cent: Math.abs(importoCent),
    quantita_stornata: 0,
  };
}

describe('conSaldoProgressivo', () => {
  it("restituisce dal più recente, e in cima c'è il saldo vero", () => {
    const movimenti = [
      mov('2026-08-01T08:00:00Z', 120),
      mov('2026-08-01T09:00:00Z', 150),
      mov('2026-08-02T08:00:00Z', 170),
    ];
    const r = conSaldoProgressivo(movimenti, 440);

    // Il più recente in cima, con il saldo attuale
    expect(r[0]!.importo_cent).toBe(170);
    expect(r[0]!.saldoProgressivoCent).toBe(440);
    expect(r[1]!.saldoProgressivoCent).toBe(270);
    // Il più vecchio in fondo, con il saldo dopo il primo movimento
    expect(r[2]!.saldoProgressivoCent).toBe(120);
  });

  it('con lo storico paginato i progressivi restano giusti', () => {
    // Il cliente deve 44,00 € ma sono state caricate solo le ultime due
    // righe: sotto ce ne sono altre per 30,00 €. Sommando da zero il totale
    // in cima sarebbe 14,00 €, cioè un numero diverso da quello grande
    // in testa alla schermata.
    const ultimeDue = [mov('2026-08-01T09:00:00Z', 500), mov('2026-08-02T08:00:00Z', 900)];
    const r = conSaldoProgressivo(ultimeDue, 4400);

    expect(r[0]!.saldoProgressivoCent).toBe(4400);
    expect(r[1]!.saldoProgressivoCent).toBe(3500);
  });

  it('i pagamenti abbassano il saldo: arrivano già negativi dalla vista', () => {
    const movimenti = [
      mov('2026-08-01T08:00:00Z', 2450),
      mov('2026-08-02T08:00:00Z', -2000, 'pagamento'),
    ];
    const r = conSaldoProgressivo(movimenti, 450);
    expect(r[0]!.saldoProgressivoCent).toBe(450);
    expect(r[1]!.saldoProgressivoCent).toBe(2450);
  });

  it('un cliente che salda tutto arriva a zero', () => {
    const movimenti = [
      mov('2026-08-01T08:00:00Z', 2450),
      mov('2026-08-02T08:00:00Z', -2450, 'pagamento'),
    ];
    expect(conSaldoProgressivo(movimenti, 0)[0]!.saldoProgressivoCent).toBe(0);
  });

  it("non si affida all'ordine ricevuto", () => {
    // Stessi movimenti, ordine invertito: in cima c'è sempre il più recente
    const movimenti = [mov('2026-08-02T08:00:00Z', 170), mov('2026-08-01T08:00:00Z', 120)];
    const r = conSaldoProgressivo(movimenti, 290);
    expect(r[0]!.importo_cent).toBe(170);
    expect(r[0]!.saldoProgressivoCent).toBe(290);
    expect(r[1]!.saldoProgressivoCent).toBe(120);
  });

  it('un elenco vuoto non rompe niente', () => {
    expect(conSaldoProgressivo([], 0)).toEqual([]);
  });
});

describe('etichettaGiorno', () => {
  const adesso = new Date('2026-08-04T10:00:00');

  it('riconosce oggi e ieri', () => {
    expect(etichettaGiorno(new Date('2026-08-04T08:00:00'), adesso)).toBe('Oggi');
    expect(etichettaGiorno(new Date('2026-08-03T22:00:00'), adesso)).toBe('Ieri');
  });

  it('per il resto scrive la data in italiano', () => {
    const e = etichettaGiorno(new Date('2026-08-01T08:00:00'), adesso);
    expect(e).toMatch(/agosto/);
    expect(e).toMatch(/1/);
  });

  it('funziona a cavallo del mese', () => {
    const primoAgosto = new Date('2026-08-01T10:00:00');
    expect(etichettaGiorno(new Date('2026-07-31T22:00:00'), primoAgosto)).toBe('Ieri');
  });
});

describe('raggruppaPerGiorno', () => {
  it('mette insieme i movimenti dello stesso giorno, dal più recente', () => {
    const adesso = new Date('2026-08-04T12:00:00');
    const movimenti = conSaldoProgressivo(
      [
        mov('2026-08-04T08:00:00', 120),
        mov('2026-08-04T09:00:00', 150),
        mov('2026-08-02T08:00:00', 170),
      ],
      440,
    );

    const giorni = raggruppaPerGiorno(movimenti, adesso);
    expect(giorni).toHaveLength(2);
    expect(giorni[0]!.etichetta).toBe('Oggi');
    expect(giorni[0]!.movimenti).toHaveLength(2);
    expect(giorni[1]!.movimenti).toHaveLength(1);
  });

  it('un elenco vuoto dà zero giorni', () => {
    expect(raggruppaPerGiorno([], new Date())).toEqual([]);
  });
});

describe('scorciatoieIncasso', () => {
  it('offre "salda tutto" e "solo ultimo conto" quando sono diversi', () => {
    const s = scorciatoieIncasso(3290, 840);
    expect(s.map((x) => x.importoCent)).toEqual([840, 3290]);
  });

  it('non ripete la stessa cifra due volte', () => {
    // Se l'unico conto è tutto il debito, un secondo pulsante identico
    // sarebbe solo un'occasione di sbagliare
    const s = scorciatoieIncasso(840, 840);
    expect(s).toHaveLength(1);
    expect(s[0]!.importoCent).toBe(840);
  });

  it('senza debito non offre niente', () => {
    expect(scorciatoieIncasso(0, null)).toEqual([]);
  });
});

describe('verificaIncasso', () => {
  it('un pagamento parziale lascia il residuo a debito', () => {
    const e = verificaIncasso(3290, 2000);
    expect(e.valido).toBe(true);
    if (e.valido) {
      expect(e.importoCent).toBe(2000);
      expect(e.residuoCent).toBe(1290);
      expect(e.restoCent).toBe(0);
    }
  });

  it('saldare tutto azzera il debito', () => {
    const e = verificaIncasso(3290, 3290);
    expect(e.valido).toBe(true);
    if (e.valido) {
      expect(e.residuoCent).toBe(0);
      expect(e.restoCent).toBe(0);
    }
  });

  it('chi paga di più riceve il resto: non diventa un acconto silenzioso', () => {
    // Deve 32,90 e dà 40 €: si registrano 32,90 e si danno 7,10 di resto
    const e = verificaIncasso(3290, 4000);
    expect(e.valido).toBe(true);
    if (e.valido) {
      expect(e.importoCent).toBe(3290);
      expect(e.restoCent).toBe(710);
      expect(e.residuoCent).toBe(0);
    }
  });

  it('rifiuta importi assurdi con un messaggio comprensibile', () => {
    expect(verificaIncasso(3290, 0)).toEqual({
      valido: false,
      errore: 'Inserisci quanto ti ha dato.',
    });
    expect(verificaIncasso(3290, -100).valido).toBe(false);
    expect(verificaIncasso(3290, 12.5).valido).toBe(false);
  });

  it('rifiuta di incassare da chi non deve niente', () => {
    const e = verificaIncasso(0, 1000);
    expect(e.valido).toBe(false);
    if (!e.valido) expect(e.errore).toMatch(/non deve niente/);
  });
});

describe('verificaChiusuraConto', () => {
  const base = {
    totaleContoCent: 840,
    debitoPrecedenteCent: 2450,
    haCliente: true,
  };

  it('somma conto corrente e debito precedente', () => {
    const e = verificaChiusuraConto({ ...base, importoDatoCent: 3290 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.dovutoCent).toBe(3290);
    expect(e.importoCent).toBe(3290);
    expect(e.restoCent).toBe(0);
    expect(e.nuovoSaldoCent).toBe(0);
  });

  it('un pagamento parziale lascia la differenza a saldo', () => {
    // Dà 20 € su 32,90 dovuti
    const e = verificaChiusuraConto({ ...base, importoDatoCent: 2000 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.importoCent).toBe(2000);
    expect(e.nuovoSaldoCent).toBe(1290);
    expect(e.restoCent).toBe(0);
  });

  it('paga solo il conto di adesso e il vecchio debito resta', () => {
    const e = verificaChiusuraConto({ ...base, importoDatoCent: 840 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.nuovoSaldoCent).toBe(2450);
  });

  it('chi dà di più ha un resto, non un acconto', () => {
    const e = verificaChiusuraConto({ ...base, importoDatoCent: 4000 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    // Si registra solo quanto copre il dovuto
    expect(e.importoCent).toBe(3290);
    expect(e.restoCent).toBe(710);
    expect(e.nuovoSaldoCent).toBe(0);
  });

  it('un acconto precedente abbassa il dovuto', () => {
    // Il cliente aveva lasciato 5 € di acconto: saldo negativo
    const e = verificaChiusuraConto({
      totaleContoCent: 840,
      debitoPrecedenteCent: -500,
      importoDatoCent: 340,
      haCliente: true,
    });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.dovutoCent).toBe(340);
    expect(e.nuovoSaldoCent).toBe(0);
  });

  it("al banco non si può lasciare un debito: non c'è a chi addebitarlo", () => {
    const e = verificaChiusuraConto({
      totaleContoCent: 840,
      debitoPrecedenteCent: 0,
      importoDatoCent: 500,
      haCliente: false,
    });
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/banco/i);
  });

  it('al banco pagare di più va bene: è solo resto', () => {
    const e = verificaChiusuraConto({
      totaleContoCent: 840,
      debitoPrecedenteCent: 0,
      importoDatoCent: 1000,
      haCliente: false,
    });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.restoCent).toBe(160);
  });

  it('rifiuta un conto vuoto e un importo a zero', () => {
    expect(
      verificaChiusuraConto({
        ...base,
        totaleContoCent: 0,
        importoDatoCent: 100,
      }).valido,
    ).toBe(false);
    expect(verificaChiusuraConto({ ...base, importoDatoCent: 0 }).valido).toBe(false);
  });
});

describe('scorciatoieChiusura', () => {
  it('con un debito precedente offre entrambe le scelte', () => {
    const s = scorciatoieChiusura(840, 2450);
    expect(s).toHaveLength(2);
    expect(s[0]!.importoCent).toBe(840);
    expect(s[1]!.importoCent).toBe(3290);
  });

  it('senza debito precedente non ripete lo stesso pulsante due volte', () => {
    const s = scorciatoieChiusura(840, 0);
    expect(s).toHaveLength(1);
    expect(s[0]!.importoCent).toBe(840);
  });
});

function deb(
  nome: string,
  saldoCent: number,
  giorniDebito: number | null,
  extra: Partial<SaldoCliente> = {},
): SaldoCliente {
  return {
    id: `id-${nome}`,
    nome,
    soprannome: null,
    telefono: null,
    limite_credito_cent: null,
    attivo: true,
    addebitato_cent: Math.max(saldoCent, 0),
    pagato_cent: 0,
    saldo_cent: saldoCent,
    primo_movimento_il: null,
    ultimo_pagamento_il: null,
    ultimo_movimento_il: null,
    giorni_debito: giorniDebito,
    ...extra,
  };
}

describe('anzianitaDebito', () => {
  it('verde fino a 15 giorni, arancione fino a 45, rosso oltre', () => {
    expect(anzianitaDebito(0)).toBe('verde');
    expect(anzianitaDebito(15)).toBe('verde');
    expect(anzianitaDebito(16)).toBe('arancione');
    expect(anzianitaDebito(45)).toBe('arancione');
    expect(anzianitaDebito(46)).toBe('rosso');
  });

  it('senza data conosciuta non allarma', () => {
    expect(anzianitaDebito(null)).toBe('verde');
  });
});

describe('soloDebitori e totaleDaIncassare', () => {
  const clienti = [deb('Franco', 6800, 47), deb('Anna', 0, null), deb('Luca', -500, null)];

  it('chi è in pari o ha un acconto non è un debitore', () => {
    expect(soloDebitori(clienti).map((c) => c.nome)).toEqual(['Franco']);
  });

  it("l'acconto di uno non abbassa il credito verso un altro", () => {
    // 68,00 e non 63,00: i 5 € di acconto di Luca sono un'altra cosa
    expect(totaleDaIncassare(clienti)).toBe(6800);
  });
});

describe('ordinaPerAnzianita', () => {
  it('il debito più vecchio viene per primo, non il più grande', () => {
    const r = ordinaPerAnzianita([
      deb('Anna', 42_50, 22),
      deb('Franco', 6800, 47),
      deb('Mario', 2450, 5),
    ]);
    expect(r.map((c) => c.nome)).toEqual(['Franco', 'Anna', 'Mario']);
  });

  it('a parità di giorni viene prima chi deve di più', () => {
    const r = ordinaPerAnzianita([deb('Piccolo', 500, 20), deb('Grande', 9000, 20)]);
    expect(r.map((c) => c.nome)).toEqual(['Grande', 'Piccolo']);
  });
});

describe('filtraCrediti', () => {
  const clienti = [
    deb('Vecchio', 1000, 70),
    deb('Medio', 1000, 35),
    deb('Nuovo', 1000, 3),
    deb('Sforato', 9000, 3, { limite_credito_cent: 5000 }),
  ];

  it('i filtri per anzianità tagliano dove dicono', () => {
    expect(filtraCrediti(clienti, 'tutti')).toHaveLength(4);
    expect(filtraCrediti(clienti, 'oltre30').map((c) => c.nome)).toEqual(['Vecchio', 'Medio']);
    expect(filtraCrediti(clienti, 'oltre60').map((c) => c.nome)).toEqual(['Vecchio']);
  });

  it('sopra il limite guarda il limite, non i giorni', () => {
    expect(filtraCrediti(clienti, 'sopra_limite').map((c) => c.nome)).toEqual(['Sforato']);
  });

  it('senza limite impostato non si può sforare', () => {
    expect(filtraCrediti([deb('Senza', 100_000, 1)], 'sopra_limite')).toEqual([]);
  });
});

describe('messaggioSollecito', () => {
  it("usa il soprannome se c'è, altrimenti il nome di battesimo", () => {
    expect(
      messaggioSollecito({
        nome: 'Franco Rossi',
        soprannome: 'Ciccio',
        saldo_cent: 6800,
      }),
    ).toMatch(/^Ciao Ciccio,/);
    expect(
      messaggioSollecito({
        nome: 'Franco Rossi',
        soprannome: null,
        saldo_cent: 6800,
      }),
    ).toMatch(/^Ciao Franco,/);
  });

  it('contiene la cifra e resta gentile', () => {
    const m = messaggioSollecito({
      nome: 'Anna',
      soprannome: null,
      saldo_cent: 6800,
    });
    expect(m.replace(/ /g, ' ')).toContain('68,00 €');
    expect(m).toContain('Grazie');
    // Niente linguaggio da recupero crediti
    expect(m).not.toMatch(/sollecit|scadut|invitiamo|entro il/i);
  });
});

describe('numeroPerWhatsApp', () => {
  it('aggiunge il prefisso italiano a un numero scritto senza', () => {
    expect(numeroPerWhatsApp('347 123 4567')).toBe('393471234567');
  });

  it('rispetta un prefisso internazionale già scritto', () => {
    expect(numeroPerWhatsApp('+33 6 12 34 56 78')).toBe('33612345678');
  });

  it('non raddoppia il 39', () => {
    expect(numeroPerWhatsApp('39 347 1234567')).toBe('393471234567');
  });

  it('su un numero inutilizzabile non inventa niente', () => {
    expect(numeroPerWhatsApp(null)).toBeNull();
    expect(numeroPerWhatsApp('boh')).toBeNull();
    expect(numeroPerWhatsApp('123')).toBeNull();
  });
});

describe('oraDelMovimento', () => {
  it('scrive ore e minuti locali, con lo zero davanti', () => {
    expect(oraDelMovimento(new Date(2026, 7, 12, 7, 5).toISOString())).toBe('07:05');
    expect(oraDelMovimento(new Date(2026, 7, 12, 18, 40).toISOString())).toBe('18:40');
  });

  it('niente secondi: allungherebbero una colonna stretta senza servire', () => {
    expect(oraDelMovimento(new Date(2026, 7, 12, 7, 5, 33).toISOString())).toBe('07:05');
  });

  it('una data illeggibile non diventa NaN a schermo', () => {
    expect(oraDelMovimento('boh')).toBe('');
  });
});
