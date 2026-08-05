'use client';

import { formatEuro } from '@/lib/dominio/denaro';
import type { VoceBozza } from '@/lib/dominio/bozza';

interface Props {
  voci: VoceBozza[];
  onAumenta: (voce: VoceBozza) => void;
  onDiminuisci: (voce: VoceBozza) => void;
}

/**
 * Le voci del conto in composizione.
 *
 * Due caffè sono **una voce ×2**: la bozza tiene la quantità, non due righe
 * (DEC-08). Finché non confermi si modifica liberamente.
 *
 * I pulsanti − e + stanno a destra, dove cade il pollice. Sono 44 px invece
 * dei 56 della regola generale: due bersagli da 56 affiancati mangerebbero il
 * nome del prodotto. Lo spazio *fra* i due è però pieno, ed è quello che
 * previene davvero i tocchi sbagliati. Da riesaminare nel collaudo T-18.
 */
export function RigheConto({ voci, onAumenta, onDiminuisci }: Props) {
  if (voci.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--color-testo-tenue)]">
        Tocca un prodotto per aggiungerlo.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-bordo)]">
      {voci.map((v) => (
        <li key={v.id} className="flex items-center gap-2 px-3 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{v.descrizione}</span>
            <span className="block text-xs tabular-nums text-[var(--color-testo-tenue)]">
              {formatEuro(v.prezzoUnitarioCent)} l&apos;uno
            </span>
          </span>

          <button
            type="button"
            aria-label={`Togli un ${v.descrizione}`}
            onClick={() => onDiminuisci(v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-bordo)] text-xl active:bg-[var(--color-superficie-alta)]"
          >
            −
          </button>

          <span className="w-7 shrink-0 text-center text-lg font-semibold tabular-nums">
            {v.quantita}
          </span>

          <button
            type="button"
            aria-label={`Aggiungi un ${v.descrizione}`}
            onClick={() => onAumenta(v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-bordo)] text-xl active:bg-[var(--color-superficie-alta)]"
          >
            +
          </button>

          <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
            {formatEuro(v.quantita * v.prezzoUnitarioCent)}
          </span>
        </li>
      ))}
    </ul>
  );
}
