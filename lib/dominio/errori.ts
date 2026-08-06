/**
 * Dare un nome a quello che è andato storto in lettura.
 *
 * PERCHÉ ESISTE. Le schermate che leggono dal server mostravano "serve la
 * connessione" per **qualunque** errore. Quando il server rispondeva davvero
 * — vista mancante, permesso negato — il messaggio mandava a controllare il
 * wifi, che funzionava benissimo. Un messaggio sbagliato è peggio di nessun
 * messaggio: fa perdere tempo nella direzione opposta.
 *
 * Funzioni pure: niente React, niente Supabase (CLAUDE.md).
 */

export type CausaErrore =
  /** il server non è stato raggiunto */
  | 'rete'
  /** il server c'è ma manca una vista o una tabella: una migrazione non è stata eseguita */
  | 'struttura_mancante'
  /** il server ha risposto di no */
  | 'permesso'
  | 'sconosciuta';

export interface SpiegazioneErrore {
  causa: CausaErrore;
  /** la frase da mostrare, in italiano e senza codici */
  titolo: string;
  /** una riga in più solo quando aiuta a risolvere */
  dettaglio?: string;
}

/**
 * Un errore di lettura che si porta dietro il codice del database.
 *
 * `new Error(error.message)` buttava via il codice, ed era proprio il codice
 * a distinguere "manca la vista" da "manca la rete".
 */
export class ErroreLettura extends Error {
  readonly codice?: string;

  constructor(messaggio: string, codice?: string) {
    super(messaggio);
    this.name = 'ErroreLettura';
    this.codice = codice;
  }
}

export function classificaErroreLettura(errore: unknown, offline = false): CausaErrore {
  if (offline) return 'rete';

  const messaggio = errore instanceof Error ? errore.message : String(errore ?? '');
  const codice = errore instanceof ErroreLettura ? errore.codice : undefined;

  // La richiesta non è nemmeno partita
  if (/failed to fetch|networkerror|fetch failed|load failed|timeout/i.test(messaggio)) {
    return 'rete';
  }

  // 42P01 = relazione inesistente. PGRST205 = PostgREST non la trova nella
  // sua cache dello schema, che è lo stesso sintomo visto dall'altro lato.
  if (
    codice === '42P01' ||
    codice === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(messaggio)
  ) {
    return 'struttura_mancante';
  }

  if (codice === '42501' || /permission denied|row-level security/i.test(messaggio)) {
    return 'permesso';
  }

  return 'sconosciuta';
}

/**
 * @param cosa che cosa si stava leggendo, per scriverlo nella frase:
 *             "Lo storico", "Questa schermata"
 */
export function spiegaErroreLettura(
  errore: unknown,
  opzioni: { offline?: boolean; cosa?: string } = {},
): SpiegazioneErrore {
  const cosa = opzioni.cosa ?? 'Questa schermata';
  const causa = classificaErroreLettura(errore, opzioni.offline);

  switch (causa) {
    case 'rete':
      return { causa, titolo: `${cosa} richiede la connessione.` };

    case 'struttura_mancante':
      return {
        causa,
        titolo: `${cosa} non trova i dati sul server.`,
        // Il titolare di questo bar è anche chi esegue le migrazioni: dirglielo
        // è l'unica cosa utile, e non è un codice tecnico ma un'istruzione.
        dettaglio:
          'Manca un aggiornamento del database. Esegui le migrazioni non ancora lanciate nel SQL Editor di Supabase.',
      };

    case 'permesso':
      return {
        causa,
        titolo: `Non hai i permessi per vedere ${cosa.toLowerCase()}.`,
      };

    case 'sconosciuta':
      return {
        causa,
        titolo: `${cosa} non si è caricata.`,
        dettaglio: errore instanceof Error ? errore.message : undefined,
      };
  }
}
