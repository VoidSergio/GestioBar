'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ErroreLettura } from '@/lib/dominio/errori';
import type { OperatoreGiornata, Profilo, Ruolo } from '@/lib/supabase/tipi';

/**
 * Chi lavora nel locale (T-41, T-43).
 *
 * GLI ACCOUNT NON SI CREANO DA QUI. Si invitano dalla dashboard di Supabase
 * (`06-SETUP-SUPABASE.md` §5.3): creare un utente richiede la chiave
 * `service_role`, quella che scavalca ogni permesso, e tenerla fra le
 * variabili d'ambiente del sito vorrebbe dire che da quel momento esiste in un
 * posto in più — e se si perde, si perde tutto. Un collega nuovo capita due
 * volte l'anno; quella chiave sarebbe lì tutti i giorni.
 *
 * Da qui si fa tutto il resto, che è quello che serve spesso: chi è titolare
 * e chi barista, e chi non lavora più.
 */

export const CHIAVE_PERSONE = ['persone'] as const;

export function usePersone() {
  return useQuery({
    queryKey: CHIAVE_PERSONE,
    queryFn: async (): Promise<Profilo[]> => {
      const { data, error } = await supabaseBrowser()
        .from('profili')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Cambia ruolo o attivazione.
 *
 * I divieti veri stanno nel database (`0019_ruoli.sql`): non ci si promuove da
 * soli, e l'ultimo titolare attivo non si retrocede. Qui si mostrano i
 * messaggi che il database restituisce, invece di riscriverli — così non
 * possono divergere.
 */
export function useModificaPersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: { id: string; campi: { ruolo?: Ruolo; attivo?: boolean } }) => {
      const { error, count } = await supabaseBrowser()
        .from('profili')
        .update(dati.campi, { count: 'exact' })
        .eq('id', dati.id);

      if (error) throw new Error(traduci(error.message));
      // RLS che vieta non dà errore: restituisce zero righe toccate.
      if (count === 0) throw new Error('Non hai i permessi per farlo.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHIAVE_PERSONE }),
  });
}

/**
 * I messaggi del database arrivano già in italiano dalle nostre eccezioni.
 * Quelli di Postgres no, e "new row violates row-level security policy" al
 * banco non vuol dire niente.
 */
function traduci(messaggio: string): string {
  if (messaggio.includes('row-level security')) {
    return 'Non hai i permessi per farlo.';
  }
  return messaggio;
}

/** Quanto ha lavorato ciascuno, per giornata. Solo il titolare vede righe. */
export function useOperatori(da: string, a: string) {
  return useQuery({
    queryKey: ['operatori', da, a],
    queryFn: async (): Promise<OperatoreGiornata[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_operatore_giornata')
        .select('*')
        .gte('giornata', da)
        .lte('giornata', a);

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 30 * 60 * 1000,
  });
}
