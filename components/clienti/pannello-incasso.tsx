'use client';

import { useEffect, useState } from 'react';
import { cancellaCifra, centesimiInCampo, digitaCifre, formatEuro } from '@/lib/dominio/denaro';
import { scorciatoieIncasso, verificaIncasso } from '@/lib/dominio/crediti';
import { useIncassa } from '@/lib/hooks/use-cliente';
import { Tastierino } from '@/components/comune/tastierino';
import {
  SceltaScontrino,
  ricordaScontrino,
  useScontrino,
} from '@/components/comune/scelta-scontrino';
import type { SaldoCliente } from '@/lib/supabase/tipi';

/**
 * Incassare un debito vecchio dalla scheda cliente.
 *
 * Stessa disposizione del pannello di chiusura conto: scontrino e importo in
 * alto e fermi, tastierino e CONFERMA in basso e fermi, il resto in mezzo.
 * Due pannelli che fanno la stessa cosa devono avere i comandi nello stesso
 * posto, altrimenti la memoria del pollice si confonde proprio quando serve.
 */

const METODI = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'carta', etichetta: 'Carta' },
  { valore: 'altro', etichetta: 'Altro' },
];

interface Props {
  cliente: SaldoCliente;
  onChiudi: () => void;
  onIncassato: (residuoCent: number, restoCent: number) => void;
}

export function PannelloIncasso({ cliente, onChiudi, onIncassato }: Props) {
  // Precompilato con il dovuto: il caso più frequente è "salda tutto".
  const [importoCent, setImporto] = useState(() => Math.max(cliente.saldo_cent, 0));
  /** Il primo tocco sul tastierino azzera il precompilato: vedi pannello-pagamento. */
  const [modificato, setModificato] = useState(false);
  const [metodo, setMetodo] = useState('contanti');
  const [scontrino, setScontrino] = useScontrino();
  const [errore, setErrore] = useState<string | null>(null);

  const incassa = useIncassa();
  const scorciatoie = scorciatoieIncasso(cliente.saldo_cent, null);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const esito = verificaIncasso(cliente.saldo_cent, importoCent);

  function digita(cifre: string) {
    setErrore(null);
    setImporto((attuale) => digitaCifre(modificato ? attuale : 0, cifre));
    setModificato(true);
  }

  function cancella() {
    setErrore(null);
    setImporto((attuale) => (modificato ? cancellaCifra(attuale) : 0));
    setModificato(true);
  }

  async function conferma() {
    setErrore(null);

    if (!esito.valido) {
      setErrore(esito.errore);
      return;
    }

    ricordaScontrino(scontrino);
    await incassa.mutateAsync({
      clienteId: cliente.id,
      importoCent: esito.importoCent,
      metodo,
      scontrinoBattuto: scontrino,
    });

    onIncassato(esito.residuoCent, esito.restoCent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative flex max-h-[96dvh] w-full flex-col rounded-t-3xl bg-[var(--color-superficie)] pb-sicura">
        {/* ---------------------------------------- fascia alta, ferma */}
        <div className="shrink-0 px-4 pt-3">
          <div className="flex justify-center pb-3">
            <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
          </div>

          <SceltaScontrino valore={scontrino} onCambia={setScontrino} />

          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="pb-1 text-sm text-[var(--color-testo-tenue)]">Quanto ti ha dato</span>
            {!modificato && (
              <span className="pb-1 text-xs text-[var(--color-testo-tenue)]">
                tocca una cifra per cambiarlo
              </span>
            )}
          </div>
          <output
            aria-live="polite"
            aria-label="Importo ricevuto"
            className="mt-1 flex h-16 items-center justify-end rounded-xl border border-[var(--color-accento)] bg-[var(--color-sfondo)] px-4 text-3xl font-bold tabular-nums"
          >
            {centesimiInCampo(importoCent)}
          </output>
        </div>

        {/* ------------------------------- fascia centrale, l'unica che scorre */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <div className="mt-3 flex items-baseline justify-between rounded-xl bg-[var(--color-sfondo)] px-4 py-2.5">
            <span className="text-sm text-[var(--color-testo-tenue)]">
              {cliente.nome} deve
            </span>
            <span className="text-xl font-bold tabular-nums text-[var(--color-debito)]">
              {formatEuro(cliente.saldo_cent)}
            </span>
          </div>

          {scorciatoie.length > 0 && (
            <div className="mt-2 flex gap-2">
              {scorciatoie.map((s) => (
                <button
                  key={s.etichetta}
                  type="button"
                  onClick={() => {
                    setErrore(null);
                    setImporto(s.importoCent);
                    setModificato(true);
                  }}
                  className="h-11 flex-1 rounded-lg border border-[var(--color-bordo)] px-2 text-sm"
                >
                  {s.etichetta} · {formatEuro(s.importoCent)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            {METODI.map((m) => (
              <button
                key={m.valore}
                type="button"
                onClick={() => setMetodo(m.valore)}
                className={`h-12 flex-1 rounded-xl text-sm font-medium ${
                  metodo === m.valore
                    ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                    : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
                }`}
              >
                {m.etichetta}
              </button>
            ))}
          </div>

          {/* Il conto della serva, prima di confermare */}
          {esito.valido && (esito.restoCent > 0 || esito.residuoCent > 0) && (
            <div className="mt-2 rounded-xl bg-[var(--color-sfondo)] px-4 py-2 text-sm">
              {esito.restoCent > 0 && (
                <p className="flex justify-between">
                  <span className="text-[var(--color-testo-tenue)]">Resto da dare</span>
                  <span className="font-semibold tabular-nums">{formatEuro(esito.restoCent)}</span>
                </p>
              )}
              {esito.residuoCent > 0 && (
                <p className="flex justify-between">
                  <span className="text-[var(--color-testo-tenue)]">Resta a debito</span>
                  <span className="font-semibold tabular-nums text-[var(--color-debito)]">
                    {formatEuro(esito.residuoCent)}
                  </span>
                </p>
              )}
            </div>
          )}

          {errore && (
            <p
              role="alert"
              className="mt-2 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-2.5 text-sm text-[var(--color-debito)]"
            >
              {errore}
            </p>
          )}
        </div>

        {/* ----------------------------------- fascia bassa, ferma: il pollice */}
        <div className="shrink-0 px-4 pb-3 pt-2">
          <Tastierino onCifre={digita} onCancella={cancella} descrizione="importo ricevuto" />

          {/* Incassare non è reversibile: qui la conferma serve (04-UX §1) */}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onChiudi}
              className="h-14 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => void conferma()}
              disabled={incassa.isPending}
              className="h-14 flex-[2] rounded-xl bg-[var(--color-positivo)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
            >
              {incassa.isPending ? 'Registro…' : 'CONFERMA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
