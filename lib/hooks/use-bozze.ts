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
import { CHIAVE_CLIENTI } from './use-clienti';
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
  | { tipo: 'incassato'; metodo: string; scontrinoBattuto: boolean };

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

    await accoda(nuovoId(), {
      tipo: 'salva_conto',
      dati: {
        id: bozza.id,
        clienteId: bozza.clienteId,
        righe: bozza.voci.map((v) => ({
          id: v.id,
          prodottoId: v.prodottoId,
          descrizione: v.descrizione,
          prezzoUnitarioCent: v.prezzoUnitarioCent,
          quantita: v.quantita,
        })),
        pagamento:
          modo.tipo === 'incassato'
            ? {
                id: nuovoId(),
                importoCent: totale,
                metodo: modo.metodo,
                scontrinoBattuto: modo.scontrinoBattuto,
              }
            : null,
      },
    });

    await eliminaBozza(bozza.id);
    sollecitaSync();

    // Il saldo del cliente è cambiato: la prossima lettura deve rifarla.
    void queryClient.invalidateQueries({ queryKey: CHIAVE_CLIENTI });
  };
}

/** Annulla una bozza senza registrare niente. */
export function useAnnullaBozza() {
  return (id: string) => eliminaBozza(id);
}
