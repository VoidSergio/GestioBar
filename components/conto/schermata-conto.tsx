'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GrigliaProdotti } from './griglia-prodotti';
import { RigheConto } from './righe-conto';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { descriviSaldo, formatEuro, statoSaldo } from '@/lib/dominio/denaro';
import { eVuota, totaleBozza } from '@/lib/dominio/bozza';
import { useAnnullaBozza, useBozza, useConfermaConto } from '@/lib/hooks/use-bozze';
import { useClienti } from '@/lib/hooks/use-clienti';
import { nuovoId } from '@/lib/utils';

export function SchermataConto({ id }: { id: string }) {
  const router = useRouter();
  const { bozza, caricata, aggiungiProdotto, diminuisciVoce } = useBozza(id);
  const { data: clienti } = useClienti();
  const conferma = useConfermaConto();
  const annulla = useAnnullaBozza();
  const [inCorso, setInCorso] = useState(false);

  if (!caricata) {
    return <div className="h-dvh" aria-busy="true" />;
  }

  if (!bozza) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-medium">Questo conto non c&apos;è più.</p>
        <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
          Può essere stato confermato o annullato.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 h-14 w-full rounded-xl bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)]"
        >
          Torna ai conti
        </button>
      </main>
    );
  }

  const cliente = bozza.clienteId
    ? (clienti ?? []).find((c) => c.id === bozza.clienteId)
    : undefined;
  const totale = totaleBozza(bozza);
  const vuota = eVuota(bozza);

  async function chiudi(modo: Parameters<typeof conferma>[1]) {
    if (!bozza || vuota || inCorso) return;
    setInCorso(true);
    await conferma(bozza, modo);
    router.push('/');
  }

  async function annullaConto() {
    if (!bozza) return;
    // Nessuna conferma se non c'è niente da perdere: le conferme inutili
    // costano un tap a ogni conto sbagliato per errore (04-UX-MOBILE.md §1).
    if (!vuota && !window.confirm('Annullare il conto? Le voci battute andranno perse.')) {
      return;
    }
    await annulla(bozza.id);
    router.push('/');
  }

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Torna ai conti"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold">{bozza.etichetta}</h1>
            <IndicatoreSync />
          </div>
          {/* Il contesto che serve a decidere: quanto deve già */}
          {cliente && statoSaldo(cliente.saldo_cent) !== 'in_pari' && (
            <p className="text-xs text-[var(--color-debito)]">
              {statoSaldo(cliente.saldo_cent) === 'deve' ? 'deve già ' : ''}
              {descriviSaldo(cliente.saldo_cent)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void annullaConto()}
          className="h-11 shrink-0 rounded-lg border border-[var(--color-bordo)] px-3 text-sm text-[var(--color-testo-tenue)]"
        >
          Annulla
        </button>
      </header>

      <section className="max-h-[30dvh] min-h-[80px] overflow-y-auto border-y border-[var(--color-bordo)]">
        <RigheConto
          voci={bozza.voci}
          onAumenta={(v) =>
            aggiungiProdotto({
              idRiga: nuovoId(),
              prodottoId: v.prodottoId,
              descrizione: v.descrizione,
              prezzoUnitarioCent: v.prezzoUnitarioCent,
            })
          }
          onDiminuisci={(v) => diminuisciVoce(v.id)}
        />
      </section>

      <div className="min-h-0 flex-1">
        <GrigliaProdotti
          onAggiungi={(scelta) => {
            aggiungiProdotto({
              idRiga: nuovoId(),
              prodottoId: scelta.prodottoId,
              descrizione: scelta.nome,
              prezzoUnitarioCent: scelta.prezzoCent,
            });
            if (navigator.vibrate) navigator.vibrate(8);
          }}
        />
      </div>

      {/* Barra del totale e azioni: fissa in basso, sempre visibile */}
      <footer className="border-t border-[var(--color-bordo)] px-4 pb-sicura pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-testo-tenue)]">Totale conto</span>
          <span className="text-2xl font-bold tabular-nums">{formatEuro(totale)}</span>
        </div>

        <div className="mt-3 flex gap-3 pb-3">
          <button
            type="button"
            disabled={vuota || inCorso}
            onClick={() =>
              void chiudi({ tipo: 'incassato', metodo: 'contanti', scontrinoBattuto: false })
            }
            className="h-16 flex-1 rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-40"
          >
            INCASSA
          </button>

          {/* Non compare sul banco: non c'è nessuno a cui addebitarlo */}
          {bozza.clienteId && (
            <button
              type="button"
              disabled={vuota || inCorso}
              onClick={() => void chiudi({ tipo: 'a_credito' })}
              className="h-16 flex-1 rounded-xl border-2 border-[var(--color-debito)] text-lg font-semibold text-[var(--color-debito)] active:bg-[var(--color-debito)]/10 disabled:opacity-40"
            >
              A CREDITO
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
