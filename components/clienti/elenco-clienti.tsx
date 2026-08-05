'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { descriviSaldo, formatEuro, statoSaldo } from '@/lib/dominio/denaro';
import { etichettaCliente, filtraClienti, ordinaPerRilevanza } from '@/lib/dominio/clienti';
import { useClienti } from '@/lib/hooks/use-clienti';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { ModuloNuovoCliente } from './modulo-nuovo-cliente';
import type { SaldoCliente } from '@/lib/supabase/tipi';

export function ElencoClienti() {
  const { data: clienti, isPending, error } = useClienti();
  const [ricerca, setRicerca] = useState('');
  const [creazioneAperta, setCreazioneAperta] = useState(false);

  const visibili = useMemo(
    () => ordinaPerRilevanza(filtraClienti(clienti ?? [], ricerca)),
    [clienti, ricerca],
  );

  const creditoTotale = useMemo(
    () => (clienti ?? []).reduce((somma, c) => somma + Math.max(c.saldo_cent, 0), 0),
    [clienti],
  );
  const debitori = useMemo(
    () => (clienti ?? []).filter((c) => c.saldo_cent > 0).length,
    [clienti],
  );

  return (
    <main className="flex h-dvh flex-col">
      <header className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Torna indietro"
              className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold">Clienti</h1>
            <IndicatoreSync />
          </div>
          {debitori > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-[var(--color-debito)]">
                {formatEuro(creditoTotale)}
              </p>
              <p className="text-xs text-[var(--color-testo-tenue)]">
                da {debitori} {debitori === 1 ? 'cliente' : 'clienti'}
              </p>
            </div>
          )}
        </div>

        <input
          type="search"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca per nome o soprannome"
          autoCapitalize="words"
          autoCorrect="off"
          className="mt-3 h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-superficie)] px-4 outline-none focus:border-[var(--color-accento)]"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <Vuoto
            titolo="Non riesco a leggere l'elenco"
            testo="Controlla la connessione e riprova."
          />
        ) : isPending ? (
          <div className="space-y-2 px-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : visibili.length === 0 ? (
          ricerca ? (
            <Vuoto
              titolo={`Nessun cliente per "${ricerca}"`}
              testo="Controlla come l'hai scritto, oppure creane uno nuovo."
            />
          ) : (
            <Vuoto
              titolo="Ancora nessun cliente"
              testo="Tocca + per registrare il primo. Basta il nome."
            />
          )
        ) : (
          <ul className="divide-y divide-[var(--color-bordo)]">
            {visibili.map((c) => (
              <RigaCliente key={c.id} cliente={c} />
            ))}
          </ul>
        )}
      </div>

      {/* Pulsante principale in basso a destra, raggiungibile col pollice */}
      <div className="pointer-events-none sticky bottom-0 flex justify-end p-4 pb-sicura">
        <button
          type="button"
          onClick={() => setCreazioneAperta(true)}
          aria-label="Nuovo cliente"
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accento)] text-3xl font-light text-[var(--color-sfondo)] shadow-lg active:brightness-90"
        >
          +
        </button>
      </div>

      {creazioneAperta && (
        <ModuloNuovoCliente
          nomeIniziale={ricerca}
          onChiudi={() => setCreazioneAperta(false)}
          onCreato={() => {
            setCreazioneAperta(false);
            setRicerca('');
          }}
        />
      )}
    </main>
  );
}

function RigaCliente({ cliente }: { cliente: SaldoCliente }) {
  const stato = statoSaldo(cliente.saldo_cent);
  const provvisorio = cliente.id.startsWith('provvisorio-');

  return (
    <li>
      <div
        className={`flex min-h-16 items-center gap-3 px-4 py-3 ${provvisorio ? 'opacity-60' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{etichettaCliente(cliente)}</span>
          <span className="block text-xs text-[var(--color-testo-tenue)]">
            {provvisorio
              ? 'salvataggio…'
              : cliente.telefono
                ? cliente.telefono
                : 'nessun telefono'}
          </span>
        </span>

        <span
          className={`shrink-0 text-right tabular-nums ${
            stato === 'deve'
              ? 'font-semibold text-[var(--color-debito)]'
              : stato === 'acconto'
                ? 'text-[var(--color-positivo)]'
                : 'text-[var(--color-testo-tenue)]'
          }`}
        >
          <span className="block text-base">{descriviSaldo(cliente.saldo_cent)}</span>
          {stato === 'deve' && cliente.giorni_debito !== null && (
            <span className="block text-xs opacity-80">da {cliente.giorni_debito} g</span>
          )}
        </span>
      </div>
    </li>
  );
}

function Vuoto({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="font-medium">{titolo}</p>
      <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">{testo}</p>
    </div>
  );
}
