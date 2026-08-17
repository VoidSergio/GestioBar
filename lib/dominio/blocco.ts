/**
 * Il blocco rapido a quattro cifre (T-44).
 *
 * CHE COSA PROTEGGE, E DA CHI. Il telefono sta sul banco tutto il giorno,
 * sbloccato, girato verso la sala. Chi passa dall'altra parte vede i crediti
 * di tutti — quanto deve il vicino di casa, quanto deve il cognato. Questo
 * PIN serve a quello: **a coprire lo schermo**, non a fermare qualcuno.
 *
 * Non è una seconda autenticazione, e non va raccontato come tale. La
 * sessione di Supabase resta valida sotto, il PIN sta sul dispositivo, e
 * chiunque abbia il telefono in mano e sappia aprire gli strumenti da
 * sviluppatore lo aggira in un minuto. È il paletto che tiene fuori le
 * persone oneste, ed è tutto quello che serve al banco.
 *
 * La ragione per cui esiste è un'altra: senza, l'alternativa vera è **fare
 * logout ogni volta**, e rifare la mail e la password con la fila davanti non
 * lo fa nessuno. Un blocco che si toglie in quattro tocchi viene usato; uno
 * che costa venti secondi resta spento.
 */

/** Quante cifre. Quattro: dieci sono un codice, quattro sono un gesto. */
export const CIFRE_PIN = 4;

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${CIFRE_PIN}}$`).test(pin);
}

/**
 * L'impronta del PIN, quella che finisce su disco.
 *
 * **Non è crittografia**, ed è scritto qui perché nessuno se lo dimentichi:
 * con quattro cifre ci sono diecimila possibilità, e provarle tutte contro
 * qualunque funzione richiede un istante. Serve solo a non lasciare il numero
 * in chiaro dentro `localStorage`, dove si legge senza nemmeno cercarlo.
 *
 * Un algoritmo scritto a mano e non `crypto.subtle` perché quello è
 * asincrono e non gira nei test senza un browser, e qui la robustezza non
 * cambia niente: il PIN non difende dei soldi, copre uno schermo.
 */
export function improntaPin(pin: string): string {
  let a = 0x811c9dc5;

  for (const carattere of `bar:${pin}`) {
    a ^= carattere.charCodeAt(0);
    a = Math.imul(a, 0x01000193) >>> 0;
  }

  return a.toString(16).padStart(8, '0');
}

export interface Blocco {
  impronta: string;
  /** Dopo quanti minuti fermo lo schermo si copre. */
  dopoMinuti: number;
}

/** Le attese fra cui si sceglie. Zero vuol dire "appena chiudo l'app". */
export const ATTESE: ReadonlyArray<{ minuti: number; etichetta: string }> = [
  { minuti: 0, etichetta: 'Subito' },
  { minuti: 2, etichetta: '2 minuti' },
  { minuti: 10, etichetta: '10 minuti' },
  { minuti: 60, etichetta: "Un'ora" },
];

/**
 * Va coperto lo schermo?
 *
 * `ultimoUso` è l'ultimo momento in cui qualcuno ha toccato qualcosa. Con
 * `dopoMinuti` a zero basta che l'app sia passata in secondo piano: è il caso
 * di chi posa il telefono sul banco e si gira.
 */
export function deveBloccare(
  ultimoUso: number,
  dopoMinuti: number,
  adesso: number = Date.now(),
): boolean {
  if (dopoMinuti <= 0) return true;
  return adesso - ultimoUso >= dopoMinuti * 60_000;
}

/**
 * Quanto si aspetta dopo un PIN sbagliato.
 *
 * Cresce con i tentativi, ma si ferma a mezzo minuto: un'attesa che diventa
 * di ore proteggerebbe da un attacco che qui non esiste, e intanto
 * bloccherebbe fuori il barista che ha sbagliato tre volte con le mani
 * bagnate mentre c'è fila. Il danno del secondo caso è certo, quello del
 * primo è immaginario.
 */
export function attesaDopoErrori(tentativi: number): number {
  if (tentativi < 3) return 0;
  return Math.min((tentativi - 2) * 5_000, 30_000);
}
