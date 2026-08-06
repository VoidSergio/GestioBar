'use client';

import { useEffect, useState } from 'react';
import { centesimiInCampo, formatEuro, parseEuro } from '@/lib/dominio/denaro';
import { scorciatoieChiusura, verificaChiusuraConto } from '@/lib/dominio/crediti';

/**
 * Il pannello di chiusura conto (04-UX-MOBILE.md §6).
 *
 * Mostra separati il conto di adesso e il debito che il cliente si trascina,
 * perché sono due cose che il barista deve poter leggere distinte prima di
 * decidere quanto chiedere. Le regole di calcolo stanno tutte in
 * `verificaChiusuraConto`: qui c'è solo l'interfaccia.
 */

const METODI = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'carta', etichetta: 'Carta' },
  { valore: 'altro', etichetta: 'Altro' },
];

/**
 * La spunta dello scontrino è quasi sempre la stessa: ricordarla evita un
 * tap a ogni conto. È una preferenza di comodo, non un dato: se si perde non
 * succede niente, quindi localStorage va benissimo.
 */
const CHIAVE_SCONTRINO = 'bar:scontrino-battuto';

function scontrinoRicordato(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CHIAVE_SCONTRINO) === 'si';
  } catch {
    return false;
  }
}

function ricordaScontrino(valore: boolean): void {
  try {
    window.localStorage.setItem(CHIAVE_SCONTRINO, valore ? 'si' : 'no');
  } catch {
    // Modalità privata o spazio esaurito: si perde la preferenza, nient'altro.
  }
}

interface Props {
  nomeCliente: string;
  totaleContoCent: number;
  debitoPrecedenteCent: number;
  haCliente: boolean;
  inCorso: boolean;
  onChiudi: () => void;
  onConferma: (dati: {
    importoCent: number;
    metodo: string;
    scontrinoBattuto: boolean;
    nuovoSaldoCent: number;
    restoCent: number;
  }) => void;
}

export function PannelloPagamento({
  nomeCliente,
  totaleContoCent,
  debitoPrecedenteCent,
  haCliente,
  inCorso,
  onChiudi,
  onConferma,
}: Props) {
  const dovutoCent = totaleContoCent + debitoPrecedenteCent;

  // Precompilato con il dovuto: il caso più frequente è "paga tutto",
  // e chi dà di meno cancella e riscrive.
  const [testo, setTesto] = useState(() => centesimiInCampo(Math.max(dovutoCent, 0)));
  const [metodo, setMetodo] = useState('contanti');
  const [scontrino, setScontrino] = useState(scontrinoRicordato);
  const [errore, setErrore] = useState<string | null>(null);

  const scorciatoie = scorciatoieChiusura(totaleContoCent, debitoPrecedenteCent);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const importoDato = parseEuro(testo);
  const esito =
    importoDato === null
      ? null
      : verificaChiusuraConto({
          totaleContoCent,
          debitoPrecedenteCent,
          importoDatoCent: importoDato,
          haCliente,
        });

  function conferma() {
    setErrore(null);

    if (importoDato === null) {
      setErrore('Importo non valido. Scrivi per esempio 12,50');
      return;
    }
    if (!esito || !esito.valido) {
      setErrore(esito && !esito.valido ? esito.errore : 'Importo non valido.');
      return;
    }

    ricordaScontrino(scontrino);
    onConferma({
      importoCent: esito.importoCent,
      metodo,
      scontrinoBattuto: scontrino,
      nuovoSaldoCent: esito.nuovoSaldoCent,
      restoCent: esito.restoCent,
    });
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

        <h2 className="pb-3 pt-4 text-lg font-semibold">Incassa da {nomeCliente}</h2>

        {/* Conto di adesso e debito vecchio restano separati: sono due cose */}
        <div className="rounded-xl bg-[var(--color-sfondo)] px-4 py-3 text-sm">
          <p className="flex justify-between">
            <span className="text-[var(--color-testo-tenue)]">Conto corrente</span>
            <span className="tabular-nums">{formatEuro(totaleContoCent)}</span>
          </p>
          {debitoPrecedenteCent !== 0 && (
            <p className="mt-1.5 flex justify-between">
              <span className="text-[var(--color-testo-tenue)]">
                {debitoPrecedenteCent > 0 ? 'Debito precedente' : 'Acconto precedente'}
              </span>
              <span
                className={`tabular-nums ${
                  debitoPrecedenteCent > 0
                    ? 'text-[var(--color-debito)]'
                    : 'text-[var(--color-positivo)]'
                }`}
              >
                {formatEuro(debitoPrecedenteCent)}
              </span>
            </p>
          )}
          <p className="mt-2 flex items-baseline justify-between border-t border-[var(--color-bordo)] pt-2">
            <span className="font-medium">Totale dovuto</span>
            <span className="text-2xl font-bold tabular-nums">{formatEuro(dovutoCent)}</span>
          </p>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">Quanto ti ha dato</span>
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            inputMode="decimal"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            className="h-16 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 text-2xl font-semibold tabular-nums outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        <div className="mt-3 flex gap-2">
          {scorciatoie.map((s) => (
            <button
              key={s.etichetta}
              type="button"
              onClick={() => setTesto(centesimiInCampo(s.importoCent))}
              className="h-12 flex-1 rounded-lg border border-[var(--color-bordo)] px-3 text-sm"
            >
              {s.etichetta} · {formatEuro(s.importoCent)}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-[var(--color-testo-tenue)]">Come</p>
        <div className="mt-1.5 flex gap-2">
          {METODI.map((m) => (
            <button
              key={m.valore}
              type="button"
              onClick={() => setMetodo(m.valore)}
              className={`h-14 flex-1 rounded-xl text-sm font-medium ${
                metodo === m.valore
                  ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                  : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
              }`}
            >
              {m.etichetta}
            </button>
          ))}
        </div>

        <label className="mt-4 flex min-h-14 items-center gap-3">
          <input
            type="checkbox"
            checked={scontrino}
            onChange={(e) => setScontrino(e.target.checked)}
            className="h-6 w-6 accent-[var(--color-accento)]"
          />
          <span className="text-sm">Scontrino battuto</span>
        </label>

        {/* Il conto della serva, prima di confermare */}
        {esito?.valido && (esito.restoCent > 0 || esito.nuovoSaldoCent > 0) && (
          <div className="mt-3 rounded-xl bg-[var(--color-sfondo)] px-4 py-3 text-sm">
            {esito.restoCent > 0 && (
              <p className="flex justify-between">
                <span className="text-[var(--color-testo-tenue)]">Resto da dare</span>
                <span className="font-semibold tabular-nums">{formatEuro(esito.restoCent)}</span>
              </p>
            )}
            {esito.nuovoSaldoCent > 0 && (
              <p className="flex justify-between">
                <span className="text-[var(--color-testo-tenue)]">Resta a debito</span>
                <span className="font-semibold tabular-nums text-[var(--color-debito)]">
                  {formatEuro(esito.nuovoSaldoCent)}
                </span>
              </p>
            )}
          </div>
        )}

        {errore && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        {/* Incassare non è reversibile: qui la conferma serve (04-UX §1) */}
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
            onClick={conferma}
            disabled={inCorso}
            className="h-16 flex-[2] rounded-xl bg-[var(--color-positivo)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
          >
            {inCorso ? 'Registro…' : 'CONFERMA'}
          </button>
        </div>
      </div>
    </div>
  );
}
