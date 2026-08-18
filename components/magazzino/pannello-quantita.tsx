'use client';

import { useEffect, useState } from 'react';
import { anteprimaQuantita, cifreInMilli, interaSoltanto, type Unita } from '@/lib/dominio/magazzino';
import { Tastierino } from '@/components/comune/tastierino';

/**
 * Il pannello che chiede una quantità.
 *
 * Stesso tastierino degli importi, stessa regola: le cifre entrano da destra
 * e la virgola non si scrive mai. Quello che cambia è quanto vale l'ultima
 * cifra — un grammo per i chili, un pezzo intero per i pezzi — e il pannello
 * lo dice sotto il numero, perché "1250" davanti a un bancale deve essere
 * leggibile senza pensarci.
 */
export function PannelloQuantita({
  titolo,
  sottotitolo,
  unita,
  etichettaConferma,
  inCorso,
  onChiudi,
  onConferma,
}: {
  titolo: string;
  sottotitolo?: string;
  unita: Unita;
  etichettaConferma: string;
  inCorso?: boolean;
  onChiudi: () => void;
  onConferma: (quantitaMilli: number) => void;
}) {
  const [cifre, setCifre] = useState('');

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const milli = cifreInMilli(cifre, unita);

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative flex max-h-[96dvh] w-full flex-col rounded-t-3xl bg-[var(--color-superficie)] pb-sicura">
        <div className="shrink-0 px-4 pt-3">
          <div className="flex justify-center pb-3">
            <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
          </div>

          <h2 className="text-lg font-semibold">{titolo}</h2>
          {sottotitolo && (
            <p className="pt-0.5 text-sm text-[var(--color-testo-tenue)]">{sottotitolo}</p>
          )}

          <output
            aria-live="polite"
            aria-label="Quantità"
            className="mt-3 flex h-16 items-center justify-end gap-2 rounded-xl border border-[var(--color-accento)] bg-[var(--color-sfondo)] px-4"
          >
            <span className="text-3xl font-bold tabular-nums">
              {anteprimaQuantita(cifre, unita)}
            </span>
            <span className="pb-1 text-lg text-[var(--color-testo-tenue)]">{unita}</span>
          </output>

          <p className="pt-1.5 text-xs text-[var(--color-testo-tenue)]">
            {interaSoltanto(unita)
              ? 'Le cifre sono pezzi interi.'
              : 'Le cifre entrano da destra: 1250 è 1,250.'}
          </p>
        </div>

        <div className="shrink-0 px-4 pb-3 pt-3">
          <Tastierino
            descrizione="quantità"
            onCifre={(c) => setCifre((a) => (a + c).slice(0, 7))}
            onCancella={() => setCifre((a) => a.slice(0, -1))}
          />

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onChiudi}
              className="h-14 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onConferma(milli)}
              disabled={milli === 0 || inCorso}
              className="h-14 flex-[2] rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] disabled:opacity-40"
            >
              {inCorso ? 'Registro…' : etichettaConferma}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
