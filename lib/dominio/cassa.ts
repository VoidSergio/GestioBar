/**
 * La lettura di cassa a fine turno.
 *
 * Funzioni pure: niente React, niente Supabase. Qui c'è l'unica cosa che non
 * deve sbagliare — i conti — ed è l'unica che si può provare senza montare
 * niente.
 *
 * La regola che governa tutto il file, da 02-MODELLO-DATI §4.1:
 * **il cassetto si riconcilia con i movimenti di contante, non con il
 * venduto.** In un locale che segna le due cose non coincidono mai, e chi
 * confonde l'una con l'altra sottrae due volte.
 */

/** Quello che l'app sa del turno aperto, prima che qualcuno conti i soldi. */
export interface StatoTurno {
  iniziatoIl: string;
  fondoCassaCent: number;
  incassatoContantiCent: number;
  incassatoCartaCent: number;
  incassatoAltroCent: number;
  /** consumato a credito meno vecchi debiti rientrati */
  variazioneCreditoCent: number;
}

/** La lettura completa, una volta scritto il conteggio del cassetto. */
export interface LetturaCassa {
  /** fondo + contanti incassati: quanto dovrebbe esserci */
  attesoCent: number;
  /** contato − atteso. Negativo = manca */
  differenzaCent: number;
  /** contato − fondo: quanto si porta via chi smonta */
  ritiraCent: number;
  /** quanto resta nel cassetto per il collega */
  lasciaCent: number;
}

/**
 * I quattro numeri della chiusura.
 *
 * Sono gli stessi che calcola il database in colonne generate
 * (`0016_cassa_turni.sql`). La ripetizione è voluta: qui servono **prima**
 * dell'invio, per mostrarli mentre si conta, e la coda offline può far
 * passare ore fra il conteggio e la scrittura. Il database resta l'ultima
 * parola; questo è ciò che vede chi sta contando.
 */
export function calcolaLettura(stato: StatoTurno, contatoCent: number): LetturaCassa {
  const attesoCent = stato.fondoCassaCent + stato.incassatoContantiCent;
  return {
    attesoCent,
    differenzaCent: contatoCent - attesoCent,
    ritiraCent: contatoCent - stato.fondoCassaCent,
    lasciaCent: stato.fondoCassaCent,
  };
}

/* --------------------------------------------------------- validazione */

export type EsitoConteggio =
  | { valido: true; contatoCent: number }
  | { valido: false; motivo: string };

/**
 * Controlla il numero scritto da chi chiude.
 *
 * `parseEuro` ha già rifiutato quello che non è un importo; qui restano i
 * casi che sono importi validi ma non conteggi validi.
 */
export function validaConteggio(contatoCent: number | null, stato: StatoTurno): EsitoConteggio {
  if (contatoCent === null) {
    return { valido: false, motivo: 'Scrivi quanto c’è nel cassetto.' };
  }

  if (contatoCent < stato.fondoCassaCent) {
    // Non è un errore di battitura improbabile: è il caso in cui nel cassetto
    // non c'è nemmeno il fondo. Va registrato, ma chi chiude deve accorgersene
    // adesso e non domani, perché adesso può ancora ricontare.
    return {
      valido: false,
      motivo:
        'Nel cassetto c’è meno del fondo cassa. Ricontrolla: se è davvero così, chiama il titolare.',
    };
  }

  return { valido: true, contatoCent };
}

/**
 * Soglia oltre la quale la differenza va spiegata.
 *
 * Cinquanta centesimi: sotto, è il resto sbagliato di un caffè e chiedere una
 * causale ogni sera insegnerebbe solo a scrivere "ok" per liberarsi del campo.
 * Sopra, qualcosa è successo e conviene ricordarselo.
 */
export const SOGLIA_CAUSALE_CENT = 50;

export function serveCausale(differenzaCent: number): boolean {
  return Math.abs(differenzaCent) >= SOGLIA_CAUSALE_CENT;
}

/* ------------------------------------------------------- presentazione */

export type SegnoDifferenza = 'in_pari' | 'manca' | 'avanza';

export function segnoDifferenza(differenzaCent: number): SegnoDifferenza {
  if (differenzaCent === 0) return 'in_pari';
  return differenzaCent < 0 ? 'manca' : 'avanza';
}

/**
 * Da quanto tempo è aperto il turno, in italiano leggibile.
 *
 * Serve soprattutto per il caso storto: se il turno risulta cominciato ieri,
 * vuol dire che qualcuno non ha chiuso, e i conti di due persone si sono
 * mescolati. Non è impedibile, ma deve saltare all'occhio.
 */
export function descriviDurata(iniziatoIl: string, adesso: Date = new Date()): string {
  const inizio = new Date(iniziatoIl);
  const minuti = Math.max(0, Math.floor((adesso.getTime() - inizio.getTime()) / 60000));

  if (minuti < 60) return `${minuti} min`;

  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (ore < 24) return resto === 0 ? `${ore} h` : `${ore} h ${resto} min`;

  const giorni = Math.floor(ore / 24);
  return giorni === 1 ? '1 giorno' : `${giorni} giorni`;
}

/** Oltre le 16 ore un turno non è un turno: qualcuno non ha chiuso. */
export const TURNO_SOSPETTO_ORE = 16;

export function turnoTroppoLungo(iniziatoIl: string, adesso: Date = new Date()): boolean {
  const ore = (adesso.getTime() - new Date(iniziatoIl).getTime()) / 3_600_000;
  return ore > TURNO_SOSPETTO_ORE;
}

/**
 * L'ora di inizio e fine, come si scrivono su una scheda: `6:00 → 13:00`.
 */
export function intestazioneTurno(
  iniziatoIl: string,
  chiusoIl: string | Date = new Date()
): string {
  const ora = (d: Date) =>
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fine = typeof chiusoIl === 'string' ? new Date(chiusoIl) : chiusoIl;
  return `${ora(new Date(iniziatoIl))} → ${ora(fine)}`;
}
