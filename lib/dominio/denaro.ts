/**
 * Modulo denaro — il file più importante del progetto.
 *
 * Regola (DEC-04): tutti gli importi sono INTERI in CENTESIMI.
 * 1,20 € si scrive 120. Mai numeri con la virgola nei calcoli.
 *
 * Motivo: in JavaScript 0.1 + 0.2 non fa 0.3. Su un conto con centinaia
 * di righe l'errore si accumula e produce saldi che finiscono con ,0000001.
 *
 * REGOLA ASSOLUTA: la divisione per 100 compare in UN SOLO PUNTO di tutto
 * il progetto, dentro formatEuro(). Se la scrivi altrove, è un bug.
 * Il controllo automatico è `npm run verifica:denaro`.
 */

/**
 * Importo in centesimi.
 * A runtime è un normale number; il "marchio" serve solo a TypeScript,
 * che rifiuta di accettare un numero qualsiasi dove è atteso un importo.
 */
export type Centesimi = number & { readonly __marchio: 'Centesimi' };

/** Costruisce un importo verificando che sia intero. */
export function centesimi(n: number): Centesimi {
  if (!Number.isInteger(n)) {
    throw new Error(
      `Importo non intero: ${n}. Gli importi sono sempre in centesimi (1,20 € = 120).`,
    );
  }
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Importo fuori scala: ${n}.`);
  }
  return n as Centesimi;
}

export const ZERO = centesimi(0);

/**
 * Converte quanto digitato dall'utente in centesimi.
 * Accetta "1,20", "1.20", "1", " 1,2 ". Restituisce null se non è un importo valido.
 *
 * Non accetta importi negativi: un pagamento negativo è uno storno e passa
 * da un'altra strada (vedi DEC-03).
 */
export function parseEuro(input: string): Centesimi | null {
  if (typeof input !== 'string') return null;

  const grezzo = input.trim().replace(',', '.');
  if (grezzo === '') return null;

  // solo cifre e un punto decimale
  if (!/^\d+(\.\d{0,2})?$/.test(grezzo)) return null;

  const euro = Number(grezzo);
  if (!Number.isFinite(euro)) return null;

  // Math.round assorbe l'imprecisione di 1.15 * 100 = 114.99999999999999
  return centesimi(Math.round(euro * 100));
}

/**
 * L'UNICA funzione che trasforma centesimi in testo leggibile.
 * Qui, e solo qui, si divide per 100.
 */
export function formatEuro(importoCent: number, opzioni?: { segnoPiu?: boolean }): string {
  const testo = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // L'italiano segue la regola CLDR "min2": senza questa opzione 1200 verrebbe
    // scritto "1200,00" e 12000 "12.000,00", con un separatore che compare e
    // scompare a seconda della cifra. Peggio ancora, il comportamento cambia tra
    // versioni di browser. Forzandolo, il totale del credito si legge sempre
    // allo stesso modo su tutti i dispositivi.
    useGrouping: 'always',
  }).format(importoCent / 100);

  return opzioni?.segnoPiu && importoCent > 0 ? `+${testo}` : testo;
}

/**
 * Come si scrive un importo **dentro un campo di testo**: "12,50", senza
 * simbolo e senza separatore delle migliaia.
 *
 * Esiste perché `formatEuro` non va bene qui: produce "1.234,50 €", che
 * rimesso in `parseEuro` non torna indietro. Il giro `centesimiInCampo` →
 * `parseEuro` invece è chiuso, ed è quello che serve a un campo precompilato
 * che l'utente può correggere.
 *
 * Non divide per 100: taglia le ultime due cifre dell'intero. Nessun numero
 * con la virgola viene mai creato, quindi non c'è niente da arrotondare
 * (DEC-04).
 */
export function centesimiInCampo(importoCent: number): string {
  const valore = Math.abs(centesimi(importoCent));
  const cifre = String(valore).padStart(3, '0');
  return `${cifre.slice(0, -2)},${cifre.slice(-2)}`;
}

/** Somma una lista di importi restando nel dominio degli interi. */
export function sommaCentesimi(valori: readonly number[]): Centesimi {
  return centesimi(valori.reduce((acc, v) => acc + v, 0));
}

/** Moltiplica un prezzo unitario per una quantità (che può essere negativa negli storni). */
export function moltiplica(prezzoUnitarioCent: number, quantita: number): Centesimi {
  if (!Number.isInteger(quantita)) {
    throw new Error(`Quantità non intera: ${quantita}.`);
  }
  return centesimi(prezzoUnitarioCent * quantita);
}

/** Inverte il segno di un importo: serve a costruire gli storni. */
export function inverti(importoCent: number): Centesimi {
  return centesimi(-importoCent);
}

/**
 * Come si legge un saldo.
 * Positivo = il cliente deve soldi. Zero = in pari. Negativo = ha un acconto a credito.
 */
export type StatoSaldo = 'deve' | 'in_pari' | 'acconto';

export function statoSaldo(saldoCent: number): StatoSaldo {
  if (saldoCent > 0) return 'deve';
  if (saldoCent < 0) return 'acconto';
  return 'in_pari';
}

/** Testo pronto per l'interfaccia, es. "deve 24,50 €". */
export function descriviSaldo(saldoCent: number): string {
  switch (statoSaldo(saldoCent)) {
    case 'deve':
      return `deve ${formatEuro(saldoCent)}`;
    case 'acconto':
      return `acconto di ${formatEuro(-saldoCent)}`;
    case 'in_pari':
      return 'in pari';
  }
}
