'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Categoria, Prodotto } from '@/lib/supabase/tipi';
import { ErroreLettura } from '@/lib/dominio/errori';

/**
 * Il listino, per la schermata che lo gestisce (T-16).
 *
 * PERCHÉ NON PASSA DALLA CODA OFFLINE. Tutte le scritture dell'app passano
 * da `accoda()`, e questa è l'eccezione: il listino si tocca di rado, da
 * fermi, e non mentre c'è fila (04-UX-MOBILE §9). Farlo offline vorrebbe
 * dire gestire il caso di due prezzi diversi decisi su due dispositivi, per
 * un guadagno che è zero — nessuno cambia i prezzi in modalità aereo.
 * Richiede la rete, e la schermata lo dice.
 *
 * Legge da `prodotti` e non da `v_griglia_prodotti`: la vista raggruppa per
 * nome base e nasconde gli id delle singole varianti, che qui servono tutti.
 */

export const CHIAVE_LISTINO = ['listino'] as const;

export type VoceListino = Pick<
  Prodotto,
  | 'id'
  | 'categoria_id'
  | 'nome_base'
  | 'variante'
  | 'prezzo_cent'
  | 'ordine'
  | 'preferito'
  | 'attivo'
>;

export function useListino() {
  return useQuery({
    queryKey: CHIAVE_LISTINO,
    queryFn: async (): Promise<VoceListino[]> => {
      const { data, error } = await supabaseBrowser()
        .from('prodotti')
        .select('id, categoria_id, nome_base, variante, prezzo_cent, ordine, preferito, attivo')
        .order('nome_base', { ascending: true })
        .order('prezzo_cent', { ascending: true });

      if (error) throw new ErroreLettura(error.message, error.code);
      return (data ?? []) as VoceListino[];
    },
    staleTime: 60 * 1000,
  });
}

export function useCategorie() {
  return useQuery({
    queryKey: ['categorie'],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabaseBrowser()
        .from('categorie')
        .select('*')
        .order('ordine', { ascending: true });

      if (error) throw new ErroreLettura(error.message, error.code);
      return (data ?? []) as Categoria[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Dopo ogni modifica si rilegge sia il listino sia la griglia: sono due
 * query sulla stessa cosa, e chi cambia un prezzo va a controllarlo sulla
 * griglia un secondo dopo.
 */
function invalidaTutto(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: CHIAVE_LISTINO });
  void queryClient.invalidateQueries({ queryKey: ['griglia-prodotti'] });
}

export function useModificaProdotto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      id: string;
      campi: Partial<Pick<Prodotto, 'prezzo_cent' | 'preferito' | 'attivo' | 'ordine'>>;
    }) => {
      const { error, count } = await supabaseBrowser()
        .from('prodotti')
        .update(dati.campi, { count: 'exact' })
        .eq('id', dati.id);

      if (error) throw new ErroreLettura(error.message, error.code);
      // RLS che vieta non dà errore: restituisce zero righe toccate.
      if (count === 0) throw new Error('Non hai i permessi per modificare il listino.');
    },

    // Aggiornamento ottimistico: il prezzo cambia sotto il dito, e se il
    // server rifiuta si torna indietro. Qui si può, perché la schermata
    // richiede comunque la rete e l'esito arriva in un attimo.
    onMutate: async (dati) => {
      await queryClient.cancelQueries({ queryKey: CHIAVE_LISTINO });
      const precedente = queryClient.getQueryData<VoceListino[]>(CHIAVE_LISTINO);

      queryClient.setQueryData<VoceListino[]>(CHIAVE_LISTINO, (voci) =>
        voci?.map((v) => (v.id === dati.id ? { ...v, ...dati.campi } : v)),
      );

      return { precedente };
    },

    onError: (_e, _dati, contesto) => {
      if (contesto?.precedente) {
        queryClient.setQueryData(CHIAVE_LISTINO, contesto.precedente);
      }
    },

    onSettled: () => invalidaTutto(queryClient),
  });
}

export function useCreaVoceListino() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      nomeBase: string;
      variante: string;
      prezzoCent: number;
      categoriaId: string | null;
      ordine: number;
    }) => {
      const { error } = await supabaseBrowser().from('prodotti').insert({
        nome_base: dati.nomeBase,
        variante: dati.variante,
        prezzo_cent: dati.prezzoCent,
        categoria_id: dati.categoriaId,
        ordine: dati.ordine,
      });

      if (error) throw new ErroreLettura(error.message, error.code);
    },

    onSuccess: () => invalidaTutto(queryClient),
  });
}
