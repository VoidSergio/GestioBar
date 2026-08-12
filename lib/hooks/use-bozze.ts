'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  aggiungi,
  assegnaCliente,
  bozzaAlBanco,
  etichettaBanco,
  diminuisci,
  nuovaBozza,
  ordinaBozze,
  togliVoce,
  totaleBozza,
  unisci,
  type Bozza,
  type ProdottoScelto,
} from '@/lib/dominio/bozza';
import {
  ascoltaBozze,
  bozzaDelCliente,
  eliminaBozza,
  leggiBozza,
  leggiBozze,
  salvaBozza,
} from '@/lib/offline/bozze';
import { accoda } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';
import { aggiornaSaldoInCache } from './use-clienti';
import { nuovoId } from '@/lib/utils';

/** Tutte le bozze aperte, in ordine dalla più recente. */
export function useBozze() {
  const [bozze, setBozze] = useState<Bozza[]>([]);
  const [caricato, setCaricato] = useState(false);

  useEffect(
    () =>
      ascoltaBozze((b) => {
        setBozze(ordinaBozze(b));
        setCaricato(true);
      }),
    [],
  );

  return { bozze, caricato };
}

/** Una singola bozza, con le operazioni per modificarla. */
export function useBozza(id: string) {
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [caricata, setCaricata] = useState(false);

  useEffect(() => {
    let vivo = true;
    void leggiBozza(id).then((b) => {
      if (!vivo) return;
      setBozza(b);
      setCaricata(true);
    });
    // Le modifiche fatte altrove (per esempio la conferma) devono arrivare qui
    const smetti = ascoltaBozze((tutte) => setBozza(tutte.find((b) => b.id === id) ?? null));
    return () => {
      vivo = false;
      smetti();
    };
  }, [id]);

  /**
   * Ogni modifica aggiorna prima lo schermo e poi IndexedDB.
   * Scrivere su disco richiede qualche millisecondo: aspettarlo per mostrare
   * una riga violerebbe il vincolo dei 100 ms.
   */
  function applica(trasforma: (b: Bozza) => Bozza) {
    setBozza((attuale) => {
      if (!attuale) return attuale;
      const nuova = trasforma(attuale);
      void salvaBozza(nuova);
      return nuova;
    });
  }

  return {
    bozza,
    caricata,
    aggiungiProdotto: (scelto: ProdottoScelto) => applica((b) => aggiungi(b, scelto)),
    diminuisciVoce: (idVoce: string) => applica((b) => diminuisci(b, idVoce)),
    togliVoce: (idVoce: string) => applica((b) => togliVoce(b, idVoce)),
  };
}

/**
 * Il conto al banco che la schermata di apertura tiene sempre pronto.
 *
 * Se non ce n'è uno, lo crea. È l'unica creazione automatica dell'app, ed è
 * quello che permette di battere un caffè al primo tocco dopo aver aperto:
 * non c'è nessuna domanda prima della griglia.
 *
 * Una bozza vuota non costa niente — non tocca il database, non compare fra
 * i conti aperti (`contiInAttesa` la scarta) e alla conferma diventa un conto
 * solo se ci hai battuto dentro qualcosa.
 */
export function useBanco(): { id: string | null; caricato: boolean } {
  const { bozze, caricato } = useBozze();
  /**
   * IL CONTO IN CORSO SI TIENE, NON SI RICALCOLA.
   *
   * La prima versione derivava l'id a ogni render con `bozzaAlBanco(bozze)`,
   * cioè "la bozza senza cliente". Sembrava equivalente, e per un minuto lo
   * è: finché il conto è anonimo. Ma nell'istante in cui gli si dà un nome
   * quella bozza smette di essere "senza cliente", `bozzaAlBanco` non la
   * trova più, l'effetto ne apre una vuota e la schermata passa a quella —
   * con l'ordinazione appena intestata che scompare davanti agli occhi.
   *
   * Il conto in corso è uno stato, non una conseguenza: si tiene finché
   * esiste, comunque si chiami. Se ne cerca un altro solo quando quello di
   * prima è sparito, cioè dopo una conferma o dopo che è stato svuotato.
   */
  const [fissato, setFissato] = useState<string | null>(null);
  // Senza questo, il doppio giro degli effetti in sviluppo aprirebbe due
  // conti invece di uno.
  const staCreando = useRef(false);

  // Finché il conto fissato esiste è quello, comunque si chiami adesso.
  // Se è sparito — confermato o svuotato — se ne prende un altro senza
  // cliente, e se non ce n'è nessuno l'effetto qui sotto lo apre.
  const corrente =
    fissato !== null && bozze.some((b) => b.id === fissato)
      ? fissato
      : (bozzaAlBanco(bozze)?.id ?? null);

  // Aggiustamento di stato durante il render: è il modo che React indica per
  // tenere allineato uno stato a qualcosa che è cambiato, e costa un render
  // in meno di un effetto.
  if (corrente !== fissato) setFissato(corrente);

  useEffect(() => {
    if (!caricato || corrente !== null || staCreando.current) return;
    staCreando.current = true;
    void salvaBozza(nuovaBozza(nuovoId(), null, etichettaBanco(bozze))).finally(() => {
      staCreando.current = false;
    });
  }, [caricato, corrente, bozze]);

  return { id: corrente, caricato };
}

/**
 * Dà un nome a un conto che stava andando al banco.
 *
 * Se quel cliente ha già un conto aperto, le voci ci finiscono dentro invece
 * di aprirgliene un secondo (04-UX-MOBILE.md §4).
 *
 * **Restituisce la bozza aggiornata, non solo il suo id.** Chi chiama deve
 * poterla usare subito: la copia che ha in mano è di prima dell'assegnazione
 * e non ha il cliente dentro. Una chiusura fatta con quella registra il conto
 * a nessuno — è esattamente il bug del 12 agosto (`09-DIARIO.md`).
 */
export function useAssegnaCliente() {
  return async function assegna(
    bozza: Bozza,
    clienteId: string | null,
    etichetta: string,
  ): Promise<Bozza> {
    if (clienteId) {
      const esistente = await bozzaDelCliente(clienteId);
      if (esistente && esistente.id !== bozza.id) {
        const unita = unisci(esistente, bozza);
        await salvaBozza(unita);
        await eliminaBozza(bozza.id);
        return unita;
      }
    }

    const aggiornata = assegnaCliente(bozza, clienteId, etichetta);
    await salvaBozza(aggiornata);
    return aggiornata;
  };
}

export function useApriConto() {
  return async function apri(clienteId: string | null, etichetta: string): Promise<string> {
    // Se il cliente ha già un conto aperto ci si entra dentro, invece di
    // crearne un secondo: non è un errore, è la cosa giusta
    // (04-UX-MOBILE.md §4).
    if (clienteId) {
      const esistente = await bozzaDelCliente(clienteId);
      if (esistente) return esistente.id;
    }

    // Due conti al banco aperti insieme devono avere due nomi diversi,
    // altrimenti nella striscia in cima sono la stessa etichetta.
    const nome = clienteId === null ? etichettaBanco(await leggiBozze()) : etichetta;

    const bozza = nuovaBozza(nuovoId(), clienteId, nome);
    await salvaBozza(bozza);
    return bozza.id;
  };
}

export type ModoConferma =
  | { tipo: 'a_credito' }
  | {
      tipo: 'incassato';
      /**
       * Quanto si registra come pagamento. Non è per forza il totale del
       * conto: può essere di meno (paga in parte) o di più (salda anche il
       * debito vecchio). Deve arrivare già verificato da
       * `verificaChiusuraConto`, che è dove sta la regola.
       */
      importoCent: number;
      metodo: string;
      scontrinoBattuto: boolean;
    };

/**
 * Trasforma una bozza in un conto vero (DEC-08).
 *
 * Un'unica operazione in coda porta intestazione, righe ed eventuale
 * pagamento. La bozza sparisce solo dopo che l'operazione è stata accodata:
 * se il telefono muore in mezzo, al riavvio la bozza è ancora lì.
 */
export function useConfermaConto() {
  const queryClient = useQueryClient();

  return async function conferma(bozza: Bozza, modo: ModoConferma): Promise<void> {
    const totale = totaleBozza(bozza);
    // Gli orari li fissa il dispositivo adesso, non il server al momento
    // dell'arrivo: offline la differenza può essere di ore.
    const confermatoIl = new Date().toISOString();

    await accoda(nuovoId(), {
      tipo: 'salva_conto',
      dati: {
        id: bozza.id,
        clienteId: bozza.clienteId,
        apertoIl: new Date(bozza.apertaIl).toISOString(),
        confermatoIl,
        righe: bozza.voci.map((v) => ({
          id: v.id,
          prodottoId: v.prodottoId,
          descrizione: v.descrizione,
          prezzoUnitarioCent: v.prezzoUnitarioCent,
          quantita: v.quantita,
          creatoIl: new Date(v.battutaIl).toISOString(),
        })),
        pagamento:
          modo.tipo === 'incassato'
            ? {
                id: nuovoId(),
                importoCent: modo.importoCent,
                metodo: modo.metodo,
                scontrinoBattuto: modo.scontrinoBattuto,
              }
            : null,
      },
    });

    await eliminaBozza(bozza.id);
    sollecitaSync();

    // Il conto addebita `totale`, il pagamento scarica `pagato`: quello che
    // resta è la variazione del saldo. Vale in tutti i casi — a credito
    // (pagato = 0), saldato in pieno (differenza zero), pagato in parte
    // (sale un po'), pagato oltre per coprire il vecchio debito (scende).
    if (bozza.clienteId) {
      const pagato = modo.tipo === 'incassato' ? modo.importoCent : 0;
      aggiornaSaldoInCache(queryClient, bozza.clienteId, totale - pagato);
      void queryClient.invalidateQueries({
        queryKey: ['estratto-conto', bozza.clienteId],
      });
    }
  };
}

/** Annulla una bozza senza registrare niente. */
export function useAnnullaBozza() {
  return (id: string) => eliminaBozza(id);
}
