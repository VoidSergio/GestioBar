'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { quantiPezzi, totaleBozza, totaleBozzeAperte } from '@/lib/dominio/bozza';
import { useApriConto, useBozze } from '@/lib/hooks/use-bozze';
import { useClienti } from '@/lib/hooks/use-clienti';
import { RicercaCliente } from '@/components/clienti/ricerca-cliente';
import { IndicatoreSync } from './indicatore-sync';
import { PulsanteEsci } from './pulsante-esci';
import { BarraNavigazione } from './barra-navigazione';
import { tempoTrascorso } from '@/lib/utils';

/**
 * La schermata di apertura (04-UX-MOBILE.md §3).
 *
 * Il numero grande è il **credito in giro**: è la ragione per cui esiste
 * tutto il progetto, e deve essere la prima cosa che si legge la mattina.
 */
export function HomeConti({ nome }: { nome: string | null }) {
  const router = useRouter();
  const { bozze, caricato } = useBozze();
  const { data: clienti } = useClienti();
  const apri = useApriConto();
  const [scelta, setScelta] = useState(false);

  const credito = useMemo(
    () => (clienti ?? []).reduce((s, c) => s + Math.max(c.saldo_cent, 0), 0),
    [clienti],
  );
  const debitori = useMemo(() => (clienti ?? []).filter((c) => c.saldo_cent > 0).length, [clienti]);

  const suBanco = totaleBozzeAperte(bozze);

  async function scegli(clienteId: string | null, etichetta: string) {
    const id = await apri(clienteId, etichetta);
    setScelta(false);
    router.push(`/conto/${id}`);
  }

  return (
    <div className="flex h-dvh flex-col">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Gestionale Bar</h1>
              <IndicatoreSync />
            </div>
            {nome && <p className="mt-0.5 text-sm text-[var(--color-testo-tenue)]">Ciao {nome}</p>}
          </div>
          <PulsanteEsci />
        </header>

        {/* Il numero più importante è il più grande (04-UX-MOBILE.md §1) */}
        <Link
          href="/crediti"
          className="mx-5 rounded-2xl bg-[var(--color-superficie)] p-5 active:bg-[var(--color-superficie-alta)]"
        >
          <p className="text-sm text-[var(--color-testo-tenue)]">Credito in giro</p>
          <p
            className={`mt-1 text-4xl font-bold tabular-nums ${
              credito > 0 ? 'text-[var(--color-debito)]' : ''
            }`}
          >
            {formatEuro(credito)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
            {debitori === 0
              ? 'Nessuno ti deve soldi 🎉'
              : `da ${debitori} ${debitori === 1 ? 'cliente' : 'clienti'}`}
          </p>
        </Link>

        <section className="mt-6 min-h-0 flex-1">
          <div className="flex items-baseline justify-between px-5 pb-2">
            <h2 className="text-sm font-semibold text-[var(--color-testo-tenue)]">
              CONTI APERTI {bozze.length > 0 && `(${bozze.length})`}
            </h2>
            {suBanco > 0 && (
              <span className="text-sm tabular-nums text-[var(--color-testo-tenue)]">
                {formatEuro(suBanco)}
              </span>
            )}
          </div>

          {!caricato ? (
            <div className="space-y-2 px-5" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-[var(--color-superficie)]"
                />
              ))}
            </div>
          ) : bozze.length === 0 ? (
            <p className="px-8 py-10 text-center text-sm text-[var(--color-testo-tenue)]">
              Nessun conto aperto — tocca <strong>+</strong> per aprirne uno.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
              {bozze.map((b) => (
                <li key={b.id}>
                  {/* Si apre toccando la riga intera, non un pulsante piccolo */}
                  <Link
                    href={`/conto/${b.id}`}
                    className="flex min-h-20 items-center gap-3 px-5 py-3 active:bg-[var(--color-superficie)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-medium">{b.etichetta}</span>
                      <span className="block text-xs text-[var(--color-testo-tenue)]">
                        aperto {tempoTrascorso(new Date(b.apertaIl))} · {quantiPezzi(b)}{' '}
                        {quantiPezzi(b) === 1 ? 'voce' : 'voci'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xl font-bold tabular-nums">
                      {formatEuro(totaleBozza(b))}
                    </span>
                    <span aria-hidden className="shrink-0 text-[var(--color-testo-tenue)]">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="pointer-events-none sticky bottom-0 flex justify-end p-5">
          <button
            type="button"
            onClick={() => setScelta(true)}
            aria-label="Apri un conto"
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accento)] text-3xl font-light text-[var(--color-sfondo)] shadow-lg active:brightness-90"
          >
            +
          </button>
        </div>
      </main>

      <BarraNavigazione />

      {scelta && (
        <RicercaCliente
          onScegli={(clienteId, etichetta) => void scegli(clienteId, etichetta)}
          onChiudi={() => setScelta(false)}
        />
      )}
    </div>
  );
}
