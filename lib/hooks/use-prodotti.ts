'use client';

import { useQuery } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { RiquadroGriglia } from '@/lib/supabase/tipi';

/**
 * Legge la griglia dei prodotti da `v_griglia_prodotti`.
 *
 * La vista restituisce un riquadro per `nome_base` con le varianti in un array:
 * 59 prodotti diventano 34 riquadri. Il perché sta in 07-LISTINO.md §4.
 *
 * Le regole di scelta delle varianti stanno in `lib/dominio/listino.ts`,
 * perché sono pure e vanno testate senza montare React.
 */
export function useProdotti() {
  return useQuery({
    queryKey: ['griglia-prodotti'],
    queryFn: async (): Promise<RiquadroGriglia[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_griglia_prodotti')
        .select('*')
        .order('preferito', { ascending: false })
        .order('categoria_ordine', { ascending: true, nullsFirst: false })
        .order('ordine', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
