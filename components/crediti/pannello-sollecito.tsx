'use client';

import { useEffect, useState } from 'react';
import { etichettaCliente } from '@/lib/dominio/clienti';
import { messaggioSollecito, numeroPerWhatsApp } from '@/lib/dominio/crediti';
import type { SaldoCliente } from '@/lib/supabase/tipi';

/**
 * Il messaggio di sollecito, da rileggere prima di mandarlo.
 *
 * PERCHÉ IL TESTO È IN UN CAMPO MODIFICABILE E NON PARTE DA SOLO.
 *
 * Un sollecito automatico che suona come un'agenzia di recupero crediti fa
 * perdere il cliente (04-UX-MOBILE §7). Il tono conta più della funzione, e
 * il tono giusto lo sa solo chi conosce quella persona: con uno ci scherzi,
 * con un altro no. Quindi l'app prepara una bozza gentile e si ferma lì.
 *
 * **Nessun messaggio parte automaticamente.** Anche premendo WhatsApp o SMS
 * non si invia niente: si apre l'app di messaggistica con il testo già
 * scritto, e l'invio resta un gesto di una persona.
 */

interface Props {
  cliente: SaldoCliente;
  onChiudi: () => void;
}

export function PannelloSollecito({ cliente, onChiudi }: Props) {
  const [testo, setTesto] = useState(() => messaggioSollecito(cliente));

  const numeroWhatsApp = numeroPerWhatsApp(cliente.telefono);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const vuoto = testo.trim() === '';

  function apri(indirizzo: string) {
    window.open(indirizzo, '_blank', 'noopener,noreferrer');
    onChiudi();
  }

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

        <h2 className="pb-1 pt-4 text-lg font-semibold">Scrivi a {etichettaCliente(cliente)}</h2>
        <p className="text-sm text-[var(--color-testo-tenue)]">
          Rileggilo e cambialo come vuoi. Niente parte finché non lo mandi tu.
        </p>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="sr-only">Messaggio</span>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={4}
            className="rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] p-4 text-base leading-relaxed outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        {!cliente.telefono && (
          <p className="mt-3 rounded-xl bg-[var(--color-sfondo)] px-4 py-3 text-sm text-[var(--color-testo-tenue)]">
            Questo cliente non ha un numero di telefono. Puoi copiare il messaggio e mandarlo come
            preferisci.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 pb-5">
          {numeroWhatsApp && (
            <button
              type="button"
              disabled={vuoto}
              onClick={() =>
                apri(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(testo)}`)
              }
              className="h-16 rounded-xl bg-[var(--color-positivo)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-40"
            >
              Apri WhatsApp
            </button>
          )}

          {cliente.telefono && (
            <button
              type="button"
              disabled={vuoto}
              onClick={() => apri(`sms:${cliente.telefono}?&body=${encodeURIComponent(testo)}`)}
              className="h-16 rounded-xl border border-[var(--color-bordo)] text-base font-medium disabled:opacity-40"
            >
              Manda un SMS
            </button>
          )}

          <button
            type="button"
            onClick={onChiudi}
            className="h-14 rounded-xl text-[var(--color-testo-tenue)]"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
