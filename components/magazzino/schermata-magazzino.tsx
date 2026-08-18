'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  cifreInMilli,
  daRiordinare,
  formatQuantita,
  ordinaGiacenze,
  UNITA,
  type Unita,
} from '@/lib/dominio/magazzino';
import { useCreaArticolo, useGiacenze, useScaricoAutomatico } from '@/lib/hooks/use-magazzino';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';
import type { Giacenza } from '@/lib/supabase/tipi';

/**
 * Il magazzino (T-30, T-31, T-34, T-35).
 *
 * Come il listino e i report, è una schermata da fermi: si apre quando arriva
 * il fornitore o la sera. Non insegue nessun vincolo di tap.
 *
 * In cima c'è quello che manca, e solo quello. L'elenco completo sta sotto:
 * un magazzino si guarda per sapere che cosa comprare, non per leggere
 * sessanta righe che vanno bene.
 */
export function SchermataMagazzino({ eTitolare }: { eTitolare: boolean }) {
  const { data: giacenze, isPending, error, refetch } = useGiacenze();
  const scarico = useScaricoAutomatico();
  const [creazione, setCreazione] = useState(false);

  const urgenti = useMemo(() => daRiordinare(giacenze ?? []), [giacenze]);
  const tutte = useMemo(() => ordinaGiacenze(giacenze ?? []), [giacenze]);

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-2 px-5 pb-3 pt-6">
          <Link
            href="/altro"
            aria-label="Torna indietro"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold">Magazzino</h1>
          <IndicatoreSync />
          {eTitolare && (
            <button
              type="button"
              onClick={() => setCreazione(true)}
              className="ml-auto h-11 shrink-0 rounded-lg bg-[var(--color-accento)] px-3 text-sm font-semibold text-[var(--color-sfondo)]"
            >
              + articolo
            </button>
          )}
        </header>

        {error ? (
          <AvvisoLettura
            errore={error}
            cosa="Il magazzino"
            rassicurazione="Si legge solo online, come il listino: le giacenze non servono al banco."
            onRiprova={() => void refetch()}
          />
        ) : isPending ? (
          <div className="space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : tutte.length === 0 ? (
          <div className="px-5">
            <p className="rounded-2xl bg-[var(--color-superficie)] px-5 py-6 text-sm text-[var(--color-testo-tenue)]">
              <strong className="block pb-1 text-[var(--color-testo)]">
                Il magazzino è vuoto
              </strong>
              Un articolo è <em>quello che compri</em> — il caffè in grani, il latte, i bicchieri —
              non quello che vendi. Il legame fra i due si chiama distinta base, e si scrive dentro
              la scheda dell&apos;articolo.
              {eTitolare && <span className="mt-2 block">Comincia da &ldquo;+ articolo&rdquo;.</span>}
            </p>
          </div>
        ) : (
          <>
            {urgenti.length > 0 && (
              <section className="px-5 pb-6">
                <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-attenzione)]">
                  Da comprare ({urgenti.length})
                </h2>
                <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl border border-[var(--color-attenzione)]/40 bg-[var(--color-superficie)]">
                  {urgenti.map((g) => (
                    <RigaArticolo key={g.id} giacenza={g} urgente />
                  ))}
                </ul>
              </section>
            )}

            <section className="px-5 pb-6">
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
                Tutto ({tutte.length})
              </h2>
              <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
                {tutte.map((g) => (
                  <RigaArticolo key={g.id} giacenza={g} />
                ))}
              </ul>
            </section>

            <section className="px-5 pb-6">
              <Link
                href="/magazzino/inventario"
                className="flex h-16 items-center justify-center rounded-xl border border-[var(--color-bordo)] font-semibold"
              >
                Fai l&apos;inventario
              </Link>
            </section>
          </>
        )}

        {eTitolare && (
          <section className="px-5 pb-8">
            <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
              Scarico automatico
            </h2>
            <div className="rounded-2xl bg-[var(--color-superficie)] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">
                  Le vendite scaricano il magazzino da sole
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scarico.acceso}
                  disabled={!scarico.caricato || scarico.cambia.isPending}
                  onClick={() => scarico.cambia.mutate(!scarico.acceso)}
                  className={`h-11 w-20 shrink-0 rounded-full text-xs font-bold ${
                    scarico.acceso
                      ? 'bg-[var(--color-positivo)] text-[var(--color-sfondo)]'
                      : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
                  }`}
                >
                  {scarico.acceso ? 'ACCESO' : 'SPENTO'}
                </button>
              </div>

              {/* Il motivo per cui nasce spento va detto qui, non solo nel
                  codice: chi lo accende deve sapere a che cosa si impegna. */}
              <p className="mt-3 text-xs text-[var(--color-testo-tenue)]">
                Nasce spento apposta. In un bar il consumo vero non coincide mai con quello
                teorico: sfridi, omaggi, il caffè venuto male, la dose a occhio. Acceso senza
                inventari periodici produce numeri falsi <strong>che sembrano veri</strong>, ed è
                peggio che non avere il magazzino — perché sui numeri falsi si fanno gli ordini.
              </p>
              {scarico.cambia.error && (
                <p role="alert" className="mt-2 text-xs text-[var(--color-debito)]">
                  {scarico.cambia.error.message}
                </p>
              )}
            </div>
          </section>
        )}

        <div className="h-6" />
      </main>

      <BarraNavigazione />

      {creazione && <ModuloNuovoArticolo onChiudi={() => setCreazione(false)} />}
    </div>
  );
}

function RigaArticolo({ giacenza: g, urgente = false }: { giacenza: Giacenza; urgente?: boolean }) {
  return (
    <li>
      <Link
        href={`/magazzino/${g.id}`}
        className="flex min-h-16 items-center gap-3 px-5 py-3 active:bg-[var(--color-superficie-alta)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{g.nome}</span>
          <span className="block text-xs text-[var(--color-testo-tenue)]">
            {g.mai_movimentato
              ? 'mai caricato'
              : g.scorta_minima_milli > 0
                ? `minimo ${formatQuantita(g.scorta_minima_milli, g.unita)}`
                : 'nessun minimo'}
            {g.fornitore && ` · ${g.fornitore}`}
          </span>
        </span>
        <span
          className={`shrink-0 text-lg font-semibold tabular-nums ${
            g.giacenza_milli < 0
              ? 'text-[var(--color-debito)]'
              : urgente
                ? 'text-[var(--color-attenzione)]'
                : ''
          }`}
        >
          {formatQuantita(g.giacenza_milli, g.unita)}
        </span>
      </Link>
    </li>
  );
}

/** Un articolo nuovo: nome, unità, e da quanto in giù avvisare. */
function ModuloNuovoArticolo({ onChiudi }: { onChiudi: () => void }) {
  const crea = useCreaArticolo();
  const [nome, setNome] = useState('');
  const [unita, setUnita] = useState<Unita>('pz');
  const [minimo, setMinimo] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  async function conferma() {
    setErrore(null);
    if (nome.trim() === '') {
      setErrore('Serve un nome.');
      return;
    }

    try {
      await crea.mutateAsync({
        nome: nome.trim(),
        unita,
        scortaMinimaMilli: cifreInMilli(minimo, unita),
        fornitoreId: null,
      });
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a salvarlo.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-superficie)] px-5 pb-sicura pt-3">
        <div className="flex justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <h2 className="pb-3 pt-4 text-lg font-semibold">Articolo nuovo</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Caffè in grani"
            autoCapitalize="sentences"
            autoFocus
            className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        <p className="pt-4 text-sm text-[var(--color-testo-tenue)]">Come si misura</p>
        <div className="mt-1.5 flex gap-2">
          {UNITA.map((u) => (
            <button
              key={u.valore}
              type="button"
              onClick={() => setUnita(u.valore)}
              aria-pressed={unita === u.valore}
              className={`h-14 flex-1 rounded-xl text-sm font-medium ${
                unita === u.valore
                  ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                  : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
              }`}
            >
              {u.etichetta}
            </button>
          ))}
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">
            Avvisami sotto (lascia vuoto per non essere avvisato)
          </span>
          <input
            value={minimo}
            onChange={(e) => setMinimo(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={unita === 'pz' || unita === 'conf' ? '6' : '2000'}
            className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 text-lg font-semibold tabular-nums outline-none focus:border-[var(--color-accento)]"
          />
          <span className="text-xs text-[var(--color-testo-tenue)]">
            {minimo === ''
              ? 'Nessun avviso'
              : `Avviso sotto ${formatQuantita(cifreInMilli(minimo, unita), unita)}`}
          </span>
        </label>

        {errore && (
          <p role="alert" className="mt-3 text-sm text-[var(--color-debito)]">
            {errore}
          </p>
        )}

        <div className="mt-5 flex gap-3 pb-5">
          <button
            type="button"
            onClick={onChiudi}
            className="h-16 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void conferma()}
            disabled={crea.isPending}
            className="h-16 flex-[2] rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] disabled:opacity-60"
          >
            {crea.isPending ? 'Salvo…' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  );
}
