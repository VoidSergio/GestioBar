'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { SaldoCliente } from '@/lib/supabase/tipi';
import { validaNuovoCliente, type DatiNuovoCliente } from '@/lib/dominio/clienti';
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

/**
 * Crea un cliente.
 *
 * L'id lo genera il dispositivo (02-MODELLO-DATI.md §2): la riga esiste
 * subito in locale con il suo identificativo definitivo.
 *
 * NOTA SUL FUNZIONAMENTO SENZA RETE. Questa scrittura richiede la
 * connessione: la coda di T-09 non esiste ancora. È una delle poche
 * eccezioni alla regola "tutto deve funzionare offline", ed è temporanea.
 * L'errore lo dice in italiano invece di fallire in silenzio.
 */
export function useCreaCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: DatiNuovoCliente): Promise<SaldoCliente> => {
      const esito = validaNuovoCliente(dati);
      if (!esito.valido) throw new ErroreCliente(esito.errore);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new ErroreCliente(
          'Senza rete non posso registrare un cliente nuovo. Riprova quando torna la connessione.',
        );
      }

      const id = nuovoId();
      const { error } = await supabaseBrowser()
        .from('clienti')
        .insert({ id, ...esito.dati });

      if (error) {
        if (error.code === '23505') {
          throw new ErroreCliente('Questo cliente risulta già registrato.');
        }
        throw new ErroreCliente(
          'Non sono riuscito a salvare il cliente. Controlla la connessione e riprova.',
        );
      }

      return {
        id,
        nome: esito.dati.nome,
        soprannome: esito.dati.soprannome,
        telefono: esito.dati.telefono,
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
    },

    // Aggiornamento ottimistico: il cliente compare nell'elenco prima che il
    // server risponda. È la regola dell'interfaccia in CLAUDE.md — l'utente
    // non aspetta mai la rete.
    onMutate: async (dati) => {
      const esito = validaNuovoCliente(dati);
      if (!esito.valido) return;

      await queryClient.cancelQueries({ queryKey: CHIAVE_CLIENTI });
      const precedenti = queryClient.getQueryData<SaldoCliente[]>(CHIAVE_CLIENTI);

      queryClient.setQueryData<SaldoCliente[]>(CHIAVE_CLIENTI, (vecchi = []) => [
        ...vecchi,
        {
          id: `provvisorio-${nuovoId()}`,
          nome: esito.dati.nome,
          soprannome: esito.dati.soprannome,
          telefono: esito.dati.telefono,
          limite_credito_cent: null,
          attivo: true,
          addebitato_cent: 0,
          pagato_cent: 0,
          saldo_cent: 0,
          primo_movimento_il: null,
          ultimo_pagamento_il: null,
          ultimo_movimento_il: null,
          giorni_debito: null,
        },
      ]);

      return { precedenti };
    },

    onError: (_errore, _dati, contesto) => {
      // Se il salvataggio fallisce, l'elenco torna com'era: meglio vedere
      // sparire un nome che credere di averlo registrato.
      if (contesto?.precedenti) {
        queryClient.setQueryData(CHIAVE_CLIENTI, contesto.precedenti);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CHIAVE_CLIENTI });
    },
  });
}
