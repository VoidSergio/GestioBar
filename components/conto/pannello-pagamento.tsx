'use client';

import { useEffect, useState } from 'react';
import { cancellaCifra, centesimiInCampo, digitaCifre, formatEuro } from '@/lib/dominio/denaro';
import { scorciatoieChiusura, verificaChiusuraConto } from '@/lib/dominio/crediti';
import { Tastierino } from '@/components/comune/tastierino';
import {
  SceltaScontrino,
  ricordaScontrino,
  useScontrino,
} from '@/components/comune/scelta-scontrino';

/**
 * Il pannello di chiusura conto (04-UX-MOBILE.md §6).
 *
 * Mostra separati il conto di adesso e il debito che il cliente si trascina,
 * perché sono due cose che il barista deve poter leggere distinte prima di
 * decidere quanto chiedere. Le regole di calcolo stanno tutte in
 * `verificaChiusuraConto`: qui c'è solo l'interfaccia.
 *
 * COME È FATTO, E PERCHÉ COSÌ.
 *
 * Tre fasce. In alto, ferma: la scelta dello scontrino e l'importo — le due
 * cose che devi vedere mentre digiti. In basso, fermo: il tastierino e
 * CONFERMA, cioè tutto quello che il pollice deve raggiungere. In mezzo, e
 * solo in mezzo, la parte che eventualmente scorre: il dettaglio del dovuto,
 * le scorciatoie, il metodo.
 *
 * Su un telefono normale non scorre niente. Su uno schermo piccolo scorrono
 * di qualche decina di pixel le informazioni, mai i comandi. Il vincolo che
 * ha guidato il disegno è uno solo: **non si scorre per confermare**.
 */

const METODI = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'carta', etichetta: 'Carta' },
  { valore: 'altro', etichetta: 'Altro' },
];

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

  // Precompilato con il dovuto: il caso più frequente è "paga tutto".
  const [importoCent, setImporto] = useState(() => Math.max(dovutoCent, 0));
  /**
   * Il primo tocco sul tastierino cancella il precompilato.
   *
   * Chi tocca una cifra sta dicendo "non è questa la somma": ricominciare da
   * zero è l'unica lettura sensata. Se invece le cifre si aggiungessero in
   * coda a 32,90, un tap distratto trasformerebbe trentadue euro in
   * trecentoventinove.
   */
  const [modificato, setModificato] = useState(false);
  const [metodo, setMetodo] = useState('contanti');
  const [scontrino, setScontrino] = useScontrino();
  const [errore, setErrore] = useState<string | null>(null);

  const scorciatoie = scorciatoieChiusura(totaleContoCent, debitoPrecedenteCent);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const esito = verificaChiusuraConto({
    totaleContoCent,
    debitoPrecedenteCent,
    importoDatoCent: importoCent,
    haCliente,
  });

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

  function scegliScorciatoia(importo: number) {
    setErrore(null);
    setImporto(importo);
    setModificato(true);
  }

  function conferma() {
    setErrore(null);

    if (!esito.valido) {
      setErrore(esito.errore);
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
          {/* Conto di adesso e debito vecchio restano separati: sono due cose */}
          <div className="mt-3 rounded-xl bg-[var(--color-sfondo)] px-4 py-2.5 text-sm">
            <p className="flex justify-between">
              <span className="text-[var(--color-testo-tenue)]">
                Conto di {nomeCliente}
              </span>
              <span className="tabular-nums">{formatEuro(totaleContoCent)}</span>
            </p>
            {debitoPrecedenteCent !== 0 && (
              <>
                <p className="mt-1 flex justify-between">
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
                <p className="mt-1.5 flex items-baseline justify-between border-t border-[var(--color-bordo)] pt-1.5">
                  <span className="font-medium">Totale dovuto</span>
                  <span className="text-xl font-bold tabular-nums">{formatEuro(dovutoCent)}</span>
                </p>
              </>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            {scorciatoie.map((s) => (
              <button
                key={s.etichetta}
                type="button"
                onClick={() => scegliScorciatoia(s.importoCent)}
                className="h-11 flex-1 rounded-lg border border-[var(--color-bordo)] px-2 text-sm"
              >
                {s.etichetta} · {formatEuro(s.importoCent)}
              </button>
            ))}
          </div>

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
          {esito.valido && (esito.restoCent > 0 || esito.nuovoSaldoCent > 0) && (
            <div className="mt-2 rounded-xl bg-[var(--color-sfondo)] px-4 py-2 text-sm">
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
              onClick={conferma}
              disabled={inCorso}
              className="h-14 flex-[2] rounded-xl bg-[var(--color-positivo)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
            >
              {inCorso ? 'Registro…' : 'CONFERMA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
