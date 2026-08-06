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
        //
        // Il conto nasce SEMPRE chiuso, anche a credito. Con DEC-08 la
        // composizione è finita al momento della conferma: `stato` dice se il
        // conto si sta ancora battendo, non se è stato pagato. Il debito vive
        // in `v_saldo_clienti` (righe meno pagamenti), non qui.
        //
        // Lasciarlo aperto rompeva il secondo conto a credito dello stesso
        // cliente contro `idx_un_conto_aperto_per_cliente`.
        const { error: erroreConto } = await sb.from('conti').insert({
          id: op.dati.id,
          cliente_id: op.dati.clienteId,
          stato: 'chiuso',
          aperto_il: op.dati.apertoIl,
          chiuso_il: op.dati.confermatoIl,
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
              // Orario del banco, non dell'arrivo al server
              creato_il: r.creatoIl,
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
            creato_il: op.dati.confermatoIl,
            op_id: op.dati.pagamento.id,
          });
          if (errorePagamento && !eGiaRegistrato(errorePagamento)) return esito(errorePagamento);
        }

        return { ok: true, messaggio: 'ok' };
      }

      case 'sposta_riga': {
        // Tre scritture in ordine, tutte idempotenti sul reinvio:
        //   1. lo storno parziale sul conto di chi cede
        //   2. il conto nuovo intestato a chi offre
        //   3. la riga su quel conto, allo stesso prezzo congelato
        //
        // Il prezzo e la descrizione si rileggono dalla riga originale e non
        // si prendono dal catalogo: se il listino è cambiato nel frattempo,
        // spostare un caffè non deve cambiarne il prezzo (DEC-05).
        const { data: originale, error: erroreLettura } = await sb
          .from('righe_conto')
          .select('descrizione, prezzo_unitario_cent, prodotto_id')
          .eq('id', op.dati.rigaOrigineId)
          .maybeSingle();

        if (erroreLettura) return esito(erroreLettura);
        if (!originale) {
          return {
            ok: false,
            codice: 'riga_assente',
            messaggio: 'La consumazione da spostare non esiste più.',
          };
        }

        const { error: erroreStorno } = await sb.from('righe_conto').insert({
          id: op.dati.stornoId,
          conto_id: op.dati.contoOrigineId,
          prodotto_id: originale.prodotto_id,
          descrizione: originale.descrizione,
          prezzo_unitario_cent: originale.prezzo_unitario_cent,
          quantita: -op.dati.quantita,
          storno_di: op.dati.rigaOrigineId,
          creato_il: op.dati.quandoIl,
          op_id: op.dati.stornoId,
        });
        if (erroreStorno && !eGiaRegistrato(erroreStorno)) return esito(erroreStorno);

        const { error: erroreConto } = await sb.from('conti').insert({
          id: op.dati.contoDestinazioneId,
          cliente_id: op.dati.clienteDestinazioneId,
          stato: 'chiuso',
          aperto_il: op.dati.quandoIl,
          chiuso_il: op.dati.quandoIl,
          op_id: op.dati.contoDestinazioneId,
        });
        if (erroreConto && !eGiaRegistrato(erroreConto)) return esito(erroreConto);

        const { error: erroreRiga } = await sb.from('righe_conto').insert({
          id: op.dati.rigaDestinazioneId,
          conto_id: op.dati.contoDestinazioneId,
          prodotto_id: originale.prodotto_id,
          descrizione: originale.descrizione,
          prezzo_unitario_cent: originale.prezzo_unitario_cent,
          quantita: op.dati.quantita,
          creato_il: op.dati.quandoIl,
          op_id: op.dati.rigaDestinazioneId,
        });
        if (erroreRiga && !eGiaRegistrato(erroreRiga)) return esito(erroreRiga);

        return { ok: true, messaggio: 'ok' };
      }

      case 'disattiva_cliente': {
        const { error } = await sb.from('clienti').update({ attivo: false }).eq('id', op.dati.id);
        return esito(error);
      }

      case 'elimina_cliente': {
        // Due modi in cui questa può fallire, ed è giusto così:
        //  - 42501 / nessuna riga toccata: chi la manda non è il titolare
        //  - 23503: il cliente ha dei conti, il database rifiuta
        // In entrambi i casi è un errore di dati, la voce si ferma e si
        // mostra all'utente invece di ritentare all'infinito.
        const { error, count } = await sb
          .from('clienti')
          .delete({ count: 'exact' })
          .eq('id', op.dati.id);

        if (error) return esito(error);

        // RLS non dà errore quando vieta: restituisce zero righe toccate.
        // Senza questo controllo la cancellazione risulterebbe riuscita.
        if (count === 0) {
          return {
            ok: false,
            codice: 'permesso_negato',
            messaggio: 'Solo il titolare può cancellare un cliente.',
          };
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
          return {
            ok: false,
            codice: 'riga_assente',
            messaggio: 'La riga da stornare non esiste.',
          };
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
