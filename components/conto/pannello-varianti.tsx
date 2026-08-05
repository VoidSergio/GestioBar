'use client';

import { useEffect, useRef } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import type { RiquadroGriglia, VarianteProdotto } from '@/lib/supabase/tipi';

interface Props {
  riquadro: RiquadroGriglia;
  onScegli: (variante: VarianteProdotto) => void;
  onChiudi: () => void;
}

/**
 * Elenco delle varianti di un prodotto, aperto dal ▾ o da una pressione lunga.
 *
 * Sale dal basso: le voci devono cadere sotto il pollice, non in cima allo
 * schermo (04-UX-MOBILE.md §1).
 */
export function PannelloVarianti({ riquadro, onScegli, onChiudi }: Props) {
  const riferimento = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Varianti di ${riquadro.nome_base}`}
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div
        ref={riferimento}
        className="relative w-full rounded-t-3xl bg-[var(--color-superficie)] pb-sicura"
      >
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <h2 className="px-5 pb-2 pt-4 text-lg font-semibold">{riquadro.nome_base}</h2>

        <ul className="max-h-[60dvh] overflow-y-auto pb-4">
          {riquadro.varianti.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onScegli(v)}
                className="flex h-14 w-full items-center justify-between px-5 text-left active:bg-[var(--color-superficie-alta)]"
              >
                <span className="capitalize">
                  {v.variante === 'normale' ? 'Normale' : v.variante}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatEuro(v.prezzo_cent)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
