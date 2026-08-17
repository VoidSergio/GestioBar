'use client';

import { useQuery } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { contaConti } from '@/lib/dominio/clienti';

/**
 * Quante volte ogni cliente ha aperto un conto, di recente.
 *
 * Serve al pannello "a chi?" per mettere in cima chi passa più spesso
 * (04-UX-MOBILE.md §4). Era un criterio arretrato di T-11: quando quella
 * schermata è stata scritta i conti non esistevano ancora, e l'ordine era
 * per debito — cioè per la persona sbagliata.
 *
 * SI CONTA QUI, NON NEL DATABASE. Una vista con i conteggi sarebbe più
 * elegante e più leggera, ma costerebbe una migrazione da eseguire su
 * Supabase prima che l'app funzioni. Questo numero serve solo a ordinare un
 * elenco: se manca, l'ordine peggiora e non succede nient'altro. Non vale
 * un passo di installazione in più.
 */

/** Quanto indietro si guarda. Trenta giorni: un mese di abitudini. */
export const GIORNI_FREQUENZA = 30;

/**
 * Tetto ai conti letti.
 *
 * PostgREST tronca comunque le risposte, e una troncatura silenziosa qui
 * darebbe un ordine sbagliato senza dirlo. Chiedendo esplicitamente i più
 * recenti, se il tetto viene raggiunto si perde la coda del periodo — cioè
 * la parte più vecchia, che è anche quella che conta meno.
 */
const MASSIMO_CONTI = 2000;

export function useFrequenzaClienti() {
  return useQuery({
    queryKey: ['frequenza-clienti'],
    queryFn: async (): Promise<Record<string, number>> => {
      const da = new Date(Date.now() - GIORNI_FREQUENZA * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseBrowser()
        .from('conti')
        .select('cliente_id')
        .not('cliente_id', 'is', null)
        .gte('aperto_il', da)
        .order('aperto_il', { ascending: false })
        .limit(MASSIMO_CONTI);

      if (error) throw new Error(error.message);
      return contaConti(data ?? []);
    },

    // Le abitudini di un mese non cambiano in un'ora. Si rilegge di rado, e
    // intanto la copia su IndexedDB tiene in piedi l'ordine anche offline.
    staleTime: 60 * 60 * 1000,
  });
}
