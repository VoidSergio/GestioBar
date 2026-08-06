'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { descriviSaldo, formatEuro, statoSaldo } from '@/lib/dominio/denaro';
import { etichettaCliente, type Ruolo } from '@/lib/dominio/clienti';
import { conSaldoProgressivo, raggruppaPerGiorno } from '@/lib/dominio/crediti';
import { PAGINA_MOVIMENTI, useCliente, useEstrattoConto } from '@/lib/hooks/use-cliente';
import { useApriConto } from '@/lib/hooks/use-bozze';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { PannelloIncasso } from './pannello-incasso';
import { PannelloRimozione } from './pannello-rimozione';

export function SchedaCliente({ id, ruolo }: { id: string; ruolo: Ruolo | null }) {
  const router = useRouter();
  const { data: cliente, isPending } = useCliente(id);
  const [quanti, setQuanti] = useState(PAGINA_MOVIMENTI);
  const {
    data: movimenti,
    isPending: caricoMovimenti,
    isFetching,
    fetchStatus,
    error,
  } = useEstrattoConto(id, quanti);
  const apri = useApriConto();
  const [incasso, setIncasso] = useState(false);
  const [rimozione, setRimozione] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);
  const [congedo, setCongedo] = useState<string | null>(null);

  // Tolto il cliente, questa schermata non ha più un soggetto: si dice com'è
  // andata e si torna all'elenco, invece di mostrare "cliente non trovato".
  useEffect(() => {
    if (!congedo) return;
    const t = setTimeout(() => router.push('/clienti'), 2000);
    return () => clearTimeout(t);
  }, [congedo, router]);

  // Se ne sono arrivati meno di quanti chiesti, sotto non c'è altro.
  const ceAltro = movimenti !== undefined && movimenti.length >= quanti;
  // Senza rete TanStack mette la richiesta in pausa invece di farla fallire:
  // senza questo controllo la schermata resterebbe con gli scheletri per
  // sempre, senza dire perché (03-ARCHITETTURA §4.5).
  const inPausa = fetchStatus === 'paused' && movimenti === undefined;

  // I progressivi si ancorano al saldo vero, non li si somma da zero: lo
  // storico è paginato, quindi le righe caricate non sono tutte le righe.
  const giorni = useMemo(
    () => raggruppaPerGiorno(conSaldoProgressivo(movimenti ?? [], cliente?.saldo_cent ?? 0)),
    [movimenti, cliente?.saldo_cent],
  );

  if (congedo) {
    return (
      <div
        role="status"
        className="flex h-dvh flex-col items-center justify-center gap-3 px-8 text-center"
      >
        <p className="text-5xl" aria-hidden>
          ✓
        </p>
        <p className="text-lg">{congedo}</p>
      </div>
    );
  }

  if (isPending) return <div className="h-dvh" aria-busy="true" />;

  if (!cliente) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-medium">Cliente non trovato.</p>
        <button
          type="button"
          onClick={() => router.push('/clienti')}
          className="mt-6 h-14 w-full rounded-xl bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)]"
        >
          Torna ai clienti
        </button>
      </main>
    );
  }

  const stato = statoSaldo(cliente.saldo_cent);

  async function apriConto() {
    if (!cliente) return;
    const idBozza = await apri(cliente.id, etichettaCliente(cliente));
    router.push(`/conto/${idBozza}`);
  }

  return (
    <main className="flex min-h-dvh flex-col pb-sicura">
      <header className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => router.push('/clienti')}
          aria-label="Torna ai clienti"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 pt-2">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{etichettaCliente(cliente)}</h1>
            <IndicatoreSync />
          </div>
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`} className="text-sm text-[var(--color-accento)]">
              {cliente.telefono}
            </a>
          )}
        </div>

        {/* Il ⋮ compare solo al titolare: a un barista non serve e non può */}
        {ruolo === 'titolare' && (
          <button
            type="button"
            onClick={() => setRimozione(true)}
            aria-label="Altre azioni su questo cliente"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
          >
            ⋮
          </button>
        )}
      </header>

      {/* Il numero grande della schermata */}
      <section className="mx-5 mt-2 rounded-2xl bg-[var(--color-superficie)] p-5">
        <p className="text-sm text-[var(--color-testo-tenue)]">
          {stato === 'deve' ? 'Deve' : stato === 'acconto' ? 'Ha un acconto di' : 'Saldo'}
        </p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            stato === 'deve'
              ? 'text-[var(--color-debito)]'
              : stato === 'acconto'
                ? 'text-[var(--color-positivo)]'
                : ''
          }`}
        >
          {formatEuro(Math.abs(cliente.saldo_cent))}
        </p>
        {stato === 'deve' && cliente.giorni_debito !== null && (
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
            {cliente.ultimo_pagamento_il
              ? `non paga da ${cliente.giorni_debito} giorni`
              : `dal primo movimento, ${cliente.giorni_debito} giorni fa`}
          </p>
        )}
        {stato === 'in_pari' && (
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">in pari</p>
        )}
      </section>

      {esito && (
        <p className="mx-5 mt-3 rounded-xl border border-[var(--color-positivo)]/30 bg-[var(--color-positivo)]/10 px-4 py-3 text-sm text-[var(--color-positivo)]">
          {esito}
        </p>
      )}

      <div className="mt-4 flex gap-3 px-5">
        <button
          type="button"
          onClick={() => void apriConto()}
          className="h-16 flex-1 rounded-xl border border-[var(--color-bordo)] font-semibold"
        >
          APRI CONTO
        </button>
        <button
          type="button"
          onClick={() => setIncasso(true)}
          disabled={cliente.saldo_cent <= 0}
          className="h-16 flex-1 rounded-xl bg-[var(--color-positivo)] font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-40"
        >
          INCASSA
        </button>
      </div>

      <section className="mt-6 flex-1">
        <h2 className="px-5 pb-2 text-sm font-semibold text-[var(--color-testo-tenue)]">
          MOVIMENTI
        </h2>

        {error || inPausa ? (
          <p className="px-8 py-8 text-center text-sm text-[var(--color-testo-tenue)]">
            Lo storico richiede la connessione. Il saldo qui sopra è comunque aggiornato.
          </p>
        ) : caricoMovimenti ? (
          <div className="space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : giorni.length === 0 ? (
          <p className="px-8 py-8 text-center text-sm text-[var(--color-testo-tenue)]">
            Nessun movimento ancora.
          </p>
        ) : (
          giorni.map((g) => (
            <div key={g.giorno}>
              <p className="bg-[var(--color-sfondo)] px-5 py-1.5 text-xs font-medium uppercase text-[var(--color-testo-tenue)]">
                {g.etichetta}
              </p>
              <ul className="divide-y divide-[var(--color-bordo)]">
                {g.movimenti.map((m) => (
                  <li key={m.movimento_id} className="flex items-baseline gap-3 px-5 py-2.5">
                    <span
                      className={`min-w-0 flex-1 text-sm ${
                        m.e_storno ? 'text-[var(--color-testo-tenue)] line-through' : ''
                      }`}
                    >
                      {m.descrizione}
                      {m.quantita > 1 && ` ×${m.quantita}`}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        m.tipo === 'pagamento' ? 'font-semibold text-[var(--color-positivo)]' : ''
                      }`}
                    >
                      {formatEuro(m.importo_cent, { segnoPiu: false })}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-[var(--color-testo-tenue)]">
                      {descriviSaldo(m.saldoProgressivoCent) === 'in pari'
                        ? '—'
                        : formatEuro(m.saldoProgressivoCent)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        {ceAltro && (
          <div className="px-5 py-5">
            <button
              type="button"
              onClick={() => setQuanti((q) => q + PAGINA_MOVIMENTI)}
              disabled={isFetching}
              className="h-14 w-full rounded-xl border border-[var(--color-bordo)] text-sm font-medium text-[var(--color-testo-tenue)] disabled:opacity-50"
            >
              {isFetching ? 'Carico…' : 'Carica altro'}
            </button>
          </div>
        )}
      </section>

      {incasso && (
        <PannelloIncasso
          cliente={cliente}
          onChiudi={() => setIncasso(false)}
          onIncassato={(residuo, resto) => {
            setIncasso(false);
            setEsito(
              resto > 0
                ? `Incassato. Resto da dare: ${formatEuro(resto)}.`
                : residuo > 0
                  ? `Incassato. Restano ${formatEuro(residuo)} a debito.`
                  : 'Incassato. Il cliente è in pari.',
            );
          }}
        />
      )}

      {rimozione && (
        <PannelloRimozione
          cliente={cliente}
          ruolo={ruolo}
          onChiudi={() => setRimozione(false)}
          onFatto={(messaggio) => {
            setRimozione(false);
            setCongedo(messaggio);
          }}
        />
      )}
    </main>
  );
}
