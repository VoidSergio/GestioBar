'use client';

import { useQuery } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ErroreLettura } from '@/lib/dominio/errori';
import type { Giornata, OraDiPunta, RigaClassifica, VendutoProdotto } from '@/lib/supabase/tipi';

/**
 * Le letture dei report (T-23, T-25, T-26).
 *
 * Sono quattro `select` su altrettante viste (migrazione 0018). Nessuna
 * scrittura: questa parte dell'app non tocca niente, e per questo può
 * permettersi di sbagliare senza fare danni — al massimo mostra un numero
 * storto, che si corregge riscrivendo una vista.
 *
 * PERCHÉ `staleTime` È LUNGO. Il venduto di ieri non cambia più. Quello di
 * oggi cambia, ma chi guarda i report lo fa la sera da fermo, non mentre
 * batte: mezz'ora di ritardo su una schermata che si apre due volte al
 * giorno vale meno di una lettura in più a ogni tocco.
 */

const MEZZ_ORA = 30 * 60 * 1000;

/** Le giornate di un periodo. `da` e `a` sono compresi, formato `2026-08-12`. */
export function useGiornate(da: string, a: string) {
  return useQuery({
    queryKey: ['giornate', da, a],
    queryFn: async (): Promise<Giornata[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_giornata')
        .select('*')
        .gte('giornata', da)
        .lte('giornata', a)
        .order('giornata', { ascending: false });

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: MEZZ_ORA,
  });
}

/** Che cosa è uscito nel periodo, riga per prodotto e giornata. */
export function useVendutoProdotto(da: string, a: string) {
  return useQuery({
    queryKey: ['venduto-prodotto', da, a],
    queryFn: async (): Promise<VendutoProdotto[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_venduto_prodotto')
        .select('*')
        .gte('giornata', da)
        .lte('giornata', a);

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: MEZZ_ORA,
  });
}

/**
 * La classifica dei clienti.
 *
 * Non prende un periodo: le finestre sono due e fisse — mese corrente e
 * sempre — e le calcola la vista. Il perché sta in `0018_report.sql`.
 */
export function useClassifica() {
  return useQuery({
    queryKey: ['classifica-clienti'],
    queryFn: async (): Promise<RigaClassifica[]> => {
      const { data, error } = await supabaseBrowser().from('v_classifica_clienti').select('*');

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: MEZZ_ORA,
  });
}

/** A che ora si lavora, negli ultimi novanta giorni. */
export function useOreDiPunta() {
  return useQuery({
    queryKey: ['ore-di-punta'],
    queryFn: async (): Promise<OraDiPunta[]> => {
      const { data, error } = await supabaseBrowser().from('v_ore_di_punta').select('*');

      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    // Le abitudini di novanta giorni non cambiano in una serata.
    staleTime: 6 * 60 * 60 * 1000,
  });
}
