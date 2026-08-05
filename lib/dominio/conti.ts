/**
 * Regole pure sui **conti già registrati**. Niente React, niente Supabase.
 *
 * ⚠️ AL MOMENTO NON USATO DALLE SCHERMATE.
 *
 * Questo modulo è stato scritto quando le righe venivano registrate mentre si
 * componeva il conto. DEC-08 ha cambiato quel modello: adesso si compone una
 * bozza locale (`lib/dominio/bozza.ts`) e si registra tutto alla conferma,
 * quindi dalla schermata del conto non si modifica più niente di registrato.
 *
 * Non è stato eliminato perché serve a due cose già previste:
 *
 *   - `raggruppaRighe` per l'estratto conto del cliente (T-14), dove le righe
 *     registrate vanno mostrate raggruppate
 *   - `comeDiminuire` per correggere un conto **dopo** la conferma: caso non
 *     ancora progettato, ma inevitabile prima del collaudo T-18
 *
 * Se a T-14 dovesse risultare inutile, va cancellato invece che tenuto per
 * affezione: 18 test su codice morto sono peggio di nessun test.
 *
 * ---
 *
 * IL MODELLO DELLE QUANTITÀ per le righe registrate.
 *
 * `04-UX-MOBILE.md` diceva "il tap ripetuto incrementa la quantità della riga
 * esistente". Ma DEC-03 dice che le righe sono immutabili, e incrementare una
 * quantità è una modifica: le due regole non potevano valere insieme.
 *
 * La contraddizione è emersa quando è servito **diminuire**.
 *
 * Risoluzione: **ogni tap crea una riga da un'unità.** Non si modifica mai
 * niente. Le righe vengono raggruppate solo per essere mostrate — "Ichnusa ×2"
 * a schermo sono due righe nel database, ognuna con la sua ora esatta.
 *
 * Diminuire diventa allora una domanda con due risposte, e il confine è già
 * scritto nel database (trigger `blocca_cancellazione_riga`):
 *
 *   entro 60 secondi  → è un errore di battitura: la riga si cancella davvero
 *   dopo 60 secondi   → è storia: si aggiunge uno storno di segno opposto
 *
 * Sessanta secondi separano "ho sbagliato a battere" da "il cliente ha
 * cambiato idea". La prima cosa non deve lasciare traccia, la seconda sì.
 */

export const SECONDI_PER_CORREGGERE = 60;

/** La forma minima di riga che serve a queste funzioni. */
export interface RigaMinima {
  id: string;
  prodottoId: string | null;
  descrizione: string;
  prezzoUnitarioCent: number;
  quantita: number;
  /** valorizzato se questa riga è lo storno di un'altra */
  stornoDi: string | null;
  creatoIl: number;
}

export interface GruppoRighe {
  chiave: string;
  descrizione: string;
  prezzoUnitarioCent: number;
  /** quantità netta: le unità aggiunte meno quelle stornate */
  quantita: number;
  importoCent: number;
  /** id delle righe che compongono il gruppo, dalla più recente */
  righeIds: string[];
}

/** Due righe finiscono nello stesso gruppo se sono lo stesso prodotto allo stesso prezzo. */
export function chiaveGruppo(r: RigaMinima): string {
  return `${r.prodottoId ?? r.descrizione}|${r.prezzoUnitarioCent}`;
}

/**
 * Raggruppa le righe per la visualizzazione.
 *
 * Gli storni non compaiono come voci a sé: abbassano la quantità del loro
 * gruppo. La schermata del conto serve a lavorare, non a fare l'istruttoria —
 * la storia completa, storni inclusi, resta nell'estratto conto del cliente.
 *
 * Un gruppo che arriva a zero sparisce: mostrare "Ichnusa ×0" non aiuta
 * nessuno.
 */
export function raggruppaRighe(righe: readonly RigaMinima[]): GruppoRighe[] {
  const gruppi = new Map<string, GruppoRighe>();
  const ordinate = [...righe].sort((a, b) => b.creatoIl - a.creatoIl);

  for (const r of ordinate) {
    const chiave = chiaveGruppo(r);
    const esistente = gruppi.get(chiave);

    if (esistente) {
      esistente.quantita += r.quantita;
      esistente.importoCent += r.quantita * r.prezzoUnitarioCent;
      esistente.righeIds.push(r.id);
    } else {
      gruppi.set(chiave, {
        chiave,
        descrizione: r.descrizione,
        prezzoUnitarioCent: r.prezzoUnitarioCent,
        quantita: r.quantita,
        importoCent: r.quantita * r.prezzoUnitarioCent,
        righeIds: [r.id],
      });
    }
  }

  return [...gruppi.values()].filter((g) => g.quantita !== 0);
}

/** Totale del conto: somma di tutte le righe, storni compresi. */
export function totaleConto(righe: readonly RigaMinima[]): number {
  return righe.reduce((somma, r) => somma + r.quantita * r.prezzoUnitarioCent, 0);
}

export type AzioneDiminuisci =
  | { tipo: 'elimina'; rigaId: string }
  | { tipo: 'storna'; rigaId: string };

/**
 * Che cosa fare per togliere un'unità da un gruppo.
 *
 * Sceglie la riga **più recente** ancora valida: se il barista ha battuto tre
 * caffè e ne toglie uno, è l'ultimo che ha sbagliato, non il primo. Ed è anche
 * l'unico che ha buone probabilità di rientrare nei 60 secondi.
 *
 * Restituisce `null` se non c'è niente da togliere.
 */
export function comeDiminuire(
  righe: readonly RigaMinima[],
  chiave: string,
  adesso: number = Date.now(),
): AzioneDiminuisci | null {
  const gia = new Set(righe.map((r) => r.stornoDi).filter((x): x is string => x !== null));

  const candidate = righe
    .filter((r) => chiaveGruppo(r) === chiave)
    .filter((r) => r.quantita > 0) // gli storni non si stornano
    .filter((r) => !gia.has(r.id)) // una riga si storna una volta sola
    .sort((a, b) => b.creatoIl - a.creatoIl);

  const riga = candidate[0];
  if (!riga) return null;

  const eta = (adesso - riga.creatoIl) / 1000;
  return eta <= SECONDI_PER_CORREGGERE
    ? { tipo: 'elimina', rigaId: riga.id }
    : { tipo: 'storna', rigaId: riga.id };
}

/**
 * Secondi che restano per cancellare senza lasciare traccia.
 * Serve all'interfaccia per decidere se mostrare la ✕ o la pressione lunga.
 */
export function secondiPerCorreggere(riga: RigaMinima, adesso: number = Date.now()): number {
  const trascorsi = (adesso - riga.creatoIl) / 1000;
  return Math.max(0, Math.ceil(SECONDI_PER_CORREGGERE - trascorsi));
}
