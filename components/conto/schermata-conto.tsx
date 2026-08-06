'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GrigliaProdotti } from './griglia-prodotti';
import { RigheConto } from './righe-conto';
import { PannelloPagamento } from './pannello-pagamento';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { descriviSaldo, formatEuro, statoSaldo } from '@/lib/dominio/denaro';
import { eVuota, totaleBozza } from '@/lib/dominio/bozza';
import { useAnnullaBozza, useBozza, useConfermaConto } from '@/lib/hooks/use-bozze';
import { useClienti } from '@/lib/hooks/use-clienti';
import { nuovoId } from '@/lib/utils';

/** Quanto resta a schermo il riepilogo dopo la conferma (04-UX-MOBILE §6). */
const DURATA_RIEPILOGO_MS = 2000;

interface Riepilogo {
  etichetta: string;
  nuovoSaldoCent: number;
  restoCent: number;
  haCliente: boolean;
}

export function SchermataConto({ id }: { id: string }) {
  const router = useRouter();
  const { bozza, caricata, aggiungiProdotto, diminuisciVoce } = useBozza(id);
  const { data: clienti } = useClienti();
  const conferma = useConfermaConto();
  const annulla = useAnnullaBozza();
  const [inCorso, setInCorso] = useState(false);
  const [pagamentoAperto, setPagamentoAperto] = useState(false);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);

  // Il riepilogo si guarda, non si tocca: due secondi e si torna alla home.
  useEffect(() => {
    if (!riepilogo) return;
    const t = setTimeout(() => router.push('/'), DURATA_RIEPILOGO_MS);
    return () => clearTimeout(t);
  }, [riepilogo, router]);

  if (!caricata) {
    return <div className="h-dvh" aria-busy="true" />;
  }

  // Prima del controllo sulla bozza: confermare la cancella, e senza questo
  // il riepilogo verrebbe sostituito da "questo conto non c'è più".
  if (riepilogo) {
    return <RiepilogoChiusura {...riepilogo} />;
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

  const debitoPrecedenteCent = cliente?.saldo_cent ?? 0;

  async function chiudi(modo: Parameters<typeof conferma>[1], esito: Riepilogo) {
    if (!bozza || vuota || inCorso) return;
    setInCorso(true);
    await conferma(bozza, modo);
    setPagamentoAperto(false);
    // Non si torna subito alla home: prima il barista vede com'è finita.
    setRiepilogo(esito);
  }

  /** A CREDITO chiude in un tap, senza conferma: è reversibile con uno storno. */
  function aCredito() {
    if (!bozza) return;
    void chiudi(
      { tipo: 'a_credito' },
      {
        etichetta: bozza.etichetta,
        nuovoSaldoCent: debitoPrecedenteCent + totale,
        restoCent: 0,
        haCliente: true,
      },
    );
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
      <header className="flex shrink-0 items-center gap-2 px-3 py-2">
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

      <section className="max-h-[30dvh] min-h-[80px] shrink-0 overflow-y-auto border-y border-[var(--color-bordo)]">
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

      <div className="min-h-0 flex-1 overflow-hidden">
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
      <footer className="shrink-0 border-t border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 pb-sicura pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-testo-tenue)]">Totale conto</span>
          <span className="text-2xl font-bold tabular-nums">{formatEuro(totale)}</span>
        </div>

        <div className="mt-3 flex gap-3 pb-3">
          <button
            type="button"
            disabled={vuota || inCorso}
            onClick={() => setPagamentoAperto(true)}
            className="h-16 flex-1 rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-40"
          >
            INCASSA
          </button>

          {/* Non compare sul banco: non c'è nessuno a cui addebitarlo */}
          {bozza.clienteId && (
            <button
              type="button"
              disabled={vuota || inCorso}
              onClick={aCredito}
              className="h-16 flex-1 rounded-xl border-2 border-[var(--color-debito)] text-lg font-semibold text-[var(--color-debito)] active:bg-[var(--color-debito)]/10 disabled:opacity-40"
            >
              A CREDITO
            </button>
          )}
        </div>
      </footer>

      {pagamentoAperto && (
        <PannelloPagamento
          nomeCliente={bozza.etichetta}
          totaleContoCent={totale}
          debitoPrecedenteCent={debitoPrecedenteCent}
          haCliente={bozza.clienteId !== null}
          inCorso={inCorso}
          onChiudi={() => setPagamentoAperto(false)}
          onConferma={(d) =>
            void chiudi(
              {
                tipo: 'incassato',
                importoCent: d.importoCent,
                metodo: d.metodo,
                scontrinoBattuto: d.scontrinoBattuto,
              },
              {
                etichetta: bozza.etichetta,
                nuovoSaldoCent: d.nuovoSaldoCent,
                restoCent: d.restoCent,
                haCliente: bozza.clienteId !== null,
              },
            )
          }
        />
      )}
    </main>
  );
}

/**
 * Che cosa è successo, per due secondi.
 *
 * Serve al barista, non al cliente: dopo aver incassato deve sapere se deve
 * dare un resto e quanto resta a debito, senza andarselo a cercare in un'altra
 * schermata mentre c'è fila.
 */
function RiepilogoChiusura({ nuovoSaldoCent, restoCent, haCliente, etichetta }: Riepilogo) {
  const stato = statoSaldo(nuovoSaldoCent);

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-[var(--color-sfondo)] px-8 text-center"
    >
      <p className="text-5xl" aria-hidden>
        ✓
      </p>

      {restoCent > 0 && (
        <>
          <p className="mt-2 text-sm text-[var(--color-testo-tenue)]">Resto da dare</p>
          <p className="text-4xl font-bold tabular-nums text-[var(--color-attenzione)]">
            {formatEuro(restoCent)}
          </p>
        </>
      )}

      {haCliente ? (
        <>
          <p className="mt-3 text-sm text-[var(--color-testo-tenue)]">
            {stato === 'deve' ? `${etichetta} ora deve` : etichetta}
          </p>
          <p
            className={`text-3xl font-bold tabular-nums ${
              stato === 'deve' ? 'text-[var(--color-debito)]' : ''
            }`}
          >
            {stato === 'deve' ? formatEuro(nuovoSaldoCent) : descriviSaldo(nuovoSaldoCent)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-lg text-[var(--color-testo-tenue)]">Conto chiuso</p>
      )}
    </div>
  );
}
