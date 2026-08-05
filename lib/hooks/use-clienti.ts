'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { SaldoCliente } from '@/lib/supabase/tipi';
import { validaNuovoCliente, type DatiNuovoCliente } from '@/lib/dominio/clienti';
import { accoda } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';
import { nuovoId } from '@/lib/utils';

export const CHIAVE_CLIENTI = ['clienti-con-saldo'] as const;

/**
 * Elenco dei clienti con il loro saldo.
 *
 * Legge da `v_saldo_clienti` invece che da `clienti`: la vista calcola il
 * saldo dalle righe e dai pagamenti (DEC-02), quindi con una sola richiesta
 * si ha sia l'anagrafica sia il numero che conta.
 */
export function useClienti() {
  return useQuery({
    queryKey: CHIAVE_CLIENTI,
    queryFn: async (): Promise<SaldoCliente[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_saldo_clienti')
        .select('*')
        .eq('attivo', true);

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    // I saldi cambiano a ogni consumazione: cinque minuti, non un'ora.
    staleTime: 5 * 60 * 1000,
  });
}

export class ErroreCliente extends Error {}

function clienteVuoto(dati: {
  id: string;
  nome: string;
  soprannome: string | null;
  telefono: string | null;
}): SaldoCliente {
  return {
    ...dati,
    limite_credito_cent: null,
    attivo: true,
    addebitato_cent: 0,
    pagato_cent: 0,
    saldo_cent: 0,
    primo_movimento_il: null,
    ultimo_pagamento_il: null,
    ultimo_movimento_il: null,
    giorni_debito: null,
  };
}

/**
 * Crea un cliente.
 *
 * Non parla con il server: mette l'operazione in coda e aggiorna subito
 * l'elenco. Il motore di sincronizzazione la invierà appena possibile,
 * anche fra dieci minuti, anche dopo aver chiuso e riaperto l'app.
 *
 * È la regola dell'interfaccia in `CLAUDE.md`: l'utente non aspetta mai la
 * rete. E l'id lo genera il dispositivo (02-MODELLO-DATI.md §2), così la
 * riga esiste in locale con il suo identificativo definitivo e ci si possono
 * già collegare altre operazioni — un conto, per esempio — prima ancora che
 * il cliente sia arrivato al server.
 */
export function useCreaCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: DatiNuovoCliente): Promise<SaldoCliente> => {
      const esito = validaNuovoCliente(dati);
      if (!esito.valido) throw new ErroreCliente(esito.errore);

      const id = nuovoId();
      await accoda(nuovoId(), { tipo: 'crea_cliente', dati: { id, ...esito.dati } });
      sollecitaSync();

      return clienteVuoto({ id, ...esito.dati });
    },

    onSuccess: (cliente) => {
      // Compare nell'elenco adesso, non quando risponde il server.
      queryClient.setQueryData<SaldoCliente[]>(CHIAVE_CLIENTI, (vecchi = []) => [
        ...vecchi.filter((c) => c.id !== cliente.id),
        cliente,
      ]);
    },
  });
}
