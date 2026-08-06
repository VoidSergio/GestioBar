'use client';

import { useQuery } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { MovimentoScontrino } from '@/lib/supabase/tipi';
import { intervalloGiornata } from '@/lib/dominio/scontrini';
import { ErroreLettura } from '@/lib/dominio/errori';

/**
 * I movimenti di una giornata, per capire che cosa è stato battuto.
 *
 * Richiede la rete, come l'estratto conto: sono dati di controllo, non
 * servono a servire un caffè (03-ARCHITETTURA §4.5). Senza connessione la
 * schermata lo dice invece di restare a caricare.
 *
 * L'intervallo lo calcola il dispositivo sui suoi confini locali di giornata
 * e lo manda come due istanti: la vista SQL resta senza logica di fuso.
 */
export function useScontrini(giorno: Date) {
  const { inizio, fine } = intervalloGiornata(giorno);

  return useQuery({
    queryKey: ['scontrini', inizio],
    queryFn: async (): Promise<MovimentoScontrino[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_scontrini')
        .select('*')
        .gte('data', inizio)
        .lt('data', fine)
        .order('data', { ascending: false });

      // Il codice serve a distinguere "manca la rete" da "manca la vista":
      // new Error(message) lo butterebbe via.
      if (error) throw new ErroreLettura(error.message, error.code);
      return (data ?? []) as MovimentoScontrino[];
    },
    // Un minuto: durante il turno si aggiunge roba di continuo, e questa
    // schermata si guarda proprio per vedere se è arrivata.
    staleTime: 60 * 1000,
  });
}
