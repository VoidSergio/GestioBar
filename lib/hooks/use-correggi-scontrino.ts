'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accoda } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';
import type { MovimentoScontrino } from '@/lib/supabase/tipi';

/**
 * Corregge la spunta dello scontrino su un incasso già registrato.
 *
 * L'unica modifica ammessa su un movimento, e solo per il titolare: il
 * permesso lo impone il database (0017), non questa schermata. Qui il
 * pulsante si nasconde a chi non può, ma nascondere non è vietare — se
 * qualcun altro ci arrivasse lo stesso, la scrittura verrebbe rifiutata e
 * comparirebbe fra le operazioni non riuscite.
 */
export function useCorreggiScontrino() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pagamentoId, battuto }: { pagamentoId: string; battuto: boolean }) => {
      await accoda(crypto.randomUUID(), {
        tipo: 'correggi_scontrino',
        dati: { pagamentoId, battuto },
      });
      return { pagamentoId, battuto };
    },

    onSuccess: ({ pagamentoId, battuto }) => {
      // A mano e non con `invalidateQueries`: la rilettura partirebbe prima
      // che la scrittura arrivi al server e riporterebbe il valore vecchio,
      // marcandolo fresco (03-ARCHITETTURA §4.3).
      qc.setQueriesData<MovimentoScontrino[]>({ queryKey: ['scontrini'] }, (elenco) =>
        elenco?.map((m) =>
          m.movimento_id === pagamentoId ? { ...m, scontrino_battuto: battuto } : m
        )
      );
      sollecitaSync();
    },
  });
}
