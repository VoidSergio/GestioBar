'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  attesaDopoErrori,
  CIFRE_PIN,
  deveBloccare,
  improntaPin,
  type Blocco,
} from '@/lib/dominio/blocco';
import { Tastierino } from '@/components/comune/tastierino';

/**
 * Copre lo schermo quando il telefono resta fermo (T-44).
 *
 * Sta attorno a tutta l'app, in `app/layout.tsx`. Se nessun codice è stato
 * impostato non fa assolutamente niente — nemmeno un ascoltatore.
 *
 * Le regole (quando bloccare, quanto aspettare dopo un errore) stanno in
 * `lib/dominio/blocco.ts`, con i test. Qui c'è solo il velo.
 */

const CHIAVE = 'bar:blocco';
const CAMBIATO = 'bar:blocco-cambiato';

/* --------------------------------------------- lettura e scrittura */

function leggiGrezzo(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

/**
 * `localStorage` è uno stato che vive fuori da React, e questo è il modo che
 * React indica per leggerlo: si sottoscrive, e la lettura è una stringa —
 * quindi confrontabile. Restituire un oggetto nuovo a ogni giro rifarebbe il
 * render all'infinito.
 */
function sottoscrivi(riconsidera: () => void): () => void {
  window.addEventListener(CAMBIATO, riconsidera);
  window.addEventListener('storage', riconsidera);
  return () => {
    window.removeEventListener(CAMBIATO, riconsidera);
    window.removeEventListener('storage', riconsidera);
  };
}

function analizza(grezzo: string | null): Blocco | null {
  if (!grezzo) return null;
  try {
    const letto = JSON.parse(grezzo) as Partial<Blocco>;
    if (typeof letto.impronta !== 'string') return null;
    return { impronta: letto.impronta, dopoMinuti: Number(letto.dopoMinuti ?? 0) };
  } catch {
    return null;
  }
}

/** Legge la configurazione del blocco, e la rilegge quando cambia. */
export function useBlocco(): Blocco | null {
  const grezzo = useSyncExternalStore(
    sottoscrivi,
    leggiGrezzo,
    // Sul server non c'è nessun localStorage: si parte da "nessun codice" e
    // il valore vero arriva un istante dopo, in idratazione.
    () => null,
  );

  return useMemo(() => analizza(grezzo), [grezzo]);
}

export function salvaBlocco(blocco: Blocco | null): void {
  try {
    if (blocco) window.localStorage.setItem(CHIAVE, JSON.stringify(blocco));
    else window.localStorage.removeItem(CHIAVE);
    // `storage` non scatta nella scheda che ha scritto: le altre schede
    // aperte devono accorgersene lo stesso.
    window.dispatchEvent(new Event(CAMBIATO));
  } catch {
    // Modalità privata o spazio esaurito: si perde l'impostazione, nient'altro.
  }
}

/* ------------------------------------------------------------ il velo */

export function BloccoSchermo({ children }: { children: React.ReactNode }) {
  const blocco = useBlocco();
  const [coperto, setCoperto] = useState(false);
  // Zero finché l'effetto non parte: leggere l'orologio durante il render
  // renderebbe il componente diverso da sé stesso a ogni giro.
  const ultimoUso = useRef(0);

  /**
   * Si controlla al ritorno in primo piano, non con un timer che gira.
   *
   * Un intervallo che si sveglia ogni secondo per tutta la giornata consuma
   * batteria per una cosa che può succedere solo quando qualcuno riprende in
   * mano il telefono. Quel momento è esattamente `visibilitychange`.
   */
  useEffect(() => {
    if (!blocco) return;

    const segnaUso = () => {
      ultimoUso.current = Date.now();
    };

    // L'app è appena stata aperta: questo conta come uso.
    segnaUso();

    const alCambioVisibilita = () => {
      if (document.visibilityState !== 'visible') {
        segnaUso();
        return;
      }
      if (deveBloccare(ultimoUso.current, blocco.dopoMinuti)) setCoperto(true);
    };

    document.addEventListener('visibilitychange', alCambioVisibilita);
    window.addEventListener('pointerdown', segnaUso, { passive: true });
    window.addEventListener('keydown', segnaUso);

    return () => {
      document.removeEventListener('visibilitychange', alCambioVisibilita);
      window.removeEventListener('pointerdown', segnaUso);
      window.removeEventListener('keydown', segnaUso);
    };
  }, [blocco]);

  const sblocca = useCallback(() => {
    ultimoUso.current = Date.now();
    setCoperto(false);
  }, []);

  return (
    <>
      {children}
      {blocco && coperto && <Velo impronta={blocco.impronta} onSbloccato={sblocca} />}
    </>
  );
}

/**
 * Copre tutto, non "protegge": la sessione sotto resta intatta, e questo è il
 * punto. L'alternativa vera sarebbe rifare mail e password con la fila
 * davanti, e non lo farebbe nessuno.
 */
function Velo({ impronta, onSbloccato }: { impronta: string; onSbloccato: () => void }) {
  const [cifre, setCifre] = useState('');
  const [tentativi, setTentativi] = useState(0);
  const [sbagliato, setSbagliato] = useState(false);
  /**
   * L'attesa è uno stato che si spegne da solo, non un orario da confrontare
   * a ogni render: così il tastierino si riaccende quando scade davvero,
   * invece di aspettare che qualcosa costringa la schermata a ridisegnarsi.
   */
  const [inAttesa, setInAttesa] = useState(false);

  useEffect(() => {
    if (!inAttesa) return;
    const t = setTimeout(() => setInAttesa(false), attesaDopoErrori(tentativi));
    return () => clearTimeout(t);
  }, [inAttesa, tentativi]);

  /** Il controllo si fa qui, dove il tasto viene premuto, non in un effetto. */
  function digita(nuove: string) {
    if (inAttesa) return;
    setSbagliato(false);

    const prossimo = (cifre + nuove).slice(0, CIFRE_PIN);
    if (prossimo.length < CIFRE_PIN) {
      setCifre(prossimo);
      return;
    }

    if (improntaPin(prossimo) === impronta) {
      onSbloccato();
      return;
    }

    const quanti = tentativi + 1;
    setCifre('');
    setSbagliato(true);
    setTentativi(quanti);
    if (attesaDopoErrori(quanti) > 0) setInAttesa(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schermo bloccato"
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-[var(--color-sfondo)] pb-sicura"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-5xl" aria-hidden>
          🔒
        </p>
        <p className="text-lg font-medium">Scrivi il codice</p>

        <Pallini quante={cifre.length} />

        {sbagliato && (
          <p role="alert" className="text-sm text-[var(--color-debito)]">
            {inAttesa ? 'Aspetta qualche secondo e riprova.' : 'Codice sbagliato.'}
          </p>
        )}
      </div>

      <div className={`px-6 pb-6 ${inAttesa ? 'pointer-events-none opacity-40' : ''}`}>
        <Tastierino
          descrizione="codice di sblocco"
          onCifre={digita}
          onCancella={() => {
            setSbagliato(false);
            setCifre((attuale) => attuale.slice(0, -1));
          }}
        />
      </div>
    </div>
  );
}

/** I pallini che dicono quante cifre sono state scritte, senza mostrarle. */
export function Pallini({ quante }: { quante: number }) {
  return (
    <div className="flex gap-3" aria-hidden>
      {Array.from({ length: CIFRE_PIN }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full ${
            i < quante ? 'bg-[var(--color-accento)]' : 'border border-[var(--color-bordo)]'
          }`}
        />
      ))}
    </div>
  );
}
