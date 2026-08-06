'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { etichettaCliente } from '@/lib/dominio/clienti';
import {
  anzianitaDebito,
  filtraCrediti,
  ordinaPerAnzianita,
  soloDebitori,
  totaleDaIncassare,
  type FiltroCrediti,
} from '@/lib/dominio/crediti';
import { useClienti } from '@/lib/hooks/use-clienti';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { PannelloSollecito } from './pannello-sollecito';
import type { SaldoCliente } from '@/lib/supabase/tipi';

/**
 * La schermata per cui esiste il sistema (04-UX-MOBILE.md §7).
 *
 * L'ordine è per **anzianità**, non per importo: un debito piccolo e vecchio
 * è un problema, uno grande e recente no.
 */

const FILTRI: { valore: FiltroCrediti; etichetta: string }[] = [
  { valore: 'tutti', etichetta: 'Tutti' },
  { valore: 'oltre30', etichetta: '>30g' },
  { valore: 'oltre60', etichetta: '>60g' },
  { valore: 'sopra_limite', etichetta: 'Sopra' },
];

const COLORE: Record<ReturnType<typeof anzianitaDebito>, string> = {
  verde: 'var(--color-positivo)',
  arancione: 'var(--color-attenzione)',
  rosso: 'var(--color-debito)',
};

export function ElencoCrediti() {
  const { data: clienti, isPending } = useClienti();
  const [filtro, setFiltro] = useState<FiltroCrediti>('tutti');
  const [sollecito, setSollecito] = useState<SaldoCliente | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);

  const debitori = useMemo(() => soloDebitori(clienti ?? []), [clienti]);
  const visibili = useMemo(
    () => ordinaPerAnzianita(filtraCrediti(debitori, filtro)),
    [debitori, filtro],
  );

  // Il totale in cima è sempre quello complessivo, non quello del filtro:
  // è il numero che si vuole sapere entrando, e cambiarlo a ogni tap sui
  // filtri lo renderebbe inutilizzabile come riferimento.
  const totale = useMemo(() => totaleDaIncassare(debitori), [debitori]);

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="px-5 pb-2 pt-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Crediti</h1>
            <IndicatoreSync />
          </div>
        </header>

        <section className="mx-5 mt-2 rounded-2xl bg-[var(--color-superficie)] p-5">
          <p className="text-sm text-[var(--color-testo-tenue)]">Totale da incassare</p>
          <p
            className={`mt-1 text-4xl font-bold tabular-nums ${
              totale > 0 ? 'text-[var(--color-debito)]' : ''
            }`}
          >
            {formatEuro(totale)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
            {debitori.length === 0
              ? 'Nessuno ti deve soldi 🎉'
              : `da ${debitori.length} ${debitori.length === 1 ? 'cliente' : 'clienti'}`}
          </p>
        </section>

        {debitori.length > 0 && (
          <div className="mt-4 flex gap-2 px-5">
            {FILTRI.map((f) => (
              <button
                key={f.valore}
                type="button"
                onClick={() => setFiltro(f.valore)}
                className={`h-12 flex-1 rounded-lg text-sm font-medium ${
                  filtro === f.valore
                    ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                    : 'bg-[var(--color-superficie)] text-[var(--color-testo-tenue)]'
                }`}
              >
                {f.etichetta}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="mt-4 space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : debitori.length === 0 ? (
          <p className="px-8 py-12 text-center text-sm text-[var(--color-testo-tenue)]">
            Nessuno ti deve soldi 🎉
          </p>
        ) : visibili.length === 0 ? (
          <p className="px-8 py-12 text-center text-sm text-[var(--color-testo-tenue)]">
            Nessun cliente in questo gruppo.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
            {visibili.map((c) => (
              <RigaCredito
                key={c.id}
                cliente={c}
                aperta={espanso === c.id}
                onApri={() => setEspanso(espanso === c.id ? null : c.id)}
                onScrivi={() => setSollecito(c)}
              />
            ))}
          </ul>
        )}

        <div className="h-6" />
      </main>

      <BarraNavigazione />

      {sollecito && <PannelloSollecito cliente={sollecito} onChiudi={() => setSollecito(null)} />}
    </div>
  );
}

function RigaCredito({
  cliente,
  aperta,
  onApri,
  onScrivi,
}: {
  cliente: SaldoCliente;
  aperta: boolean;
  onApri: () => void;
  onScrivi: () => void;
}) {
  const colore = COLORE[anzianitaDebito(cliente.giorni_debito)];
  const giorni = cliente.giorni_debito ?? 0;

  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: colore }}
        />

        {/* Il nome porta alla scheda: è la scorciatoia più usata */}
        <Link href={`/clienti/${cliente.id}`} className="min-w-0 flex-1 py-2">
          <span className="block truncate font-medium">{etichettaCliente(cliente)}</span>
          <span className="block text-xs text-[var(--color-testo-tenue)]">
            da {giorni} {giorni === 1 ? 'giorno' : 'giorni'}
            {cliente.limite_credito_cent !== null &&
              cliente.saldo_cent > cliente.limite_credito_cent &&
              ' · oltre il limite'}
          </span>
        </Link>

        <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: colore }}>
          {formatEuro(cliente.saldo_cent)}
        </span>

        <button
          type="button"
          onClick={onApri}
          aria-expanded={aperta}
          aria-label={aperta ? 'Chiudi le azioni' : `Azioni per ${cliente.nome}`}
          className="flex h-14 w-11 shrink-0 items-center justify-center text-[var(--color-testo-tenue)]"
        >
          <span aria-hidden>{aperta ? '▴' : '▾'}</span>
        </button>
      </div>

      {aperta && (
        <div className="flex gap-2 px-5 pb-3">
          {cliente.telefono ? (
            <a
              href={`tel:${cliente.telefono}`}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-bordo)] text-sm font-medium"
            >
              <span aria-hidden>📞</span> Chiama
            </a>
          ) : (
            <span className="flex h-14 flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--color-bordo)] text-xs text-[var(--color-testo-tenue)]">
              Nessun telefono
            </span>
          )}

          <button
            type="button"
            onClick={onScrivi}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-bordo)] text-sm font-medium"
          >
            <span aria-hidden>💬</span> Scrivi
          </button>
        </div>
      )}
    </li>
  );
}
