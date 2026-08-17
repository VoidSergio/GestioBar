/**
 * Esportazione CSV (T-24).
 *
 * IL CRITERIO È "SI APRE IN EXCEL", NON "È UN CSV VALIDO". Sono due cose
 * diverse, e la seconda non basta:
 *
 *  - **il separatore è il punto e virgola.** Excel in italiano legge la
 *    virgola come separatore decimale, quindi con le virgole `12,50` finisce
 *    in due colonne. Non è configurabile dal file, se non con la riga
 *    `sep=;` — che però altri programmi mostrano come una riga di dati;
 *  - **il decimale è la virgola.** Un importo con il punto viene letto come
 *    testo, e la colonna non si somma. È il motivo per cui questo file
 *    esiste invece di un `join(',')`;
 *  - **il file comincia con il BOM.** Senza, Excel apre in ANSI e "Caffè"
 *    diventa "CaffÃ¨" in ogni riga;
 *  - **le date si scrivono 12/08/2026.** In formato ISO Excel le tratta come
 *    testo e non le ordina.
 *
 * Nessuna divisione per 100: gli importi arrivano interi in centesimi e la
 * virgola si mette tagliando le ultime due cifre, come in `centesimiInCampo`
 * (DEC-04).
 */

import { centesimiInCampo } from './denaro';

/** Il separatore di colonna che Excel italiano si aspetta. */
export const SEPARATORE = ';';

/**
 * Il carattere invisibile che dice a Excel "questo file è UTF-8".
 * Senza, gli accenti saltano.
 */
const BOM = '﻿';

/**
 * Mette al riparo una cella.
 *
 * Le virgolette si raddoppiano, e si racchiude tutto quando dentro c'è un
 * separatore, una virgoletta o un a capo. Un nome come `Franco "Ciccio"`
 * senza questo spezza la riga in tre colonne.
 */
export function cellaCsv(valore: string): string {
  const serve = valore.includes(SEPARATORE) || valore.includes('"') || /[\r\n]/.test(valore);
  const pulito = valore.replace(/"/g, '""');
  return serve ? `"${pulito}"` : pulito;
}

/** Un importo in centesimi come lo legge Excel italiano: `1234,50`. */
export function importoCsv(centesimi: number): string {
  const testo = centesimiInCampo(centesimi);
  return centesimi < 0 ? `-${testo}` : testo;
}

/**
 * Una giornata `2026-08-12` diventa `12/08/2026`.
 *
 * Si lavora sulla stringa e non su `Date`: la data arriva già come giornata
 * locale dal database, e passarla da `new Date()` la farebbe rimbalzare
 * sull'UTC per tornare indietro di un giorno a seconda dell'ora.
 */
export function dataCsv(giornata: string): string {
  const pezzi = giornata.slice(0, 10).split('-');
  if (pezzi.length !== 3) return giornata;
  return `${pezzi[2]}/${pezzi[1]}/${pezzi[0]}`;
}

/**
 * Compone il file.
 *
 * A capo `\r\n`, che è quello che lo standard CSV chiede e che Excel su
 * Windows si aspetta.
 */
export function componiCsv(
  intestazioni: readonly string[],
  righe: readonly (readonly string[])[],
): string {
  const tutte = [intestazioni, ...righe];
  return BOM + tutte.map((r) => r.map(cellaCsv).join(SEPARATORE)).join('\r\n') + '\r\n';
}

/**
 * Il nome del file: `bar-giornate-2026-08-01_2026-08-12.csv`.
 *
 * Con le date dentro, perché tre esportazioni nella cartella Download che si
 * chiamano tutte `report.csv` non si distinguono più.
 */
export function nomeFile(cosa: string, da: string, a: string): string {
  return da === a ? `bar-${cosa}-${da}.csv` : `bar-${cosa}-${da}_${a}.csv`;
}
