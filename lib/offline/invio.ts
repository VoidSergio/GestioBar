'use client';

import { supabaseBrowser } from '@/lib/supabase/client';
import type { Operazione } from '@/lib/dominio/coda';

export interface EsitoInvio {
  ok: boolean;
  codice?: string;
  messaggio: string;
}

/**
 * Traduce un'operazione della coda in una scrittura su Supabase.
 *
 * È l'unico punto in cui la coda conosce il database. Ogni scrittura porta
 * `op_id`: se arriva due volte, la seconda viene rifiutata dal vincolo di
 * unicità e `sync.ts` la interpreta come "già registrata".
 */
export async function inviaOperazione(opId: string, op: Operazione): Promise<EsitoInvio> {
  const sb = supabaseBrowser();

  try {
    switch (op.tipo) {
      case 'crea_cliente': {
        // I clienti non hanno op_id: l'id lo genera il dispositivo ed è già
        // la chiave primaria, quindi il reinvio viene rifiutato allo stesso modo.
        const { error } = await sb.from('clienti').insert({
          id: op.dati.id,
          nome: op.dati.nome,
          soprannome: op.dati.soprannome,
          telefono: op.dati.telefono,
        });
        return esito(error);
      }

      case 'salva_conto': {
        // Un conto confermato arriva tutto insieme (DEC-08): l'intestazione,
        // tutte le righe in un solo insert, e l'eventuale pagamento.
        // Due o tre chiamate per conto invece di una per prodotto.
        const { error: erroreConto } = await sb.from('conti').insert({
          id: op.dati.id,
          cliente_id: op.dati.clienteId,
          stato: op.dati.pagamento ? 'chiuso' : 'aperto',
          chiuso_il: op.dati.pagamento ? new Date().toISOString() : null,
          op_id: opId,
        });

        // Se il conto era già arrivato si prosegue con le righe: il reinvio
        // di una riga verrà a sua volta riconosciuto come già registrato.
        if (erroreConto && !eGiaRegistrato(erroreConto)) return esito(erroreConto);

        if (op.dati.righe.length > 0) {
          const { error: erroreRighe } = await sb.from('righe_conto').insert(
            op.dati.righe.map((r) => ({
              id: r.id,
              conto_id: op.dati.id,
              prodotto_id: r.prodottoId,
              descrizione: r.descrizione,
              prezzo_unitario_cent: r.prezzoUnitarioCent,
              quantita: r.quantita,
              // op_id univoco per riga, derivato da quello dell'operazione
              op_id: r.id,
            })),
          );
          if (erroreRighe && !eGiaRegistrato(erroreRighe)) return esito(erroreRighe);
        }

        if (op.dati.pagamento) {
          const { error: errorePagamento } = await sb.from('pagamenti').insert({
            id: op.dati.pagamento.id,
            cliente_id: op.dati.clienteId,
            conto_id: op.dati.id,
            importo_cent: op.dati.pagamento.importoCent,
            metodo: op.dati.pagamento.metodo as 'contanti' | 'carta' | 'bonifico' | 'altro',
            scontrino_battuto: op.dati.pagamento.scontrinoBattuto,
            op_id: op.dati.pagamento.id,
          });
          if (errorePagamento && !eGiaRegistrato(errorePagamento)) return esito(errorePagamento);
        }

        return { ok: true, messaggio: 'ok' };
      }

      case 'apri_conto': {
        const { error } = await sb.from('conti').insert({
          id: op.dati.id,
          cliente_id: op.dati.clienteId,
          op_id: opId,
        });
        return esito(error);
      }

      case 'aggiungi_riga': {
        const { error } = await sb.from('righe_conto').insert({
          id: op.dati.id,
          conto_id: op.dati.contoId,
          prodotto_id: op.dati.prodottoId,
          descrizione: op.dati.descrizione,
          prezzo_unitario_cent: op.dati.prezzoUnitarioCent,
          quantita: op.dati.quantita,
          op_id: opId,
        });
        return esito(error);
      }

      case 'storna_riga': {
        // Lo storno rilegge la riga originale per copiarne descrizione e
        // prezzo: il prezzo congelato deve restare quello (DEC-05).
        const { data: originale, error: erroreLettura } = await sb
          .from('righe_conto')
          .select('descrizione, prezzo_unitario_cent, quantita, prodotto_id')
          .eq('id', op.dati.rigaOriginaleId)
          .maybeSingle();

        if (erroreLettura) return esito(erroreLettura);
        if (!originale) {
          return { ok: false, codice: 'riga_assente', messaggio: 'La riga da stornare non esiste.' };
        }

        const { error } = await sb.from('righe_conto').insert({
          id: op.dati.id,
          conto_id: op.dati.contoId,
          prodotto_id: originale.prodotto_id,
          descrizione: originale.descrizione,
          prezzo_unitario_cent: originale.prezzo_unitario_cent,
          quantita: -Math.abs(originale.quantita),
          storno_di: op.dati.rigaOriginaleId,
          op_id: opId,
        });
        return esito(error);
      }

      case 'elimina_riga': {
        // Il database rifiuta la cancellazione oltre i 60 secondi o a conto
        // chiuso: è un trigger, non un controllo dell'app (DEC-03).
        const { error } = await sb.from('righe_conto').delete().eq('id', op.dati.rigaId);
        return esito(error);
      }

      case 'registra_pagamento': {
        const { error } = await sb.from('pagamenti').insert({
          id: op.dati.id,
          cliente_id: op.dati.clienteId,
          conto_id: op.dati.contoId,
          importo_cent: op.dati.importoCent,
          metodo: op.dati.metodo as 'contanti' | 'carta' | 'bonifico' | 'altro',
          scontrino_battuto: op.dati.scontrinoBattuto,
          op_id: opId,
        });
        return esito(error);
      }

      case 'chiudi_conto': {
        const { error } = await sb
          .from('conti')
          .update({ stato: 'chiuso', chiuso_il: new Date().toISOString() })
          .eq('id', op.dati.contoId)
          .eq('stato', 'aperto');
        return esito(error);
      }
    }
  } catch (e) {
    // Rete assente: la richiesta non è nemmeno partita.
    return { ok: false, messaggio: e instanceof Error ? e.message : 'Failed to fetch' };
  }
}

function esito(error: { code?: string; message: string } | null): EsitoInvio {
  if (!error) return { ok: true, messaggio: 'ok' };
  return { ok: false, codice: error.code, messaggio: error.message };
}

/**
 * Un conto viene inviato in più pezzi: se il primo era già arrivato e la
 * risposta si è persa, il reinvio deve proseguire con i pezzi successivi
 * invece di fermarsi. Stessa logica di `classificaErrore`, applicata qui
 * perché serve a metà operazione.
 */
function eGiaRegistrato(error: { code?: string; message: string }): boolean {
  return error.code === '23505' && /op_id|_pkey/i.test(error.message);
}
