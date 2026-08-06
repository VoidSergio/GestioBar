/**
 * La bozza di un conto: quello che stai battendo, prima di confermarlo.
 *
 * PERCHÉ ESISTE (DEC-08).
 *
 * Mentre componi un conto non stai facendo contabilità: stai prendendo
 * un'ordinazione. Se sbagli devi poter correggere liberamente, senza che
 * l'app registri il tuo errore da qualche parte.
 *
 * Quindi la bozza vive sul dispositivo — in IndexedDB, non solo in memoria,
 * così sopravvive a telefono spento, schermo bloccato, browser chiuso — e
 * diventa un conto vero **solo alla conferma**, con un unico invio.
 *
 * Conseguenze, buone e cattive:
 *
 *   + Correggi come vuoi: niente storni, niente tracce di ripensamenti
 *   + Due chiamate al server per conto invece di una per prodotto
 *   + Se il telefono muore, la bozza è ancora lì
 *   − La bozza vive su un solo dispositivo: due baristi non possono lavorare
 *     sullo stesso conto. Si risolverà in Fase 4 spostandola su Supabase.
 *
 * Nota sull'immutabilità: DEC-03 non viene violata. Vale su ciò che è stato
 * registrato, e una bozza non lo è ancora. Dal momento della conferma in poi
 * le righe tornano intoccabili e le correzioni passano dagli storni.
 */

export interface VoceBozza {
  /** id definitivo della futura riga: lo genera il dispositivo (02-MODELLO-DATI §2) */
  id: string;
  prodottoId: string | null;
  descrizione: string;
  prezzoUnitarioCent: number;
  quantita: number;
  /**
   * Quando è stato battuto il primo pezzo di questa voce.
   *
   * Finisce in `righe_conto.creato_il`. Senza, il database userebbe il momento
   * in cui la riga arriva al server: dopo mezz'ora senza rete, i tre caffè
   * delle sette risulterebbero venduti alle sette e mezza.
   *
   * È l'orario del primo tap, non dell'ultimo: due caffè sono una riga ×2
   * (vedi `aggiungi`), quindi l'orario è quello in cui l'ordinazione è
   * cominciata. Per il ritmo della giornata è la cosa giusta.
   */
  battutaIl: number;
}

export interface Bozza {
  /** id definitivo del futuro conto */
  id: string;
  clienteId: string | null;
  /** nome mostrato in elenco: "Mario Rossi" oppure "Banco" */
  etichetta: string;
  voci: VoceBozza[];
  apertaIl: number;
  aggiornataIl: number;
}

export function nuovaBozza(
  id: string,
  clienteId: string | null,
  etichetta: string,
  adesso: number = Date.now(),
): Bozza {
  return { id, clienteId, etichetta, voci: [], apertaIl: adesso, aggiornataIl: adesso };
}

export interface ProdottoScelto {
  /** id della riga da creare, generato dal dispositivo */
  idRiga: string;
  prodottoId: string | null;
  descrizione: string;
  prezzoUnitarioCent: number;
}

/** Due voci sono la stessa cosa se sono lo stesso prodotto allo stesso prezzo. */
function stessaVoce(v: VoceBozza, p: { prodottoId: string | null; prezzoUnitarioCent: number; descrizione: string }) {
  return (
    (v.prodottoId ?? v.descrizione) === (p.prodottoId ?? p.descrizione) &&
    v.prezzoUnitarioCent === p.prezzoUnitarioCent
  );
}

/**
 * Aggiunge un'unità.
 *
 * Se il prodotto c'è già, sale la quantità della voce esistente: due caffè
 * sono **una riga ×2**, non due righe. Qui si può, perché niente è ancora
 * registrato.
 */
export function aggiungi(bozza: Bozza, scelto: ProdottoScelto, adesso = Date.now()): Bozza {
  const indice = bozza.voci.findIndex((v) => stessaVoce(v, scelto));

  if (indice >= 0) {
    const voci = [...bozza.voci];
    const voce = voci[indice]!;
    voci[indice] = { ...voce, quantita: voce.quantita + 1 };
    return { ...bozza, voci, aggiornataIl: adesso };
  }

  return {
    ...bozza,
    voci: [
      {
        id: scelto.idRiga,
        prodottoId: scelto.prodottoId,
        descrizione: scelto.descrizione,
        prezzoUnitarioCent: scelto.prezzoUnitarioCent,
        quantita: 1,
        battutaIl: adesso,
      },
      ...bozza.voci,
    ],
    aggiornataIl: adesso,
  };
}

/** Toglie un'unità. La voce sparisce quando arriva a zero. */
export function diminuisci(bozza: Bozza, idVoce: string, adesso = Date.now()): Bozza {
  const voci = bozza.voci
    .map((v) => (v.id === idVoce ? { ...v, quantita: v.quantita - 1 } : v))
    .filter((v) => v.quantita > 0);

  return { ...bozza, voci, aggiornataIl: adesso };
}

/** Toglie l'intera voce, qualunque sia la quantità. */
export function togliVoce(bozza: Bozza, idVoce: string, adesso = Date.now()): Bozza {
  return { ...bozza, voci: bozza.voci.filter((v) => v.id !== idVoce), aggiornataIl: adesso };
}

export function totaleBozza(bozza: Bozza): number {
  return bozza.voci.reduce((somma, v) => somma + v.quantita * v.prezzoUnitarioCent, 0);
}

export function quantiPezzi(bozza: Bozza): number {
  return bozza.voci.reduce((somma, v) => somma + v.quantita, 0);
}

export function eVuota(bozza: Bozza): boolean {
  return bozza.voci.length === 0;
}

/**
 * Le bozze in ordine di apertura, dalla più recente.
 * È l'ordine della home: l'ultimo conto aperto è quello a cui stai lavorando.
 */
export function ordinaBozze(bozze: readonly Bozza[]): Bozza[] {
  return [...bozze].sort((a, b) => b.apertaIl - a.apertaIl);
}

/** Totale di tutte le bozze aperte: quanto vale il banco in questo momento. */
export function totaleBozzeAperte(bozze: readonly Bozza[]): number {
  return bozze.reduce((somma, b) => somma + totaleBozza(b), 0);
}
