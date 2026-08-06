'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { MovimentoEstrattoConto, SaldoCliente } from '@/lib/supabase/tipi';
import { accoda } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';
import {
  comeRimuovereCliente,
  haMovimenti,
  type AzioneRimozione,
  type Ruolo,
} from '@/lib/dominio/clienti';
import { ErroreLettura } from '@/lib/dominio/errori';
import { verificaSpostamento, type RigaSpostabile } from '@/lib/dominio/spostamenti';
import { aggiornaSaldoInCache, CHIAVE_CLIENTI } from './use-clienti';
import { nuovoId } from '@/lib/utils';

/** Saldo e anagrafica di un cliente. */
export function useCliente(id: string) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: async (): Promise<SaldoCliente | null> => {
      const { data, error } = await supabaseBrowser()
        .from('v_saldo_clienti')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw new ErroreLettura(error.message, error.code);
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * L'estratto conto: tutti i movimenti, con il saldo dopo ognuno.
 *
 * Richiede la rete: lo storico non sta nella copia locale (03-ARCHITETTURA
 * §4.2). Dietro al banco serve il saldo, non la storia di sei mesi fa, e
 * tenerla in locale la farebbe crescere senza limite.
 */
/** Quanti movimenti per volta. Una schermata piena, non di più. */
export const PAGINA_MOVIMENTI = 30;

export function useEstrattoConto(clienteId: string, quanti = PAGINA_MOVIMENTI) {
  return useQuery({
    queryKey: ['estratto-conto', clienteId, quanti],
    queryFn: async (): Promise<MovimentoEstrattoConto[]> => {
      const { data, error } = await supabaseBrowser()
        .from('v_estratto_conto')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data', { ascending: false })
        .limit(quanti);

      if (error) throw new ErroreLettura(error.message, error.code);
      // I movimenti si restituiscono grezzi: il saldo progressivo dipende dal
      // saldo attuale, che è un'altra query. Ancorarlo qui vorrebbe dire
      // riscaricare lo storico a ogni caffè.
      return (data ?? []) as MovimentoEstrattoConto[];
    },
    staleTime: 60 * 1000,
    // Passando da 30 a 60 si tengono a schermo i 30 già letti invece di
    // far lampeggiare gli scheletri: si aggiungono righe, non si ricarica.
    placeholderData: (precedente) => precedente,
  });
}

export interface DatiIncasso {
  clienteId: string;
  importoCent: number;
  metodo: string;
  scontrinoBattuto: boolean;
}

/**
 * Registra un pagamento su un debito già maturato.
 *
 * `conto_id` resta nullo: è un **acconto generico**, non riferito a un conto
 * specifico. È il caso normale del cliente a credito, ed è il motivo per cui
 * il saldo si calcola sul cliente e non sul singolo conto (02-MODELLO-DATI
 * §3.7).
 *
 * Passa dalla coda come ogni scrittura: funziona anche senza rete.
 */
export function useIncassa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: DatiIncasso) => {
      await accoda(nuovoId(), {
        tipo: 'registra_pagamento',
        dati: {
          id: nuovoId(),
          clienteId: dati.clienteId,
          contoId: null,
          importoCent: dati.importoCent,
          metodo: dati.metodo,
          scontrinoBattuto: dati.scontrinoBattuto,
        },
      });
      sollecitaSync();
    },

    onSuccess: (_r, dati) => {
      // Il saldo scende subito a schermo: l'utente non aspetta il server.
      aggiornaSaldoInCache(queryClient, dati.clienteId, -dati.importoCent);
      void queryClient.invalidateQueries({
        queryKey: ['estratto-conto', dati.clienteId],
      });
    },
  });
}

/**
 * Toglie un cliente dall'elenco: cancellandolo o disattivandolo, a seconda
 * di che cosa si perderebbe.
 *
 * La decisione la prende `comeRimuovereCliente` (lib/dominio/clienti.ts),
 * non questo hook: qui c'è solo l'esecuzione. Passa dalla coda come ogni
 * scrittura, quindi funziona anche senza rete.
 */
export function useRimuoviCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      cliente: SaldoCliente;
      ruolo: Ruolo | null;
    }): Promise<AzioneRimozione> => {
      const decisione = comeRimuovereCliente({
        ruolo: dati.ruolo,
        haMovimenti: haMovimenti(dati.cliente),
      });

      if (decisione.azione === 'vietata') return decisione;

      await accoda(nuovoId(), {
        tipo: decisione.azione === 'cancella' ? 'elimina_cliente' : 'disattiva_cliente',
        dati: { id: dati.cliente.id, nome: dati.cliente.nome },
      });
      sollecitaSync();

      return decisione;
    },

    onSuccess: (decisione, dati) => {
      if (decisione.azione === 'vietata') return;

      // In entrambi i casi il cliente sparisce dall'elenco: `useClienti`
      // legge solo gli attivi, quindi disattivare e cancellare si vedono
      // uguali da lì. La differenza è che uno si può disfare.
      queryClient.setQueryData<SaldoCliente[]>(CHIAVE_CLIENTI, (elenco) =>
        elenco?.filter((c) => c.id !== dati.cliente.id),
      );
      queryClient.removeQueries({ queryKey: ['cliente', dati.cliente.id] });
      queryClient.removeQueries({ queryKey: ['estratto-conto', dati.cliente.id] });
    },
  });
}

export interface DatiSpostamento {
  riga: RigaSpostabile;
  quantita: number;
  clienteOrigineId: string;
  clienteDestinazioneId: string;
}

/**
 * Sposta una consumazione da un cliente a un altro.
 *
 * Le regole stanno in `verificaSpostamento`; qui c'è l'esecuzione. Gli id li
 * genera il dispositivo, come sempre, così l'operazione è ripetibile senza
 * creare doppioni anche se la risposta si perde.
 */
export function useSpostaRiga() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: DatiSpostamento): Promise<number> => {
      const esito = verificaSpostamento(dati);
      if (!esito.valido) throw new Error(esito.errore);

      await accoda(nuovoId(), {
        tipo: 'sposta_riga',
        dati: {
          rigaOrigineId: dati.riga.id,
          contoOrigineId: dati.riga.contoId,
          stornoId: nuovoId(),
          clienteDestinazioneId: dati.clienteDestinazioneId,
          contoDestinazioneId: nuovoId(),
          rigaDestinazioneId: nuovoId(),
          quantita: esito.quantita,
          quandoIl: new Date().toISOString(),
        },
      });
      sollecitaSync();

      return esito.importoCent;
    },

    onSuccess: (importoCent, dati) => {
      // Il debito si sposta: scende di qua, sale di là. Sono due clienti
      // diversi, quindi due aggiornamenti di segno opposto.
      aggiornaSaldoInCache(queryClient, dati.clienteOrigineId, -importoCent);
      aggiornaSaldoInCache(queryClient, dati.clienteDestinazioneId, importoCent);

      void queryClient.invalidateQueries({ queryKey: ['estratto-conto', dati.clienteOrigineId] });
      void queryClient.invalidateQueries({
        queryKey: ['estratto-conto', dati.clienteDestinazioneId],
      });
    },
  });
}
