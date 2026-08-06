/**
 * Spostare una consumazione da un cliente a un altro.
 *
 * IL CASO REALE. Michele ha preso tre caffè a credito. Passa Luca e dice
 * "uno glielo offro io". Il caffè è già stato bevuto e già registrato: non
 * si può tornare indietro e ribattere il conto.
 *
 * PERCHÉ NON SI SPOSTA LA RIGA. L'istinto direbbe di cambiare il `conto_id`
 * di quella riga. Sarebbe una modifica di un movimento registrato, contro
 * DEC-03, e soprattutto farebbe **sparire** quel caffè dallo storico di
 * Michele: quando fra due settimane chiede "ma io tre caffè li ho presi?",
 * la risposta non sarebbe più sullo schermo.
 *
 * COME SI FA INVECE. Due movimenti, come per ogni correzione in questo
 * sistema: uno storno di un pezzo sul conto di Michele, e un addebito di un
 * pezzo a Luca **allo stesso prezzo congelato** (DEC-05). Il debito si
 * sposta davvero, e su entrambi gli estratti conto si legge cosa è successo.
 *
 * Funzioni pure: niente React, niente Supabase (CLAUDE.md).
 */

export interface RigaSpostabile {
  id: string;
  contoId: string;
  descrizione: string;
  prezzoUnitarioCent: number;
  /** quanti pezzi ha la riga originale */
  quantita: number;
  /** quanti pezzi sono già stati stornati o spostati via */
  quantitaGiaStornata: number;
  /** true se questa riga è essa stessa uno storno */
  eStorno: boolean;
}

export type EsitoSpostamento =
  | { valido: false; errore: string }
  | {
      valido: true;
      quantita: number;
      /** quanto viene tolto all'origine e addebitato alla destinazione */
      importoCent: number;
      /** quanti pezzi restano sull'origine dopo questo spostamento */
      restantiCent: number;
    };

/** Quanti pezzi di questa riga si possono ancora spostare. */
export function pezziSpostabili(riga: RigaSpostabile): number {
  if (riga.eStorno) return 0;
  return Math.max(0, riga.quantita - riga.quantitaGiaStornata);
}

export function verificaSpostamento(dati: {
  riga: RigaSpostabile;
  quantita: number;
  clienteOrigineId: string;
  clienteDestinazioneId: string | null;
}): EsitoSpostamento {
  const { riga, quantita, clienteOrigineId, clienteDestinazioneId } = dati;

  if (riga.eStorno) {
    return { valido: false, errore: 'Questa riga è già uno storno: non si sposta.' };
  }

  if (clienteDestinazioneId === null) {
    // Il banco non è una persona: non ha un conto a cui addebitare, perché
    // paga subito. Offrire "sul banco" vorrebbe dire regalare, ed è
    // un'operazione diversa che non esiste ancora.
    return {
      valido: false,
      errore: 'Scegli a chi intestarlo: al banco non si può addebitare niente.',
    };
  }

  if (clienteDestinazioneId === clienteOrigineId) {
    return { valido: false, errore: 'È già intestato a questa persona.' };
  }

  if (!Number.isInteger(quantita) || quantita < 1) {
    return { valido: false, errore: 'Scegli quanti pezzi spostare.' };
  }

  const disponibili = pezziSpostabili(riga);

  if (disponibili === 0) {
    return { valido: false, errore: 'Di questa riga non resta niente da spostare.' };
  }

  if (quantita > disponibili) {
    return {
      valido: false,
      errore: `Ne restano solo ${disponibili} da spostare.`,
    };
  }

  return {
    valido: true,
    quantita,
    importoCent: riga.prezzoUnitarioCent * quantita,
    restantiCent: riga.prezzoUnitarioCent * (disponibili - quantita),
  };
}

/**
 * Come si legge lo spostamento prima di confermarlo.
 * Serve a dire ad alta voce chi paga cosa, perché è un'operazione che si fa
 * davanti a due clienti e non deve esserci equivoco su chi ha offerto.
 */
export function descriviSpostamento(dati: {
  descrizione: string;
  quantita: number;
  nomeOrigine: string;
  nomeDestinazione: string;
}): string {
  const cosa = dati.quantita === 1 ? dati.descrizione : `${dati.descrizione} ×${dati.quantita}`;
  return `${cosa}: da ${dati.nomeOrigine} a ${dati.nomeDestinazione}`;
}
