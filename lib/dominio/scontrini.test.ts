import { describe, it, expect } from 'vitest';
import {
  chiHaPagato,
  eOggi,
  filtraPerGruppo,
  giornoSpostato,
  gruppoDi,
  intervalloGiornata,
  perMetodo,
  riassumiScontrini,
} from './scontrini';
import type { MovimentoScontrino } from '@/lib/supabase/tipi';

function incasso(
  importoCent: number,
  scontrinato: boolean,
  extra: Partial<MovimentoScontrino> = {},
): MovimentoScontrino {
  return {
    movimento_id: `inc-${importoCent}-${String(scontrinato)}-${extra.data ?? ''}`,
    tipo: 'incasso',
    data: '2026-08-06T09:00:00Z',
    importo_cent: importoCent,
    scontrino_battuto: scontrinato,
    metodo: 'contanti',
    cliente_id: null,
    cliente_nome: null,
    cliente_soprannome: null,
    conto_numero: 1,
    ...extra,
  };
}

function credito(importoCent: number, extra: Partial<MovimentoScontrino> = {}): MovimentoScontrino {
  return {
    movimento_id: `cre-${importoCent}-${extra.data ?? ''}`,
    tipo: 'a_credito',
    data: '2026-08-06T10:00:00Z',
    importo_cent: importoCent,
    scontrino_battuto: false,
    metodo: null,
    cliente_id: 'cli-1',
    cliente_nome: 'Franco',
    cliente_soprannome: null,
    conto_numero: 2,
    ...extra,
  };
}

describe('riassumiScontrini', () => {
  it('tiene separati i soldi entrati senza scontrino e la merce a credito', () => {
    const r = riassumiScontrini([
      incasso(1200, true),
      incasso(500, true),
      incasso(300, false),
      credito(2450),
    ]);

    expect(r.scontrinatoCent).toBe(1700);
    expect(r.nonScontrinatoCent).toBe(300);
    expect(r.aCreditoCent).toBe(2450);
    expect(r.nScontrinati).toBe(2);
    expect(r.nNonScontrinati).toBe(1);
    expect(r.nACredito).toBe(1);
  });

  it("l'incassato è tutto quello che è entrato, battuto o no", () => {
    const r = riassumiScontrini([incasso(1200, true), incasso(300, false), credito(9999)]);
    // Il credito NON è entrato in cassa e non va sommato
    expect(r.incassatoCent).toBe(1500);
  });

  it('una giornata senza movimenti dà tutti zeri', () => {
    const r = riassumiScontrini([]);
    expect(r.incassatoCent).toBe(0);
    expect(r.nonScontrinatoCent).toBe(0);
    expect(r.aCreditoCent).toBe(0);
  });

  it('una giornata in regola non ha niente da spiegare', () => {
    const r = riassumiScontrini([incasso(1200, true), incasso(170, true)]);
    expect(r.nonScontrinatoCent).toBe(0);
    expect(r.aCreditoCent).toBe(0);
  });
});

describe('gruppoDi e filtraPerGruppo', () => {
  it('classifica le tre situazioni', () => {
    expect(gruppoDi(incasso(100, true))).toBe('scontrinato');
    expect(gruppoDi(incasso(100, false))).toBe('non_scontrinato');
    expect(gruppoDi(credito(100))).toBe('a_credito');
  });

  it('dentro un gruppo il più recente sta in cima', () => {
    const movimenti = [
      incasso(100, false, { data: '2026-08-06T07:00:00Z' }),
      incasso(200, false, { data: '2026-08-06T11:00:00Z' }),
      incasso(300, true, { data: '2026-08-06T09:00:00Z' }),
    ];
    const nonScontrinati = filtraPerGruppo(movimenti, 'non_scontrinato');

    expect(nonScontrinati).toHaveLength(2);
    expect(nonScontrinati[0]!.importo_cent).toBe(200);
  });
});

describe('perMetodo', () => {
  it('somma per metodo, ignorando i crediti che non hanno un metodo', () => {
    const totali = perMetodo([
      incasso(1000, true),
      incasso(500, false),
      incasso(2000, true, { metodo: 'carta' }),
      credito(9999),
    ]);

    expect(totali.get('contanti')).toBe(1500);
    expect(totali.get('carta')).toBe(2000);
    expect(totali.size).toBe(2);
  });
});

describe('intervalloGiornata', () => {
  it('copre esattamente 24 ore', () => {
    const { inizio, fine } = intervalloGiornata(new Date('2026-08-06T15:30:00'));
    const durata = new Date(fine).getTime() - new Date(inizio).getTime();
    expect(durata).toBe(24 * 60 * 60 * 1000);
  });

  it("parte da mezzanotte locale, non dall'ora in cui si guarda", () => {
    const mattina = intervalloGiornata(new Date('2026-08-06T06:00:00'));
    const sera = intervalloGiornata(new Date('2026-08-06T23:00:00'));
    expect(mattina.inizio).toBe(sera.inizio);
    expect(mattina.fine).toBe(sera.fine);
  });
});

describe('giornoSpostato ed eOggi', () => {
  it('va avanti e indietro di un giorno', () => {
    const giorno = new Date('2026-08-06T12:00:00');
    expect(giornoSpostato(giorno, -1).getDate()).toBe(5);
    expect(giornoSpostato(giorno, 1).getDate()).toBe(7);
  });

  it('funziona a cavallo del mese', () => {
    const primoAgosto = new Date('2026-08-01T12:00:00');
    const prima = giornoSpostato(primoAgosto, -1);
    expect(prima.getMonth()).toBe(6); // luglio
    expect(prima.getDate()).toBe(31);
  });

  it('riconosce oggi indipendentemente dall’ora', () => {
    const adesso = new Date('2026-08-06T18:00:00');
    expect(eOggi(new Date('2026-08-06T05:00:00'), adesso)).toBe(true);
    expect(eOggi(new Date('2026-08-05T23:59:00'), adesso)).toBe(false);
  });
});

describe('chiHaPagato', () => {
  it('senza cliente è il banco', () => {
    expect(chiHaPagato(incasso(120, true))).toBe('Banco');
  });

  it('col soprannome lo mostra fra parentesi', () => {
    expect(chiHaPagato(credito(120, { cliente_soprannome: 'Ciccio' }))).toBe('Franco (Ciccio)');
  });
});
