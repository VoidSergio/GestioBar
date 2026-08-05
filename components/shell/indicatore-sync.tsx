'use client';

import { useState } from 'react';
import { descriviOperazione } from '@/lib/dominio/coda';
import { useCoda } from '@/lib/hooks/use-coda';
import { useStatoRete } from '@/lib/hooks/use-stato-rete';
import { riprova, scarta } from '@/lib/offline/coda';
import { sollecitaSync } from '@/lib/offline/sync';

/**
 * Stato della connessione e della coda, visibile su ogni schermata
 * (04-UX-MOBILE.md §4.6).
 *
 * Tre stati, non di più: dietro al banco non si legge un cruscotto.
 *  - verde  → tutto inviato
 *  - ambra  → operazioni in coda, oppure senza rete: l'app funziona lo stesso
 *  - rosso  → qualcosa non è stato registrato e serve una decisione
 */
export function IndicatoreSync() {
  const rete = useStatoRete();
  const { voci, inAttesa, fallite } = useCoda();
  const [aperto, setAperto] = useState(false);

  if (fallite > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAperto(true)}
          className="flex h-11 items-center gap-1.5 text-xs font-medium text-[var(--color-debito)]"
        >
          <Pallino colore="var(--color-debito)" />
          {fallite === 1 ? '1 non registrata' : `${fallite} non registrate`}
        </button>
        {aperto && <PannelloProblemi voci={voci} onChiudi={() => setAperto(false)} />}
      </>
    );
  }

  if (inAttesa > 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-attenzione)]">
        <Pallino colore="var(--color-attenzione)" pulsa />
        {inAttesa} da inviare
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
    <span className="flex items-center gap-1.5 text-xs" aria-label="Collegato">
      <Pallino colore="var(--color-positivo)" />
    </span>
  );
}

function PannelloProblemi({
  voci,
  onChiudi,
}: {
  voci: ReturnType<typeof useCoda>['voci'];
  onChiudi: () => void;
}) {
  const fallite = voci.filter((v) => v.stato === 'fallita');

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Chiudi" onClick={onChiudi} className="absolute inset-0 bg-black/60" />

      <div className="relative max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-superficie)] pb-sicura">
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <div className="px-5 pb-2 pt-4">
          <h2 className="text-lg font-semibold">Operazioni non registrate</h2>
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
            Queste non sono arrivate al server. Riprova, oppure scartale se non
            servono più — per esempio se il conto è già stato chiuso da un altro
            dispositivo.
          </p>
        </div>

        <ul className="divide-y divide-[var(--color-bordo)]">
          {fallite.map((v) => (
            <li key={v.opId} className="px-5 py-4">
              <p className="font-medium">{descriviOperazione(v.operazione)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-testo-tenue)]">
                {new Date(v.creataIl).toLocaleString('it-IT')}
                {v.ultimoErrore ? ` · ${v.ultimoErrore}` : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void riprova(v.opId).then(() => sollecitaSync());
                  }}
                  className="h-11 flex-1 rounded-lg bg-[var(--color-accento)] text-sm font-medium text-[var(--color-sfondo)]"
                >
                  Riprova
                </button>
                <button
                  type="button"
                  onClick={() => void scarta(v.opId)}
                  className="h-11 flex-1 rounded-lg border border-[var(--color-bordo)] text-sm text-[var(--color-testo-tenue)]"
                >
                  Scarta
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-5 pb-6 pt-2">
          <button
            type="button"
            onClick={onChiudi}
            className="h-14 w-full rounded-xl border border-[var(--color-bordo)]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
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
