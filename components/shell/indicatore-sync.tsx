'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useStatoRete } from '@/lib/hooks/use-stato-rete';

/**
 * Stato della connessione, visibile su ogni schermata (04-UX-MOBILE.md §4.6).
 *
 * Tre stati, non di più: dietro al banco non si legge un cruscotto.
 *  - verde  → tutto a posto, nessun testo
 *  - ambra  → senza rete; l'app funziona, i dati sono quelli in memoria
 *  - rosso  → operazioni non inviate (arriva con la coda, T-09)
 *
 * Il conteggio delle operazioni in coda non c'è ancora: `inCoda` resta 0
 * finché T-09 non lo alimenta. La forma è già quella definitiva per non
 * dover ridisegnare il componente dopo.
 */
export function IndicatoreSync({ inCoda = 0 }: { inCoda?: number }) {
  const rete = useStatoRete();
  const inCorso = useIsFetching() > 0;

  if (inCoda > 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-debito)]">
        <Pallino colore="var(--color-debito)" />
        {inCoda} da inviare
      </span>
    );
  }

  if (rete === 'offline') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-attenzione)]">
        <Pallino colore="var(--color-attenzione)" />
        Senza rete
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-[var(--color-testo-tenue)]"
      aria-label={inCorso ? 'Aggiornamento in corso' : 'Collegato'}
    >
      <Pallino colore="var(--color-positivo)" pulsa={inCorso} />
    </span>
  );
}

function Pallino({ colore, pulsa = false }: { colore: string; pulsa?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: colore }}
      className={`inline-block h-2 w-2 rounded-full ${pulsa ? 'animate-pulse' : ''}`}
    />
  );
}
