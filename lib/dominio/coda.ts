/**
 * Regole della coda di scrittura offline (DEC-06).
 *
 * Funzioni pure: niente React, niente Supabase, niente IndexedDB.
 * Il motore che invia sta in `lib/offline/sync.ts`; qui c'è solo il
 * ragionamento, perché è la parte che non deve sbagliare ed è l'unica
 * che si può provare senza rete e senza database.
 */

/* ------------------------------------------------------- le operazioni */

export type Operazione =
  | {
      tipo: 'crea_cliente';
      dati: { id: string; nome: string; soprannome: string | null; telefono: string | null };
    }
  | {
      /**
       * Un conto confermato: intestazione e righe insieme (DEC-08).
       *
       * È l'operazione normale per registrare un conto. `apri_conto` e
       * `aggiungi_riga` restano per il caso in cui, in Fase 4, i conti
       * dovranno vivere sul server mentre vengono composti.
       */
      tipo: 'salva_conto';
      dati: {
        id: string;
        clienteId: string | null;
        righe: Array<{
          id: string;
          prodottoId: string | null;
          descrizione: string;
          prezzoUnitarioCent: number;
          quantita: number;
        }>;
        /** presente se il conto è stato incassato subito */
        pagamento: {
          id: string;
          importoCent: number;
          metodo: string;
          scontrinoBattuto: boolean;
        } | null;
      };
    }
  | { tipo: 'apri_conto'; dati: { id: string; clienteId: string | null } }
  | {
      tipo: 'aggiungi_riga';
      dati: {
        id: string;
        contoId: string;
        prodottoId: string | null;
        descrizione: string;
        prezzoUnitarioCent: number;
        quantita: number;
      };
    }
  | { tipo: 'storna_riga'; dati: { id: string; rigaOriginaleId: string; contoId: string } }
  | { tipo: 'elimina_riga'; dati: { rigaId: string } }
  | {
      tipo: 'registra_pagamento';
      dati: {
        id: string;
        clienteId: string | null;
        contoId: string | null;
        importoCent: number;
        metodo: string;
        scontrinoBattuto: boolean;
      };
    }
  | { tipo: 'chiudi_conto'; dati: { contoId: string } };

export type StatoVoce = 'in_attesa' | 'in_invio' | 'fallita';

export interface VoceCoda {
  /** Finisce nella colonna `op_id`: è la protezione dai doppi invii. */
  opId: string;
  operazione: Operazione;
  creataIl: number;
  tentativi: number;
  /** Momento a partire dal quale si può ritentare. */
  riprovaDopo: number;
  stato: StatoVoce;
  ultimoErrore?: string;
}

/* ------------------------------------------------------- le dipendenze */

/**
 * Che cosa fa esistere questa operazione.
 * Serve a capire chi dipende da chi quando qualcosa fallisce.
 */
export function produce(op: Operazione): string | null {
  switch (op.tipo) {
    case 'salva_conto':
    case 'crea_cliente':
    case 'apri_conto':
    case 'aggiungi_riga':
    case 'storna_riga':
    case 'registra_pagamento':
      return op.dati.id;
    case 'elimina_riga':
    case 'chiudi_conto':
      return null;
  }
}

/**
 * Che cosa deve già esistere sul server perché questa operazione riesca.
 *
 * Senza questo, una riga inviata prima del suo conto fallirebbe per chiave
 * esterna mancante — e sembrerebbe un errore di dati, cioè irrecuperabile,
 * quando invece è solo una questione di ordine.
 */
export function richiede(op: Operazione): string[] {
  switch (op.tipo) {
    case 'crea_cliente':
      return [];
    case 'salva_conto':
      // Un conto intestato non può partire prima del suo cliente
      return op.dati.clienteId ? [op.dati.clienteId] : [];
    case 'apri_conto':
      return op.dati.clienteId ? [op.dati.clienteId] : [];
    case 'aggiungi_riga':
      return [op.dati.contoId];
    case 'storna_riga':
      return [op.dati.rigaOriginaleId, op.dati.contoId];
    case 'elimina_riga':
      return [op.dati.rigaId];
    case 'registra_pagamento':
      return [op.dati.clienteId, op.dati.contoId].filter((x): x is string => x !== null);
    case 'chiudi_conto':
      return [op.dati.contoId];
  }
}

/* ----------------------------------------------------- gli errori */

export type GenereErrore =
  | 'gia_registrato' // op_id duplicato: NON è un errore
  | 'rete' // si ritenta
  | 'dati'; // non si ritenta: serve l'intervento di una persona

/**
 * Distingue i tre casi che contano.
 *
 * `gia_registrato` è il più importante e il meno intuitivo: se il server
 * rifiuta la scrittura perché quell'`op_id` esiste già, significa che il
 * primo invio era arrivato e la risposta si è persa per strada. L'operazione
 * è andata a buon fine: trattarla come errore la farebbe ritentare all'infinito
 * o, peggio, comparire come "non registrata" quando invece è nel database.
 */
export function classificaErrore(codice: string | undefined, messaggio: string): GenereErrore {
  // 23505 = violazione di vincolo di unicità in Postgres.
  //
  // Due vincoli significano "questa operazione era già arrivata":
  //  - `op_id`: la protezione esplicita dai doppi invii
  //  - `_pkey`: la chiave primaria. Tutti gli id li genera il dispositivo
  //    (02-MODELLO-DATI.md §2), quindi una chiave duplicata può venire solo
  //    da un reinvio della stessa operazione. La tabella `clienti` non ha
  //    `op_id` e si affida proprio a questo.
  //
  // Ogni altro vincolo di unicità è un errore vero — per esempio due conti
  // aperti per lo stesso cliente — e va mostrato a una persona.
  if (codice === '23505' && /op_id|_pkey/i.test(messaggio)) return 'gia_registrato';

  // Assenza di rete, timeout, DNS: il server non ha nemmeno visto la richiesta
  if (!codice && /fetch|network|timeout|ENOTFOUND|ETIMEDOUT|Failed to fetch/i.test(messaggio)) {
    return 'rete';
  }

  // 5xx e limitazioni temporanee: il server c'è ma adesso non può
  if (codice && /^(5\d\d|408|429)$/.test(codice)) return 'rete';

  // 23503 = chiave esterna mancante. Di solito significa che la riga da cui
  // dipendiamo non è ancora arrivata: vale la pena ritentare.
  if (codice === '23503') return 'rete';

  return 'dati';
}

/* ------------------------------------------------- l'attesa fra tentativi */

export const ATTESA_MINIMA_MS = 1000;
export const ATTESA_MASSIMA_MS = 60_000;

/**
 * Attesa prima del tentativo successivo: 1s, 2s, 4s, 8s… fino a 60s.
 *
 * Raddoppiare evita di martellare un server che sta già faticando; il tetto
 * di 60 secondi evita che, dopo mezz'ora offline, il primo caffè della
 * riapertura resti in coda per un quarto d'ora.
 */
export function attesaProssimoTentativo(tentativi: number): number {
  if (tentativi <= 0) return 0;
  const attesa = ATTESA_MINIMA_MS * 2 ** (tentativi - 1);
  return Math.min(attesa, ATTESA_MASSIMA_MS);
}

/* --------------------------------------------------- scelta della prossima */

/**
 * Id prodotti da operazioni fallite: chi dipende da loro non può partire.
 */
export function idBloccati(voci: readonly VoceCoda[]): Set<string> {
  const bloccati = new Set<string>();
  for (const v of voci) {
    if (v.stato !== 'fallita') continue;
    const id = produce(v.operazione);
    if (id) bloccati.add(id);
  }
  return bloccati;
}

/** Una voce è bloccata se aspetta qualcosa che non arriverà mai. */
export function eBloccata(voce: VoceCoda, bloccati: ReadonlySet<string>): boolean {
  return richiede(voce.operazione).some((id) => bloccati.has(id));
}

/**
 * La prossima operazione da inviare, o `null` se non c'è niente da fare ora.
 *
 * L'ordine è quello di creazione, sempre (03-ARCHITETTURA.md §4.4): una riga
 * non può partire prima del conto che la contiene. Si salta chi è in attesa
 * del prossimo tentativo, chi è già in invio, e chi dipende da un'operazione
 * fallita.
 */
export function prossimaDaInviare(
  voci: readonly VoceCoda[],
  adesso: number = Date.now(),
): VoceCoda | null {
  const bloccati = idBloccati(voci);

  const candidate = voci
    .filter((v) => v.stato === 'in_attesa')
    .filter((v) => v.riprovaDopo <= adesso)
    .filter((v) => !eBloccata(v, bloccati))
    .sort((a, b) => a.creataIl - b.creataIl);

  return candidate[0] ?? null;
}

/** Quante operazioni l'utente sta ancora aspettando. */
export function quanteInAttesa(voci: readonly VoceCoda[]): number {
  return voci.filter((v) => v.stato === 'in_attesa' || v.stato === 'in_invio').length;
}

export function quanteFallite(voci: readonly VoceCoda[]): number {
  return voci.filter((v) => v.stato === 'fallita').length;
}

/* ------------------------------------------------ transizioni di stato */

/** Dopo un errore di rete: si ritenta più tardi. */
export function dopoErroreDiRete(voce: VoceCoda, messaggio: string, adesso = Date.now()): VoceCoda {
  const tentativi = voce.tentativi + 1;
  return {
    ...voce,
    tentativi,
    stato: 'in_attesa',
    riprovaDopo: adesso + attesaProssimoTentativo(tentativi),
    ultimoErrore: messaggio,
  };
}

/** Dopo un errore di dati: si ferma e si mostra all'utente. */
export function dopoErroreDiDati(voce: VoceCoda, messaggio: string): VoceCoda {
  return { ...voce, tentativi: voce.tentativi + 1, stato: 'fallita', ultimoErrore: messaggio };
}

/**
 * Descrizione dell'operazione per l'elenco delle cose non inviate.
 * Deve leggersi come una frase, non come un tipo di record.
 */
export function descriviOperazione(op: Operazione): string {
  switch (op.tipo) {
    case 'crea_cliente':
      return `Nuovo cliente: ${op.dati.nome}`;
    case 'salva_conto': {
      const pezzi = op.dati.righe.reduce((s, r) => s + r.quantita, 0);
      return `Conto da ${pezzi} ${pezzi === 1 ? 'voce' : 'voci'}`;
    }
    case 'apri_conto':
      return 'Apertura di un conto';
    case 'aggiungi_riga':
      return `${op.dati.descrizione} ×${op.dati.quantita}`;
    case 'storna_riga':
      return 'Storno di una riga';
    case 'elimina_riga':
      return 'Riga eliminata';
    case 'registra_pagamento':
      return 'Pagamento';
    case 'chiudi_conto':
      return 'Chiusura di un conto';
  }
}
