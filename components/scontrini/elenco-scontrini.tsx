'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { etichettaGiorno } from '@/lib/dominio/crediti';
import {
  chiHaPagato,
  eOggi,
  filtraPerGruppo,
  giornoSpostato,
  perMetodo,
  riassumiScontrini,
  type GruppoScontrini,
} from '@/lib/dominio/scontrini';
import { useScontrini } from '@/lib/hooks/use-scontrini';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { useCorreggiScontrino } from '@/lib/hooks/use-correggi-scontrino';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';
import type { MovimentoScontrino } from '@/lib/supabase/tipi';

/**
 * Che cosa è stato scontrinato e che cosa no, una giornata alla volta.
 *
 * Serve a quadrare a fine turno: i soldi in cassa devono trovare riscontro
 * nel registratore. Il sistema non emette scontrini (01-VISIONE §2), registra
 * solo se sono stati battuti.
 *
 * I tre numeri in cima **non si sommano fra loro**, ed è il punto della
 * schermata: "non scontrinato" sono soldi entrati senza battere, "a credito"
 * è merce uscita senza che entrasse niente. Il primo è un problema di cassa,
 * il secondo è un credito che si incasserà.
 */

const ETICHETTE: Record<GruppoScontrini, string> = {
  scontrinato: 'Scontrinato',
  non_scontrinato: 'Non scontrinato',
  a_credito: 'A credito',
};

const NOMI_METODO: Record<string, string> = {
  contanti: 'Contanti',
  carta: 'Carta',
  bonifico: 'Bonifico',
  altro: 'Altro',
};

export function ElencoScontrini({ puoCorreggere = false }: { puoCorreggere?: boolean }) {
  const [giorno, setGiorno] = useState(() => {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    return oggi;
  });
  const [gruppo, setGruppo] = useState<GruppoScontrini>('non_scontrinato');

  const { data: movimenti, isPending, fetchStatus, error, refetch } = useScontrini(giorno);

  const riassunto = useMemo(() => riassumiScontrini(movimenti ?? []), [movimenti]);
  const visibili = useMemo(() => filtraPerGruppo(movimenti ?? [], gruppo), [movimenti, gruppo]);
  const metodi = useMemo(() => [...perMetodo(movimenti ?? [])], [movimenti]);

  const inPausa = fetchStatus === 'paused' && movimenti === undefined;
  const oggi = eOggi(giorno);

  const CONTATORI: Record<GruppoScontrini, number> = {
    scontrinato: riassunto.nScontrinati,
    non_scontrinato: riassunto.nNonScontrinati,
    a_credito: riassunto.nACredito,
  };

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="px-5 pb-2 pt-6">
          <div className="flex items-center gap-2">
            <Link
              href="/altro"
              aria-label="Torna indietro"
              className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold">Scontrini</h1>
            <IndicatoreSync />
          </div>
        </header>

        {/* Le due frecce: la quadratura si fa a fine turno, ma capita di
            controllare ieri la mattina dopo */}
        <div className="mx-5 mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGiorno((g) => giornoSpostato(g, -1))}
            aria-label="Giorno precedente"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-bordo)] text-xl"
          >
            ‹
          </button>
          <p className="flex-1 text-center text-base font-medium">{etichettaGiorno(giorno)}</p>
          <button
            type="button"
            onClick={() => setGiorno((g) => giornoSpostato(g, 1))}
            disabled={oggi}
            aria-label="Giorno successivo"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-bordo)] text-xl disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {/* Il numero grande è quello che non quadra, non quello che quadra */}
        <section className="mx-5 mt-4 rounded-2xl bg-[var(--color-superficie)] p-5">
          <p className="text-sm text-[var(--color-testo-tenue)]">Incassato senza scontrino</p>
          <p
            className={`mt-1 text-4xl font-bold tabular-nums ${
              riassunto.nonScontrinatoCent > 0 ? 'text-[var(--color-attenzione)]' : ''
            }`}
          >
            {formatEuro(riassunto.nonScontrinatoCent)}
          </p>

          <dl className="mt-4 space-y-1.5 border-t border-[var(--color-bordo)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-testo-tenue)]">Scontrinato</dt>
              <dd className="tabular-nums text-[var(--color-positivo)]">
                {formatEuro(riassunto.scontrinatoCent)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-testo-tenue)]">Incassato in tutto</dt>
              <dd className="font-semibold tabular-nums">{formatEuro(riassunto.incassatoCent)}</dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-[var(--color-testo-tenue)]">Uscito a credito</dt>
              <dd className="tabular-nums text-[var(--color-debito)]">
                {formatEuro(riassunto.aCreditoCent)}
              </dd>
            </div>
          </dl>

          {/* Detto una volta, perché è la cosa che si sbaglia a leggere */}
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-testo-tenue)]">
            Il credito non è entrato in cassa: non si somma all’incassato. Diventerà un incasso il
            giorno in cui il cliente paga.
          </p>
        </section>

        {metodi.length > 0 && (
          <section className="mx-5 mt-3 rounded-2xl bg-[var(--color-superficie)] px-5 py-4">
            <p className="pb-2 text-xs font-semibold uppercase text-[var(--color-testo-tenue)]">
              Incassato per metodo
            </p>
            <dl className="space-y-1.5 text-sm">
              {metodi.map(([metodo, totale]) => (
                <div key={metodo} className="flex justify-between">
                  <dt className="text-[var(--color-testo-tenue)]">
                    {NOMI_METODO[metodo] ?? metodo}
                  </dt>
                  <dd className="tabular-nums">{formatEuro(totale)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="mt-4 flex gap-2 px-5">
          {(['non_scontrinato', 'scontrinato', 'a_credito'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGruppo(g)}
              className={`h-12 flex-1 rounded-lg px-2 text-xs font-medium ${
                gruppo === g
                  ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                  : 'bg-[var(--color-superficie)] text-[var(--color-testo-tenue)]'
              }`}
            >
              {ETICHETTE[g]}
              {CONTATORI[g] > 0 && ` (${CONTATORI[g]})`}
            </button>
          ))}
        </div>

        {error || inPausa ? (
          <AvvisoLettura errore={error} onRiprova={() => void refetch()} />
        ) : isPending ? (
          <div className="mt-4 space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : visibili.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-[var(--color-testo-tenue)]">
            {gruppo === 'non_scontrinato'
              ? 'Tutto scontrinato 🎉'
              : gruppo === 'a_credito'
                ? 'Niente a credito in questa giornata.'
                : 'Niente di scontrinato in questa giornata.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
            {visibili.map((m) => (
              <RigaScontrino key={m.movimento_id} movimento={m} puoCorreggere={puoCorreggere} />
            ))}
          </ul>
        )}

        <div className="h-6" />
      </main>

      <BarraNavigazione />
    </div>
  );
}

const ORA = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

function RigaScontrino({
  movimento,
  puoCorreggere,
}: {
  movimento: MovimentoScontrino;
  puoCorreggere: boolean;
}) {
  const aCredito = movimento.tipo === 'a_credito';
  const correggi = useCorreggiScontrino();

  // Un movimento a credito non ha uno scontrino da battere: non c'è niente
  // da correggere, e offrire il pulsante inviterebbe a cercare una ricevuta
  // che non deve esistere.
  const correggibile = puoCorreggere && !aCredito;

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{chiHaPagato(movimento)}</span>
        <span className="block text-xs text-[var(--color-testo-tenue)]">
          {ORA.format(new Date(movimento.data))}
          {movimento.conto_numero !== null && ` · conto n. ${movimento.conto_numero}`}
          {movimento.metodo && ` · ${NOMI_METODO[movimento.metodo] ?? movimento.metodo}`}
        </span>
      </span>

      <span
        className={`shrink-0 text-lg font-bold tabular-nums ${
          aCredito
            ? 'text-[var(--color-debito)]'
            : movimento.scontrino_battuto
              ? ''
              : 'text-[var(--color-attenzione)]'
        }`}
      >
        {formatEuro(movimento.importo_cent)}
      </span>

      {correggibile && (
        <button
          onClick={() =>
            void correggi.mutateAsync({
              pagamentoId: movimento.movimento_id,
              battuto: !movimento.scontrino_battuto,
            })
          }
          aria-label={
            movimento.scontrino_battuto
              ? 'Segna come non scontrinato'
              : 'Segna come scontrinato'
          }
          aria-pressed={movimento.scontrino_battuto}
          className={`size-14 shrink-0 rounded-xl border text-xl ${
            movimento.scontrino_battuto
              ? 'border-[var(--color-bordo)] text-[var(--color-positivo)]'
              : 'border-[var(--color-attenzione)] text-[var(--color-testo-tenue)]'
          }`}
        >
          {movimento.scontrino_battuto ? '🧾' : '—'}
        </button>
      )}
    </li>
  );
}
