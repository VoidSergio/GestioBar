'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { nomeCompleto } from '@/lib/dominio/listino';
import {
  conSegno,
  formatQuantita,
  MOVIMENTI,
  type TipoMovimento,
} from '@/lib/dominio/magazzino';
import { oraDelMovimento } from '@/lib/dominio/crediti';
import {
  useComposizioniDi,
  useGiacenze,
  useModificaArticolo,
  useMovimenti,
  useRegistraMovimento,
  useSalvaComposizione,
  useTogliComposizione,
} from '@/lib/hooks/use-magazzino';
import { useListino } from '@/lib/hooks/use-listino';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { PannelloQuantita } from './pannello-quantita';
import type { MovimentoMagazzino } from '@/lib/supabase/tipi';

/**
 * La scheda di un articolo: quanto ce n'è, che cosa lo muove, chi lo consuma
 * (T-32, T-33).
 *
 * Lo storico non è un ornamento: la giacenza **è** la somma di quelle righe
 * (DEC-02), e quando l'inventario non torna è lì che si va a guardare. Per
 * questo gli scarichi automatici portano scritto quale vendita li ha
 * provocati.
 */
export function SchedaArticolo({ id, eTitolare }: { id: string; eTitolare: boolean }) {
  const router = useRouter();
  const { data: giacenze, isPending } = useGiacenze();
  const movimenti = useMovimenti(id);
  const registra = useRegistraMovimento();
  const modifica = useModificaArticolo();
  const [tipo, setTipo] = useState<TipoMovimento | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const articolo = (giacenze ?? []).find((g) => g.id === id);

  if (isPending) return <div className="h-dvh" aria-busy="true" />;

  if (!articolo) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-medium">Questo articolo non c&apos;è più.</p>
        <button
          type="button"
          onClick={() => router.push('/magazzino')}
          className="mt-6 h-14 w-full rounded-xl bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)]"
        >
          Torna al magazzino
        </button>
      </main>
    );
  }

  async function registraMovimento(quantitaMilli: number) {
    if (!tipo || !articolo) return;
    setErrore(null);

    try {
      await registra.mutateAsync({
        articoloId: articolo.id,
        tipo,
        // Il segno lo mette il programma: il database rifiuterebbe un carico
        // negativo, e chi scarica un bancale non deve vedere quell'errore.
        quantitaMilli: conSegno(tipo, quantitaMilli),
        causale: tipo === 'rettifica' ? 'Correzione a mano' : undefined,
      });
      setTipo(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a registrarlo.');
      setTipo(null);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-2 px-5 pb-3 pt-6">
          <Link
            href="/magazzino"
            aria-label="Torna al magazzino"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{articolo.nome}</h1>
          <IndicatoreSync />
        </header>

        <div className="px-5 pb-5">
          <div className="rounded-2xl bg-[var(--color-superficie)] p-5">
            <p className="text-sm text-[var(--color-testo-tenue)]">In magazzino</p>
            <p
              className={`mt-1 text-4xl font-bold tabular-nums ${
                articolo.giacenza_milli < 0
                  ? 'text-[var(--color-debito)]'
                  : articolo.sotto_scorta && !articolo.mai_movimentato
                    ? 'text-[var(--color-attenzione)]'
                    : ''
              }`}
            >
              {formatQuantita(articolo.giacenza_milli, articolo.unita)}
            </p>
            {articolo.giacenza_milli < 0 && (
              <p className="mt-1 text-sm text-[var(--color-debito)]">
                Sotto zero: è stato venduto più di quello che risultava esserci. Lo sistema
                l&apos;inventario.
              </p>
            )}
            {articolo.scorta_minima_milli > 0 && (
              <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
                avviso sotto {formatQuantita(articolo.scorta_minima_milli, articolo.unita)}
              </p>
            )}
          </div>
        </div>

        {errore && (
          <p role="alert" className="mx-5 mb-4 text-sm text-[var(--color-debito)]">
            {errore}
          </p>
        )}

        {/* ------------------------------------------------ i movimenti */}
        <section className="px-5 pb-6">
          <div className="flex gap-2">
            {MOVIMENTI.map((m) => (
              <button
                key={m.tipo}
                type="button"
                onClick={() => setTipo(m.tipo)}
                className="flex h-16 flex-1 flex-col items-center justify-center rounded-xl border border-[var(--color-bordo)] px-2"
              >
                <span className="text-sm font-semibold">{m.etichetta}</span>
                <span className="text-[10px] leading-tight text-[var(--color-testo-tenue)]">
                  {m.spiegazione}
                </span>
              </button>
            ))}
          </div>
        </section>

        {eTitolare && (
          <DistintaBase articoloId={articolo.id} unita={articolo.unita} />
        )}

        <StoricoMovimenti movimenti={movimenti.data ?? []} unita={articolo.unita} />

        {eTitolare && (
          <div className="px-5 py-6">
            <button
              type="button"
              onClick={() => modifica.mutate({ id: articolo.id, campi: { attivo: false } })}
              className="h-14 w-full rounded-xl border border-[var(--color-bordo)] text-sm text-[var(--color-testo-tenue)]"
            >
              Togli dal magazzino
            </button>
            <p className="mt-2 text-xs text-[var(--color-testo-tenue)]">
              Sparisce dagli elenchi. I movimenti restano: è la storia di quello che è entrato e
              uscito, e serve a spiegare i conti di prima.
            </p>
          </div>
        )}
      </main>

      <BarraNavigazione />

      {tipo && (
        <PannelloQuantita
          titolo={MOVIMENTI.find((m) => m.tipo === tipo)?.etichetta ?? 'Movimento'}
          sottotitolo={`${articolo.nome} — ci sono ${formatQuantita(articolo.giacenza_milli, articolo.unita)}`}
          unita={articolo.unita}
          etichettaConferma="Registra"
          inCorso={registra.isPending}
          onChiudi={() => setTipo(null)}
          onConferma={(q) => void registraMovimento(q)}
        />
      )}
    </div>
  );
}

/**
 * Chi consuma questo articolo, e quanto (T-33).
 *
 * Si scrive dal lato dell'articolo e non del prodotto perché è così che ci si
 * pensa: "un cappuccino quanto latte si mangia" si risponde avendo davanti il
 * latte, non il cappuccino.
 */
function DistintaBase({ articoloId, unita }: { articoloId: string; unita: 'pz' | 'kg' | 'l' | 'conf' }) {
  const { data: composizioni } = useComposizioniDi(articoloId);
  const { data: listino } = useListino();
  const salva = useSalvaComposizione();
  const togli = useTogliComposizione();
  const [aggiunta, setAggiunta] = useState<string | null>(null);

  const prodotti = useMemo(
    () => (listino ?? []).filter((p) => p.attivo).slice().sort((a, b) => a.nome_base.localeCompare(b.nome_base, 'it')),
    [listino],
  );
  const perId = useMemo(() => new Map(prodotti.map((p) => [p.id, p])), [prodotti]);

  return (
    <section className="px-5 pb-6">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
        Lo consumano
      </h2>

      {(composizioni ?? []).length === 0 ? (
        <p className="rounded-2xl bg-[var(--color-superficie)] px-5 py-4 text-sm text-[var(--color-testo-tenue)]">
          Nessun prodotto ancora. Serve solo se accendi lo scarico automatico: senza, il magazzino
          si muove a mano e va benissimo.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
          {(composizioni ?? []).map((c) => {
            const p = perId.get(c.prodotto_id);
            return (
              <li key={c.prodotto_id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p ? nomeCompleto(p.nome_base, p.variante) : 'prodotto tolto dal listino'}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatQuantita(c.quantita_milli, unita)}
                </span>
                <button
                  type="button"
                  onClick={() => togli.mutate({ prodottoId: c.prodotto_id, articoloId })}
                  aria-label="Togli"
                  className="h-11 w-11 shrink-0 rounded-lg border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <select
        value=""
        onChange={(e) => e.target.value && setAggiunta(e.target.value)}
        aria-label="Aggiungi un prodotto che consuma questo articolo"
        className="mt-3 h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 text-sm"
      >
        <option value="">+ un prodotto che lo consuma…</option>
        {prodotti.map((p) => (
          <option key={p.id} value={p.id}>
            {nomeCompleto(p.nome_base, p.variante)}
          </option>
        ))}
      </select>

      {aggiunta && (
        <PannelloQuantita
          titolo="Quanto ne consuma"
          sottotitolo={(() => {
            const p = perId.get(aggiunta);
            return p ? `Un ${nomeCompleto(p.nome_base, p.variante)}` : undefined;
          })()}
          unita={unita}
          etichettaConferma="Salva"
          inCorso={salva.isPending}
          onChiudi={() => setAggiunta(null)}
          onConferma={(q) => {
            salva.mutate({ prodotto_id: aggiunta, articolo_id: articoloId, quantita_milli: q });
            setAggiunta(null);
          }}
        />
      )}
    </section>
  );
}

function StoricoMovimenti({
  movimenti,
  unita,
}: {
  movimenti: readonly MovimentoMagazzino[];
  unita: 'pz' | 'kg' | 'l' | 'conf';
}) {
  if (movimenti.length === 0) {
    return (
      <section className="px-5 pb-6">
        <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
          Storia
        </h2>
        <p className="rounded-2xl bg-[var(--color-superficie)] px-5 py-4 text-sm text-[var(--color-testo-tenue)]">
          Non si è ancora mosso niente.
        </p>
      </section>
    );
  }

  return (
    <section className="px-5 pb-6">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
        Storia
      </h2>
      <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
        {movimenti.map((m) => (
          <li key={m.id} className="flex items-baseline gap-3 px-5 py-3">
            <span className="w-24 shrink-0 text-xs text-[var(--color-testo-tenue)]">
              {new Date(m.creato_il).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
              })}{' '}
              {oraDelMovimento(m.creato_il)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {m.causale ?? etichettaTipo(m.tipo)}
            </span>
            <span
              className={`shrink-0 tabular-nums ${
                m.quantita_milli > 0
                  ? 'text-[var(--color-positivo)]'
                  : 'text-[var(--color-testo-tenue)]'
              }`}
            >
              {m.quantita_milli > 0 ? '+' : ''}
              {formatQuantita(m.quantita_milli, unita)}
            </span>
          </li>
        ))}
      </ul>
      {movimenti.some((m) => m.costo_unitario_cent !== null) && (
        <p className="mt-2 text-xs text-[var(--color-testo-tenue)]">
          Ultimo costo registrato:{' '}
          {formatEuro(movimenti.find((m) => m.costo_unitario_cent !== null)?.costo_unitario_cent ?? 0)}
        </p>
      )}
    </section>
  );
}

function etichettaTipo(tipo: string): string {
  const trovato = MOVIMENTI.find((m) => m.tipo === tipo);
  if (trovato) return trovato.etichetta;
  return tipo === 'scarico' ? 'Venduto' : tipo;
}
