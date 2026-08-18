'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  descriviInventario,
  differenzaInventario,
  formatQuantita,
  ordinaGiacenze,
} from '@/lib/dominio/magazzino';
import { useGiacenze, useRegistraMovimento } from '@/lib/hooks/use-magazzino';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { PannelloQuantita } from './pannello-quantita';
import type { Giacenza } from '@/lib/supabase/tipi';

/**
 * L'inventario (T-36).
 *
 * È la sola cosa che rimette in pari il magazzino, e per questo non è una
 * funzione in più: lo scarico automatico non può bloccare la cassa, quindi
 * quello che gli sfugge sfugge in silenzio (`0020_magazzino.sql`). Qui si
 * conta e si dice al programma quanto c'è davvero.
 *
 * **Si registra la differenza, non il contato.** I movimenti si sommano: un
 * "contato 1 kg" scritto come movimento aggiungerebbe un chilo a quello che
 * risultava già. La differenza la calcola `differenzaInventario`, che ha i
 * test intorno proprio perché è l'errore facile.
 *
 * Si conta un articolo alla volta e si registra subito: un inventario che
 * chiede di riempire trenta caselle e poi salvare, con il telefono in mano
 * davanti a uno scaffale, si interrompe a metà e non si salva mai.
 */
export function Inventario() {
  const { data: giacenze, isPending } = useGiacenze();
  const registra = useRegistraMovimento();
  const [inConteggio, setInConteggio] = useState<Giacenza | null>(null);
  const [fatti, setFatti] = useState<Record<string, string>>({});
  const [errore, setErrore] = useState<string | null>(null);

  async function conta(contatoMilli: number) {
    const articolo = inConteggio;
    if (!articolo) return;
    setErrore(null);

    const differenza = differenzaInventario(contatoMilli, articolo.giacenza_milli);

    // Zero non si scrive: il database rifiuta i movimenti nulli, e ha ragione
    // — una riga che non muove niente è solo rumore nello storico.
    if (differenza === 0) {
      setFatti((f) => ({ ...f, [articolo.id]: 'Tornava' }));
      setInConteggio(null);
      return;
    }

    try {
      await registra.mutateAsync({
        articoloId: articolo.id,
        tipo: 'rettifica',
        quantitaMilli: differenza,
        causale: 'Inventario',
      });
      setFatti((f) => ({
        ...f,
        [articolo.id]: descriviInventario(differenza, articolo.unita),
      }));
      setInConteggio(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a registrarlo.');
      setInConteggio(null);
    }
  }

  const elenco = ordinaGiacenze(giacenze ?? []);

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
          <h1 className="text-xl font-bold">Inventario</h1>
          <IndicatoreSync />
        </header>

        <p className="px-5 pb-4 text-sm text-[var(--color-testo-tenue)]">
          Conta quello che c&apos;è davvero e toccalo per scriverlo. La differenza la calcola
          l&apos;app e la registra come correzione, così resta scritto quanto mancava e quando.
          <span className="mt-2 block">
            Non serve farli tutti in una volta: ogni articolo si salva da solo.
          </span>
        </p>

        {errore && (
          <p role="alert" className="mx-5 mb-3 text-sm text-[var(--color-debito)]">
            {errore}
          </p>
        )}

        {isPending ? (
          <div className="space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : elenco.length === 0 ? (
          <p className="px-8 py-8 text-center text-sm text-[var(--color-testo-tenue)]">
            Non c&apos;è ancora niente da contare.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
            {elenco.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setInConteggio(g)}
                  className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left active:bg-[var(--color-superficie)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.nome}</span>
                    <span className="block text-xs text-[var(--color-testo-tenue)]">
                      risulta {formatQuantita(g.giacenza_milli, g.unita)}
                    </span>
                  </span>
                  {fatti[g.id] ? (
                    <span className="shrink-0 text-sm text-[var(--color-positivo)]">
                      ✓ {fatti[g.id]}
                    </span>
                  ) : (
                    <span aria-hidden className="shrink-0 text-[var(--color-testo-tenue)]">
                      conta →
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="h-8" />
      </main>

      <BarraNavigazione />

      {inConteggio && (
        <PannelloQuantita
          titolo={`Quanto c'è di ${inConteggio.nome}?`}
          sottotitolo={`Risulta ${formatQuantita(inConteggio.giacenza_milli, inConteggio.unita)}`}
          unita={inConteggio.unita}
          etichettaConferma="È questo"
          inCorso={registra.isPending}
          onChiudi={() => setInConteggio(null)}
          onConferma={(q) => void conta(q)}
        />
      )}
    </div>
  );
}
