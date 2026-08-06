'use client';

import { useEffect, useState } from 'react';
import { comeRimuovereCliente, etichettaCliente, haMovimenti } from '@/lib/dominio/clienti';
import type { Ruolo } from '@/lib/dominio/clienti';
import { useRimuoviCliente } from '@/lib/hooks/use-cliente';
import type { SaldoCliente } from '@/lib/supabase/tipi';

/**
 * Togliere un cliente dall'elenco.
 *
 * Non è un pulsante "elimina" e basta, perché non è la stessa operazione per
 * tutti: chi ha dei movimenti viene **disattivato**, chi non ne ha viene
 * cancellato davvero. Il pannello lo dice prima di agire, con parole diverse
 * nei due casi, così chi preme sa che cosa sta per succedere.
 *
 * È l'unica conferma che vale la pena chiedere in questa app (04-UX-MOBILE
 * §1: niente conferme sulle azioni reversibili). Qui una delle due strade è
 * irreversibile.
 */

interface Props {
  cliente: SaldoCliente;
  ruolo: Ruolo | null;
  onChiudi: () => void;
  onFatto: (messaggio: string) => void;
}

export function PannelloRimozione({ cliente, ruolo, onChiudi, onFatto }: Props) {
  const rimuovi = useRimuoviCliente();
  const [errore, setErrore] = useState<string | null>(null);

  const decisione = comeRimuovereCliente({ ruolo, haMovimenti: haMovimenti(cliente) });

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  async function conferma() {
    setErrore(null);
    try {
      const esito = await rimuovi.mutateAsync({ cliente, ruolo });
      if (esito.azione === 'vietata') {
        setErrore(esito.motivo);
        return;
      }
      onFatto(
        esito.azione === 'cancella'
          ? `${cliente.nome} è stato cancellato.`
          : `${cliente.nome} non compare più negli elenchi. La sua storia resta.`,
      );
    } catch {
      setErrore('Non sono riuscito a registrare l’operazione. Riprova fra un momento.');
    }
  }

  const cancella = decisione.azione === 'cancella';

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-superficie)] px-5 pb-sicura pt-3">
        <div className="flex justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <h2 className="pb-2 pt-4 text-lg font-semibold">
          {decisione.azione === 'vietata'
            ? 'Non si può fare'
            : cancella
              ? `Cancellare ${etichettaCliente(cliente)}?`
              : `Togliere ${etichettaCliente(cliente)} dagli elenchi?`}
        </h2>

        <p className="text-sm leading-relaxed text-[var(--color-testo-tenue)]">
          {decisione.azione === 'vietata'
            ? decisione.motivo
            : cancella
              ? 'Questo cliente non ha nessun movimento registrato: non c’è niente da perdere. La cancellazione è definitiva.'
              : decisione.motivo}
        </p>

        {!cancella && decisione.azione === 'disattiva' && cliente.saldo_cent > 0 && (
          <p className="mt-3 rounded-xl border border-[var(--color-attenzione)]/40 bg-[var(--color-attenzione)]/10 px-4 py-3 text-sm text-[var(--color-attenzione)]">
            Attenzione: questo cliente deve ancora dei soldi. Togliendolo dagli elenchi non lo
            vedrai più fra i Crediti.
          </p>
        )}

        {errore && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        <div className="mt-5 flex gap-3 pb-5">
          <button
            type="button"
            onClick={onChiudi}
            className="h-16 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
          >
            {decisione.azione === 'vietata' ? 'Ho capito' : 'Annulla'}
          </button>

          {decisione.azione !== 'vietata' && (
            <button
              type="button"
              onClick={() => void conferma()}
              disabled={rimuovi.isPending}
              className={`h-16 flex-1 rounded-xl text-base font-semibold disabled:opacity-60 ${
                cancella
                  ? 'bg-[var(--color-debito)] text-[var(--color-sfondo)] active:brightness-90'
                  : 'border-2 border-[var(--color-attenzione)] text-[var(--color-attenzione)]'
              }`}
            >
              {rimuovi.isPending ? 'Registro…' : cancella ? 'CANCELLA' : 'DISATTIVA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
