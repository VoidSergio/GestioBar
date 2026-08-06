'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  aggiungi,
  diminuisci,
  nuovaBozza,
  ordinaBozze,
  togliVoce,
  totaleBozza,
  type Bozza,
  type ProdottoScelto,
} from '@/lib/dominio/bozza';
import {
  ascoltaBozze,
  bozzaDelCliente,
  eliminaBozza,
  leggiBozza,
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

export function useApriConto() {
  return async function apri(clienteId: string | null, etichetta: string): Promise<string> {
    // Se il cliente ha già un conto aperto ci si entra dentro, invece di
    // crearne un secondo: non è un errore, è la cosa giusta
    // (04-UX-MOBILE.md §4).
    if (clienteId) {
      const esistente = await bozzaDelCliente(clienteId);
      if (esistente) return esistente.id;
    }

    const bozza = nuovaBozza(nuovoId(), clienteId, etichetta);
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
