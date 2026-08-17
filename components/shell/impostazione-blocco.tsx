'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ATTESE, CIFRE_PIN, improntaPin } from '@/lib/dominio/blocco';
import { Tastierino } from '@/components/comune/tastierino';
import { IndicatoreSync } from './indicatore-sync';
import { BarraNavigazione } from './barra-navigazione';
import { Pallini, salvaBlocco, useBlocco } from './blocco-schermo';

/**
 * Dove si sceglie il codice (T-44).
 *
 * L'impostazione sta **sul dispositivo**, non sul profilo: il telefono del
 * banco e quello in tasca al titolare non hanno lo stesso bisogno, e un
 * codice deciso una volta per tutti gli apparecchi sarebbe sbagliato su uno
 * dei due.
 */
export function ImpostazioneBlocco() {
  const blocco = useBlocco();
  const [nuovo, setNuovo] = useState('');
  const [conferma, setConferma] = useState('');
  const [inConferma, setInConferma] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  /**
   * Tutto succede qui, quando il tasto viene premuto: la scrittura, il
   * passaggio alla conferma e il salvataggio. Sparso fra due effetti che si
   * guardano le cifre a vicenda sarebbe la stessa cosa, ma illeggibile.
   */
  function digita(cifreNuove: string) {
    setMessaggio(null);
    setErrore(null);

    if (!inConferma) {
      const scritto = (nuovo + cifreNuove).slice(0, CIFRE_PIN);
      setNuovo(scritto);
      if (scritto.length === CIFRE_PIN) setInConferma(true);
      return;
    }

    const scritto = (conferma + cifreNuove).slice(0, CIFRE_PIN);
    if (scritto.length < CIFRE_PIN) {
      setConferma(scritto);
      return;
    }

    if (scritto !== nuovo) {
      setErrore('I due codici non coincidono. Riprova.');
      ricomincia();
      return;
    }

    salvaBlocco({ impronta: improntaPin(nuovo), dopoMinuti: blocco?.dopoMinuti ?? 2 });
    ricomincia();
    setMessaggio('Codice impostato.');
  }

  function ricomincia() {
    setNuovo('');
    setConferma('');
    setInConferma(false);
  }

  function cancella() {
    setMessaggio(null);
    setErrore(null);
    if (inConferma) setConferma((a) => a.slice(0, -1));
    else setNuovo((a) => a.slice(0, -1));
  }

  function cambiaAttesa(minuti: number) {
    if (!blocco) return;
    salvaBlocco({ ...blocco, dopoMinuti: minuti });
  }

  function togli() {
    salvaBlocco(null);
    ricomincia();
    setMessaggio('Codice tolto: lo schermo non si copre più.');
  }

  const scritte = inConferma ? conferma.length : nuovo.length;

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-2 px-5 pb-3 pt-6">
          <Link
            href="/altro"
            aria-label="Torna indietro"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold">Blocco schermo</h1>
          <IndicatoreSync />
        </header>

        <p className="px-5 pb-4 text-sm text-[var(--color-testo-tenue)]">
          Il telefono sta sul banco girato verso la sala, e chi passa vede i crediti di tutti.
          Quattro cifre coprono lo schermo quando lo posi.
          <span className="mt-2 block">
            Non è una seconda password: la sessione resta aperta sotto, e serve a tenere fuori gli
            occhi, non le persone. Ma si toglie in quattro tocchi — e un blocco che costasse rifare
            mail e password con la fila davanti non lo userebbe nessuno.
          </span>
        </p>

        {messaggio && (
          <p
            role="status"
            className="mx-5 mb-4 rounded-xl border border-[var(--color-positivo)]/30 bg-[var(--color-positivo)]/10 px-4 py-3 text-sm text-[var(--color-positivo)]"
          >
            {messaggio}
          </p>
        )}

        {errore && (
          <p
            role="alert"
            className="mx-5 mb-4 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        {blocco && (
          <section className="px-5 pb-6">
            <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
              Si copre dopo
            </h2>
            <div className="flex flex-wrap gap-2">
              {ATTESE.map((a) => (
                <button
                  key={a.minuti}
                  type="button"
                  onClick={() => cambiaAttesa(a.minuti)}
                  aria-pressed={blocco.dopoMinuti === a.minuti}
                  className={`h-12 flex-1 rounded-xl px-3 text-sm ${
                    blocco.dopoMinuti === a.minuti
                      ? 'bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)]'
                      : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
                  }`}
                >
                  {a.etichetta}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--color-testo-tenue)]">
              Il conto parte da quando l&apos;app finisce in secondo piano.
            </p>

            <button
              type="button"
              onClick={togli}
              className="mt-5 h-14 w-full rounded-xl border-2 border-[var(--color-debito)] text-sm font-semibold text-[var(--color-debito)]"
            >
              Togli il codice
            </button>
          </section>
        )}

        <section className="px-5 pb-8">
          <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
            {blocco ? 'Cambia codice' : 'Scegli un codice'}
          </h2>
          <p className="pb-4 text-sm">
            {inConferma ? 'Riscrivilo per conferma.' : 'Quattro cifre.'}
          </p>

          <div className="flex justify-center pb-4">
            <Pallini quante={scritte} />
          </div>

          <Tastierino
            descrizione={inConferma ? 'conferma del codice' : 'codice nuovo'}
            onCifre={digita}
            onCancella={cancella}
          />
        </section>
      </main>

      <BarraNavigazione />
    </div>
  );
}
