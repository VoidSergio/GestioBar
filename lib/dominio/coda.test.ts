import { describe, it, expect } from 'vitest';
import {
  attesaProssimoTentativo,
  classificaErrore,
  descriviOperazione,
  dopoErroreDiDati,
  dopoErroreDiRete,
  eBloccata,
  idBloccati,
  produce,
  prossimaDaInviare,
  quanteFallite,
  quanteInAttesa,
  richiede,
  ATTESA_MASSIMA_MS,
  type Operazione,
  type VoceCoda,
} from './coda';

function voce(
  opId: string,
  operazione: Operazione,
  extra: Partial<VoceCoda> = {},
): VoceCoda {
  return {
    opId,
    operazione,
    creataIl: 1000,
    tentativi: 0,
    riprovaDopo: 0,
    stato: 'in_attesa',
    ...extra,
  };
}

const CLIENTE: Operazione = {
  tipo: 'crea_cliente',
  dati: { id: 'cli-1', nome: 'Mario', soprannome: null, telefono: null },
};
const CONTO: Operazione = { tipo: 'apri_conto', dati: { id: 'con-1', clienteId: 'cli-1' } };
const RIGA: Operazione = {
  tipo: 'aggiungi_riga',
  dati: {
    id: 'rig-1',
    contoId: 'con-1',
    prodottoId: 'pro-1',
    descrizione: 'Caffè',
    prezzoUnitarioCent: 120,
    quantita: 1,
  },
};

describe('attesaProssimoTentativo', () => {
  it('raddoppia a ogni tentativo', () => {
    expect(attesaProssimoTentativo(1)).toBe(1000);
    expect(attesaProssimoTentativo(2)).toBe(2000);
    expect(attesaProssimoTentativo(3)).toBe(4000);
    expect(attesaProssimoTentativo(4)).toBe(8000);
  });

  it('non supera il minuto: dopo mezz\'ora offline il primo caffè non deve aspettare un quarto d\'ora', () => {
    expect(attesaProssimoTentativo(10)).toBe(ATTESA_MASSIMA_MS);
    expect(attesaProssimoTentativo(50)).toBe(ATTESA_MASSIMA_MS);
  });

  it('al primo invio non si aspetta', () => {
    expect(attesaProssimoTentativo(0)).toBe(0);
  });
});

describe('classificaErrore', () => {
  it('op_id duplicato NON è un errore: significa già registrato', () => {
    expect(
      classificaErrore('23505', 'duplicate key value violates unique constraint "conti_op_id_key"'),
    ).toBe('gia_registrato');
  });

  it('anche una chiave primaria duplicata significa già registrato', () => {
    // La tabella `clienti` non ha op_id: gli id li genera il dispositivo,
    // quindi una chiave duplicata può venire solo da un reinvio nostro.
    expect(
      classificaErrore('23505', 'duplicate key value violates unique constraint "clienti_pkey"'),
    ).toBe('gia_registrato');
  });

  it('un altro vincolo di unicità è un errore di dati vero', () => {
    // Due conti aperti per lo stesso cliente: qui serve una decisione umana
    expect(
      classificaErrore('23505', 'duplicate key value violates unique constraint "idx_un_conto_aperto_per_cliente"'),
    ).toBe('dati');
  });

  it('i problemi di rete si ritentano', () => {
    expect(classificaErrore(undefined, 'Failed to fetch')).toBe('rete');
    expect(classificaErrore(undefined, 'network timeout')).toBe('rete');
    expect(classificaErrore('503', 'Service Unavailable')).toBe('rete');
    expect(classificaErrore('429', 'Too Many Requests')).toBe('rete');
  });

  it('una chiave esterna mancante si ritenta: di solito è solo questione di ordine', () => {
    expect(classificaErrore('23503', 'violates foreign key constraint')).toBe('rete');
  });

  it('tutto il resto è un errore di dati e si ferma', () => {
    expect(classificaErrore('23514', 'violates check constraint')).toBe('dati');
    expect(classificaErrore('42501', 'new row violates row-level security policy')).toBe('dati');
  });
});

describe('dipendenze', () => {
  it('sa che cosa fa esistere ogni operazione', () => {
    expect(produce(CLIENTE)).toBe('cli-1');
    expect(produce(CONTO)).toBe('con-1');
    expect(produce({ tipo: 'chiudi_conto', dati: { contoId: 'con-1' } })).toBeNull();
  });

  it('sa che cosa serve prima', () => {
    expect(richiede(CLIENTE)).toEqual([]);
    expect(richiede(CONTO)).toEqual(['cli-1']);
    expect(richiede(RIGA)).toEqual(['con-1']);
  });

  it('un conto al banco non dipende da nessun cliente', () => {
    expect(richiede({ tipo: 'apri_conto', dati: { id: 'con-2', clienteId: null } })).toEqual([]);
  });

  it('un acconto generico dipende solo dal cliente', () => {
    expect(
      richiede({
        tipo: 'registra_pagamento',
        dati: {
          id: 'pag-1',
          clienteId: 'cli-1',
          contoId: null,
          importoCent: 2000,
          metodo: 'contanti',
          scontrinoBattuto: false,
        },
      }),
    ).toEqual(['cli-1']);
  });
});

describe('prossimaDaInviare', () => {
  it('rispetta l\'ordine di creazione: il conto prima della sua riga', () => {
    const voci = [
      voce('b', RIGA, { creataIl: 2000 }),
      voce('a', CONTO, { creataIl: 1000 }),
    ];
    expect(prossimaDaInviare(voci, 5000)?.opId).toBe('a');
  });

  it('salta chi sta ancora aspettando il prossimo tentativo', () => {
    const voci = [
      voce('a', CONTO, { creataIl: 1000, riprovaDopo: 9999 }),
      voce('b', CLIENTE, { creataIl: 2000, riprovaDopo: 0 }),
    ];
    expect(prossimaDaInviare(voci, 5000)?.opId).toBe('b');
  });

  it('salta chi è già in invio', () => {
    const voci = [
      voce('a', CONTO, { creataIl: 1000, stato: 'in_invio' }),
      voce('b', CLIENTE, { creataIl: 2000 }),
    ];
    expect(prossimaDaInviare(voci, 5000)?.opId).toBe('b');
  });

  it('restituisce null quando non c\'è niente da fare', () => {
    expect(prossimaDaInviare([], 5000)).toBeNull();
    expect(prossimaDaInviare([voce('a', CONTO, { stato: 'fallita' })], 5000)).toBeNull();
  });
});

describe('blocco per dipendenza fallita', () => {
  it('una riga non parte se il suo conto è fallito', () => {
    const voci = [voce('a', CONTO, { stato: 'fallita' }), voce('b', RIGA, { creataIl: 2000 })];
    expect(idBloccati(voci).has('con-1')).toBe(true);
    expect(eBloccata(voci[1]!, idBloccati(voci))).toBe(true);
    expect(prossimaDaInviare(voci, 5000)).toBeNull();
  });

  it('le operazioni indipendenti continuano a partire', () => {
    // Il criterio di accettazione: un errore di dati non blocca le indipendenti
    const altroCliente: Operazione = {
      tipo: 'crea_cliente',
      dati: { id: 'cli-9', nome: 'Anna', soprannome: null, telefono: null },
    };
    const voci = [
      voce('a', CONTO, { stato: 'fallita', creataIl: 1000 }),
      voce('b', RIGA, { creataIl: 2000 }),
      voce('c', altroCliente, { creataIl: 3000 }),
    ];
    expect(prossimaDaInviare(voci, 5000)?.opId).toBe('c');
  });

  it('il blocco è transitivo attraverso la catena', () => {
    // cliente fallito -> conto bloccato -> riga bloccata dietro al conto
    const voci = [
      voce('a', CLIENTE, { stato: 'fallita', creataIl: 1000 }),
      voce('b', CONTO, { creataIl: 2000 }),
    ];
    expect(prossimaDaInviare(voci, 5000)).toBeNull();
  });
});

describe('transizioni di stato', () => {
  it('un errore di rete rimanda al tentativo successivo, con attesa crescente', () => {
    let v = voce('a', CONTO);
    v = dopoErroreDiRete(v, 'Failed to fetch', 10_000);
    expect(v.stato).toBe('in_attesa');
    expect(v.tentativi).toBe(1);
    expect(v.riprovaDopo).toBe(11_000);

    v = dopoErroreDiRete(v, 'Failed to fetch', 11_000);
    expect(v.tentativi).toBe(2);
    expect(v.riprovaDopo).toBe(13_000);
  });

  it('un errore di dati ferma l\'operazione', () => {
    const v = dopoErroreDiDati(voce('a', CONTO), 'violates check constraint');
    expect(v.stato).toBe('fallita');
    expect(v.ultimoErrore).toMatch(/check constraint/);
  });

  it('non modifica la voce ricevuta', () => {
    const originale = voce('a', CONTO);
    dopoErroreDiRete(originale, 'x', 10_000);
    expect(originale.tentativi).toBe(0);
    expect(originale.stato).toBe('in_attesa');
  });
});

describe('conteggi per l\'indicatore', () => {
  it('conta quante operazioni l\'utente sta aspettando', () => {
    const voci = [
      voce('a', CONTO),
      voce('b', RIGA, { stato: 'in_invio' }),
      voce('c', CLIENTE, { stato: 'fallita' }),
    ];
    expect(quanteInAttesa(voci)).toBe(2);
    expect(quanteFallite(voci)).toBe(1);
  });
});

describe('descriviOperazione', () => {
  it('si legge come una frase, non come un record', () => {
    expect(descriviOperazione(CLIENTE)).toBe('Nuovo cliente: Mario');
    expect(descriviOperazione(RIGA)).toBe('Caffè ×1');
    expect(descriviOperazione({ tipo: 'chiudi_conto', dati: { contoId: 'x' } })).toBe(
      'Chiusura di un conto',
    );
  });
});
