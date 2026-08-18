/**
 * Il magazzino: quantità, scorte, inventario.
 *
 * LE QUANTITÀ SONO INTERI IN MILLESIMI, per la stessa ragione per cui il
 * denaro è in centesimi (DEC-04). Un caffè scarica 7 g di grani; duecento
 * caffè al giorno per un mese sono seimila somme, e con i decimali in virgola
 * mobile la giacenza comincia a finire con ,00000000004. Poi la si confronta
 * con l'inventario contato a mano e non torna mai, e nessuno capisce perché.
 *
 * `1250` vuol dire 1,250 kg. Un millesimo è un grammo, un millilitro, un
 * millesimo di pezzo.
 *
 * **Qui dentro non si divide mai.** La virgola si mette tagliando le ultime
 * tre cifre dell'intero, come fa `centesimiInCampo` con i centesimi: nessun
 * numero con la virgola viene mai creato, quindi non c'è niente da
 * arrotondare.
 */

/** Millesimi in un'unità. Serve a leggere il codice, non a dividere. */
export const MILLE = 1000;

export type Unita = 'pz' | 'kg' | 'l' | 'conf';

export const UNITA: ReadonlyArray<{ valore: Unita; etichetta: string; esteso: string }> = [
  { valore: 'pz', etichetta: 'pz', esteso: 'pezzi' },
  { valore: 'kg', etichetta: 'kg', esteso: 'chilogrammi' },
  { valore: 'l', etichetta: 'l', esteso: 'litri' },
  { valore: 'conf', etichetta: 'conf', esteso: 'confezioni' },
];

/**
 * Pezzi e confezioni si contano interi.
 *
 * Non è pignoleria: se il tastierino trattasse i pezzi come i chili, battere
 * "3" darebbe 0,003 bottiglie. Chi carica bottiglie scrive tre e intende tre.
 */
export function interaSoltanto(unita: Unita): boolean {
  return unita === 'pz' || unita === 'conf';
}

/** Le tre cifre decimali e la parte intera, separate senza dividere. */
function spezza(milli: number): { intero: string; decimali: string } {
  const cifre = String(Math.abs(Math.trunc(milli))).padStart(4, '0');
  return { intero: cifre.slice(0, -3), decimali: cifre.slice(-3) };
}

/**
 * Come si legge una quantità: `1,25 kg`, `3 pz`, `-0,5 l`.
 *
 * Gli zeri finali si tolgono — "5,000 l" si legge peggio di "5 l" e non dice
 * niente in più. Le unità intere non mostrano mai decimali.
 */
export function formatQuantita(milli: number, unita: Unita): string {
  const segno = milli < 0 ? '-' : '';
  const { intero, decimali } = spezza(milli);

  if (interaSoltanto(unita)) return `${segno}${intero} ${unita}`;

  const utili = decimali.replace(/0+$/, '');
  return utili === ''
    ? `${segno}${intero} ${unita}`
    : `${segno}${intero},${utili} ${unita}`;
}

/**
 * Le cifre digitate diventano una quantità.
 *
 * Stesso principio del tastierino degli importi: le cifre entrano da destra e
 * la virgola non si scrive mai. Quello che cambia è **quanto vale l'ultima
 * cifra**: un millesimo per chili e litri, un pezzo intero per pezzi e
 * confezioni.
 *
 *   kg → "1250" = 1,250 kg
 *   pz → "3"    = 3 pz
 */
export function cifreInMilli(cifre: string, unita: Unita): number {
  // Sette cifre bastano a 9.999,999 kg: oltre, in un bar, non c'è magazzino.
  const pulite = (cifre.match(/\d/g) ?? []).join('').slice(0, 7);
  if (pulite === '') return 0;

  const valore = Number(pulite);
  return interaSoltanto(unita) ? valore * MILLE : valore;
}

/** L'anteprima mentre si digita, senza unità: `1,250` oppure `3`. */
export function anteprimaQuantita(cifre: string, unita: Unita): string {
  const milli = cifreInMilli(cifre, unita);
  if (interaSoltanto(unita)) return spezza(milli).intero;

  const { intero, decimali } = spezza(milli);
  return `${intero},${decimali}`;
}

/* ------------------------------------------------------- i movimenti */

export type TipoMovimento = 'carico' | 'scarico' | 'rettifica' | 'scarto';

export const MOVIMENTI: ReadonlyArray<{
  tipo: TipoMovimento;
  etichetta: string;
  spiegazione: string;
  /** Il segno che il database impone (0020, vincolo `segno_coerente_col_tipo`). */
  segno: 1 | -1 | 0;
}> = [
  { tipo: 'carico', etichetta: 'Carico', spiegazione: 'È arrivata merce', segno: 1 },
  { tipo: 'scarto', etichetta: 'Scarto', spiegazione: 'Rotto, scaduto, buttato', segno: -1 },
  {
    tipo: 'rettifica',
    etichetta: 'Correzione',
    spiegazione: 'Il conto non torna e lo sistemi a mano',
    segno: 0,
  },
];

/**
 * Il valore da scrivere sul movimento, con il segno giusto.
 *
 * Chi registra uno scarto batte "2 bottiglie", non "meno due": il segno lo
 * mette il programma, perché è una regola del database e non una cosa da
 * ricordarsi con la fila davanti.
 */
export function conSegno(tipo: TipoMovimento, quantitaMilli: number): number {
  const assoluto = Math.abs(quantitaMilli);
  if (tipo === 'carico') return assoluto;
  if (tipo === 'scarico' || tipo === 'scarto') return -assoluto;
  return quantitaMilli;
}

/* --------------------------------------------------------- le scorte */

export interface RigaGiacenza {
  id: string;
  nome: string;
  unita: Unita;
  scorta_minima_milli: number;
  giacenza_milli: number;
  sotto_scorta: boolean;
  mai_movimentato: boolean;
  fornitore: string | null;
}

/**
 * Che cosa va comprato.
 *
 * Un articolo creato e mai caricato **non** è da comprare: è un'anagrafica
 * appena scritta, e metterla fra le urgenze riempirebbe l'elenco di roba che
 * non è mai entrata in magazzino. Chi ha scorta minima zero non ha chiesto
 * di essere avvisato.
 */
export function daRiordinare<T extends RigaGiacenza>(giacenze: readonly T[]): T[] {
  return giacenze
    .filter((g) => !g.mai_movimentato)
    .filter((g) => g.giacenza_milli < 0 || (g.scorta_minima_milli > 0 && g.sotto_scorta))
    .sort((a, b) => scarto(a) - scarto(b) || a.nome.localeCompare(b.nome, 'it'));
}

/**
 * Quanto manca alla scorta minima, in millesimi. Più è negativo, più è
 * urgente — e una giacenza sotto zero viene prima di tutto, perché vuol dire
 * che è stato venduto più di quello che risultava esserci.
 */
function scarto(g: RigaGiacenza): number {
  return g.giacenza_milli - g.scorta_minima_milli;
}

/** L'ordine dell'elenco: prima quello che serve, poi in ordine alfabetico. */
export function ordinaGiacenze<T extends RigaGiacenza>(giacenze: readonly T[]): T[] {
  const urgenti = new Set(daRiordinare(giacenze).map((g) => g.id));

  return [...giacenze].sort((a, b) => {
    const ua = urgenti.has(a.id);
    const ub = urgenti.has(b.id);
    if (ua !== ub) return ua ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'it');
  });
}

/* ------------------------------------------------------ l'inventario */

/**
 * La rettifica da scrivere dopo aver contato (T-36).
 *
 * **È la differenza, non il valore contato.** Scrivere il contato come
 * movimento sarebbe l'errore che rompe tutto: i movimenti si sommano, quindi
 * un "contato 1,000 kg" registrato come movimento aggiungerebbe un chilo a
 * quello che c'era già.
 *
 * Zero vuol dire che l'inventario tornava, e in quel caso non si scrive
 * niente: un movimento da zero è vietato dal database, e giustamente — una
 * riga che non muove niente è solo rumore nello storico.
 */
export function differenzaInventario(contatoMilli: number, giacenzaMilli: number): number {
  return contatoMilli - giacenzaMilli;
}

/**
 * Come si legge lo scarto di un inventario, per chi lo sta facendo.
 *
 * "Mancano" e "avanzano" invece di più e meno: davanti a uno scaffale, con il
 * telefono in una mano, un segno meno si legge male e si interpreta peggio.
 */
export function descriviInventario(differenzaMilli: number, unita: Unita): string {
  if (differenzaMilli === 0) return 'Torna';
  const quanto = formatQuantita(Math.abs(differenzaMilli), unita);
  return differenzaMilli < 0 ? `Mancano ${quanto}` : `Avanzano ${quanto}`;
}
