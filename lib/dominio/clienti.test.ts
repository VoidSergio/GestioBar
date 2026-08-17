import { describe, it, expect } from 'vitest';
import {
  validaNuovoCliente,
  normalizzaPerRicerca,
  filtraClienti,
  etichettaCliente,
  ordinaPerRilevanza,
  ordinaPerFrequenza,
  contaConti,
  comeRimuovereCliente,
  haMovimenti,
} from './clienti';
import type { SaldoCliente } from '@/lib/supabase/tipi';

function saldo(nome: string, saldoCent: number, soprannome: string | null = null): SaldoCliente {
  return {
    id: nome,
    nome,
    soprannome,
    telefono: null,
    limite_credito_cent: null,
    attivo: true,
    addebitato_cent: Math.max(saldoCent, 0),
    pagato_cent: 0,
    saldo_cent: saldoCent,
    primo_movimento_il: null,
    ultimo_pagamento_il: null,
    ultimo_movimento_il: null,
    giorni_debito: saldoCent > 0 ? 10 : null,
  };
}

describe('validaNuovoCliente', () => {
  it("accetta il solo nome: dietro al banco non c'è tempo per altro", () => {
    const e = validaNuovoCliente({ nome: 'Mario' });
    expect(e.valido).toBe(true);
    if (e.valido) {
      expect(e.dati).toEqual({ nome: 'Mario', soprannome: null, telefono: null });
    }
  });

  it('ripulisce spazi in eccesso', () => {
    const e = validaNuovoCliente({ nome: '  Mario   Rossi  ', soprannome: ' Ciccio ' });
    expect(e.valido).toBe(true);
    if (e.valido) {
      expect(e.dati.nome).toBe('Mario Rossi');
      expect(e.dati.soprannome).toBe('Ciccio');
    }
  });

  it('rifiuta nome vuoto o di soli spazi, con messaggio comprensibile', () => {
    for (const nome of ['', '   ', '\t\n']) {
      const e = validaNuovoCliente({ nome });
      expect(e.valido).toBe(false);
      if (!e.valido) expect(e.errore).toBe('Serve almeno il nome.');
    }
  });

  it('rifiuta nomi assurdamente lunghi', () => {
    const e = validaNuovoCliente({ nome: 'a'.repeat(61) });
    expect(e.valido).toBe(false);
  });

  it('accetta i formati di telefono che si scrivono davvero', () => {
    for (const telefono of ['3471234567', '347 123 4567', '+39 347 1234567', '0721-123456']) {
      const e = validaNuovoCliente({ nome: 'Mario', telefono });
      expect(e.valido, telefono).toBe(true);
    }
  });

  it('rifiuta un telefono che non è un telefono', () => {
    const e = validaNuovoCliente({ nome: 'Mario', telefono: 'chiamalo tu' });
    expect(e.valido).toBe(false);
    if (!e.valido) expect(e.errore).toMatch(/telefono/);
  });

  it('un telefono vuoto non è un errore', () => {
    const e = validaNuovoCliente({ nome: 'Mario', telefono: '   ' });
    expect(e.valido).toBe(true);
    if (e.valido) expect(e.dati.telefono).toBeNull();
  });
});

describe('normalizzaPerRicerca', () => {
  it('toglie accenti e maiuscole', () => {
    expect(normalizzaPerRicerca('Nicolò')).toBe('nicolo');
    expect(normalizzaPerRicerca('ANDREA')).toBe('andrea');
    expect(normalizzaPerRicerca('  Giosuè  ')).toBe('giosue');
  });
});

describe('filtraClienti', () => {
  const clienti = [
    { nome: 'Mario Rossi', soprannome: null },
    { nome: 'Ambrosini Luca', soprannome: null },
    { nome: 'Franco Neri', soprannome: 'Ciccio' },
    { nome: 'Nicolò Bianchi', soprannome: null },
  ];

  it("cerca sull'inizio delle parole, non in mezzo", () => {
    const r = filtraClienti(clienti, 'ros');
    // "Ambrosini" contiene "ros" ma non comincia con quello: non deve uscire
    expect(r.map((c) => c.nome)).toEqual(['Mario Rossi']);
  });

  it('trova anche dal soprannome', () => {
    expect(filtraClienti(clienti, 'cic').map((c) => c.nome)).toEqual(['Franco Neri']);
  });

  it('ignora gli accenti: chi digita "nicolo" trova "Nicolò"', () => {
    expect(filtraClienti(clienti, 'nicolo').map((c) => c.nome)).toEqual(['Nicolò Bianchi']);
  });

  it('con ricerca vuota restituisce tutti', () => {
    expect(filtraClienti(clienti, '')).toHaveLength(4);
    expect(filtraClienti(clienti, '   ')).toHaveLength(4);
  });

  it('se non trova nulla restituisce un elenco vuoto, non un errore', () => {
    expect(filtraClienti(clienti, 'zzz')).toEqual([]);
  });
});

describe('etichettaCliente', () => {
  it("mostra il soprannome fra parentesi quando c'è", () => {
    expect(etichettaCliente({ nome: 'Franco', soprannome: 'Ciccio' })).toBe('Franco (Ciccio)');
    expect(etichettaCliente({ nome: 'Mario', soprannome: null })).toBe('Mario');
  });
});

describe('ordinaPerRilevanza', () => {
  it('mette davanti chi deve soldi, dal debito più alto', () => {
    const ordinati = ordinaPerRilevanza([
      saldo('Anna', 0),
      saldo('Franco', 6800),
      saldo('Mario', 2450),
      saldo('Bruno', 0),
    ]);
    expect(ordinati.map((c) => c.nome)).toEqual(['Franco', 'Mario', 'Anna', 'Bruno']);
  });

  it('chi è in pari resta in ordine alfabetico italiano', () => {
    const ordinati = ordinaPerRilevanza([saldo('Zeno', 0), saldo('Àlberto', 0), saldo('Bruno', 0)]);
    expect(ordinati.map((c) => c.nome)).toEqual(['Àlberto', 'Bruno', 'Zeno']);
  });

  it('chi ha un acconto non viene trattato come debitore', () => {
    const ordinati = ordinaPerRilevanza([saldo('Anna', -500), saldo('Mario', 100)]);
    expect(ordinati[0]!.nome).toBe('Mario');
  });

  it("non modifica l'elenco ricevuto", () => {
    const originale = [saldo('Anna', 0), saldo('Franco', 6800)];
    ordinaPerRilevanza(originale);
    expect(originale[0]!.nome).toBe('Anna');
  });
});

describe('comeRimuovereCliente', () => {
  it('un barista non tocca niente', () => {
    const r = comeRimuovereCliente({ ruolo: 'barista', haMovimenti: false });
    expect(r.azione).toBe('vietata');
  });

  it('senza ruolo conosciuto non si fa niente', () => {
    expect(comeRimuovereCliente({ ruolo: null, haMovimenti: false }).azione).toBe('vietata');
  });

  it('il titolare cancella davvero un cliente senza movimenti', () => {
    // Il caso vero: un doppione, o un nome scritto male
    expect(comeRimuovereCliente({ ruolo: 'titolare', haMovimenti: false }).azione).toBe('cancella');
  });

  it('un cliente con movimenti si disattiva, non si cancella', () => {
    const r = comeRimuovereCliente({ ruolo: 'titolare', haMovimenti: true });
    expect(r.azione).toBe('disattiva');
    if (r.azione === 'disattiva') expect(r.motivo).toMatch(/estratto conto/i);
  });
});

describe('haMovimenti', () => {
  it('un cliente mai servito non ha movimenti', () => {
    expect(haMovimenti({ addebitato_cent: 0, pagato_cent: 0 })).toBe(false);
  });

  it('chi ha consumato e pagato tutto ha saldo zero ma una storia', () => {
    // È il caso che rende sbagliato guardare il saldo invece dei totali:
    // cancellarlo porterebbe via mesi di estratto conto
    expect(haMovimenti({ addebitato_cent: 5000, pagato_cent: 5000 })).toBe(true);
  });

  it('basta un solo movimento', () => {
    expect(haMovimenti({ addebitato_cent: 120, pagato_cent: 0 })).toBe(true);
    expect(haMovimenti({ addebitato_cent: 0, pagato_cent: 500 })).toBe(true);
  });
});

describe('contaConti', () => {
  it('conta quanti conti ha aperto ciascun cliente', () => {
    const conti = [
      { cliente_id: 'a' },
      { cliente_id: 'b' },
      { cliente_id: 'a' },
      { cliente_id: 'a' },
    ];
    expect(contaConti(conti)).toEqual({ a: 3, b: 1 });
  });

  it('i conti al banco non hanno un cliente e non contano', () => {
    expect(contaConti([{ cliente_id: null }, { cliente_id: 'a' }, { cliente_id: null }])).toEqual({
      a: 1,
    });
  });

  it('senza conti restituisce un oggetto vuoto, non undefined', () => {
    expect(contaConti([])).toEqual({});
  });

  it('è un oggetto semplice: sopravvive al giro in JSON della cache locale', () => {
    const conteggio = contaConti([{ cliente_id: 'a' }, { cliente_id: 'a' }]);
    // Una Map qui si salverebbe come {} e la frequenza sparirebbe a ogni
    // riavvio senza che niente lo segnali.
    expect(JSON.parse(JSON.stringify(conteggio))).toEqual(conteggio);
  });
});

describe('ordinaPerFrequenza', () => {
  it('prima chi viene più spesso, non chi deve di più', () => {
    const abituale = saldo('Anna', 0);
    const debitore = saldo('Bruno', 10_000);

    const ordinati = ordinaPerFrequenza([debitore, abituale], { Anna: 20, Bruno: 1 });

    expect(ordinati.map((c) => c.nome)).toEqual(['Anna', 'Bruno']);
  });

  it('a parità di frequenza vale l’ordine dell’elenco clienti: prima chi deve', () => {
    const inPari = saldo('Anna', 0);
    const deve = saldo('Bruno', 500);

    expect(ordinaPerFrequenza([inPari, deve], { Anna: 3, Bruno: 3 }).map((c) => c.nome)).toEqual([
      'Bruno',
      'Anna',
    ]);
  });

  it('chi non è passato di recente scende sotto, ma non sparisce', () => {
    const nuovo = saldo('Zeno', 0);
    const abituale = saldo('Anna', 0);

    const ordinati = ordinaPerFrequenza([nuovo, abituale], { Anna: 5 });

    expect(ordinati.map((c) => c.nome)).toEqual(['Anna', 'Zeno']);
    expect(ordinati).toHaveLength(2);
  });

  it('senza dati di frequenza si comporta come ordinaPerRilevanza', () => {
    const clienti = [saldo('Anna', 0), saldo('Bruno', 500), saldo('Carla', 2000)];
    expect(ordinaPerFrequenza(clienti, {}).map((c) => c.nome)).toEqual(
      ordinaPerRilevanza(clienti).map((c) => c.nome),
    );
  });

  it('non modifica l’elenco di partenza', () => {
    const clienti = [saldo('Anna', 0), saldo('Bruno', 0)];
    ordinaPerFrequenza(clienti, { Bruno: 9 });
    expect(clienti.map((c) => c.nome)).toEqual(['Anna', 'Bruno']);
  });
});
