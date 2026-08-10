'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { RiepilogoGiornata, TurnoCorrente } from '@/lib/supabase/tipi';
import { ErroreLettura } from '@/lib/dominio/errori';
import { accoda } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';

/**
 * Il turno aperto adesso.
 *
 * Funziona offline in lettura: TanStack tiene la copia su IndexedDB (T-07) e
 * `networkMode: 'offlineFirst'` fa partire la query lo stesso. Senza rete si
 * vedono gli importi dell'ultima volta che l'app ha parlato col server — che
 * è esattamente ciò contro cui chi conta sta riconciliando, e per cui la
 * chiusura memorizza gli importi invece di farli ricalcolare (DEC-02 non si
 * applica qui: vedi 02-MODELLO-DATI §4.1).
 */
export function useTurnoCorrente() {
  return useQuery({
    queryKey: ['turno-corrente'],
    queryFn: async (): Promise<TurnoCorrente> => {
      const { data, error } = await supabaseBrowser()
        .from('v_turno_corrente')
        .select('*')
        .single();

      if (error) throw new ErroreLettura(error.message, error.code);
      return data as TurnoCorrente;
    },
    // Trenta secondi: durante il servizio gli incassi entrano di continuo, e
    // questa schermata si apre proprio per sapere a quanto siamo.
    staleTime: 30 * 1000,
  });
}

/** Le giornate già chiuse, dalla più recente. La giornata è la somma dei turni. */
export function useRiepilogoGiornate(quante = 14) {
  return useQuery({
    queryKey: ['riepilogo-giornate', quante],
    queryFn: async (): Promise<RiepilogoGiornata[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_riepilogo_giornata')
        .select('*')
        .order('giornata', { ascending: false })
        .limit(quante);

      if (error) throw new ErroreLettura(error.message, error.code);
      return (data ?? []) as RiepilogoGiornata[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface DatiChiusura {
  iniziatoIl: string;
  fondoCassaCent: number;
  contatoCent: number;
  incassatoContantiCent: number;
  incassatoCartaCent: number;
  incassatoAltroCent: number;
  variazioneCreditoCent: number;
  causale: string | null;
  chiusoDa: string;
}

/**
 * Chiude il turno.
 *
 * Passa dalla coda come ogni altra scrittura (DEC-06): a fine servizio la
 * rete è l'ultima cosa su cui contare, e chi smonta deve poter andare a casa.
 *
 * Nessun `invalidateQueries` subito dopo `accoda()` — è la trappola di
 * 03-ARCHITETTURA §4.3, quella che fece divergere i saldi il 6 agosto: la
 * rilettura partirebbe prima che la scrittura arrivi al server, tornerebbe il
 * turno vecchio e lo marcherebbe fresco. Il turno azzerato lo scriviamo a
 * mano nella cache; la lettura vera arriva quando la coda si svuota.
 */
export function useChiudiTurno() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dati: DatiChiusura) => {
      const id = crypto.randomUUID();
      const opId = crypto.randomUUID();
      const chiusoIl = new Date().toISOString();

      await accoda(opId, {
        tipo: 'chiudi_turno',
        dati: { id, chiusoIl, ...dati },
      });

      return { id, chiusoIl, ...dati };
    },

    onSuccess: (chiusura) => {
      // Il turno nuovo comincia adesso, con i contatori a zero. È quello che
      // vedrebbe il collega che monta, ed è vero anche se la scrittura è
      // ancora in coda: il turno precedente, per chi sta al banco, è chiuso.
      qc.setQueryData<TurnoCorrente>(['turno-corrente'], (vecchio) => ({
        iniziato_il: chiusura.chiusoIl,
        fondo_cassa_cent: vecchio?.fondo_cassa_cent ?? chiusura.fondoCassaCent,
        incassato_contanti_cent: 0,
        incassato_carta_cent: 0,
        incassato_altro_cent: 0,
        variazione_credito_cent: 0,
        n_pagamenti: 0,
      }));

      sollecitaSync();
    },
  });
}
