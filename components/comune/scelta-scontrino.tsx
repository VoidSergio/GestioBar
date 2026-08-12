'use client';

import { useState } from 'react';

/**
 * Scontrino battuto: sì o no.
 *
 * PERCHÉ NON È PIÙ UNA SPUNTA.
 *
 * Era una casella in mezzo al pannello, sotto il campo dell'importo. Con la
 * tastiera aperta finiva fuori schermo, e una spunta che non si vede è una
 * spunta che nessuno controlla: si scopriva a fine turno che metà degli
 * incassi risultavano senza scontrino, o tutti con, a seconda di com'era
 * rimasta l'ultima volta.
 *
 * Adesso sono due tasti, sono la prima cosa in cima al pannello, e quello
 * scelto è pieno di colore: si legge da mezzo metro, con l'occhio di
 * striscio, mentre la mano fa altro.
 *
 * Resta la memoria dell'ultima scelta (04-UX-MOBILE.md §6): al banco è quasi
 * sempre la stessa, e chiederla da capo a ogni conto costerebbe un tocco
 * ogni volta. La differenza è che ora la scelta ricordata **si vede**,
 * invece di essere nascosta in fondo alla schermata.
 */

const CHIAVE = 'bar:scontrino-battuto';

/** L'ultima scelta fatta. Se non c'è, si parte da "sì": è il caso di legge. */
export function scontrinoRicordato(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const salvato = window.localStorage.getItem(CHIAVE);
    return salvato === null ? true : salvato === 'si';
  } catch {
    return true;
  }
}

export function ricordaScontrino(valore: boolean): void {
  try {
    window.localStorage.setItem(CHIAVE, valore ? 'si' : 'no');
  } catch {
    // Modalità privata o spazio esaurito: si perde la preferenza, nient'altro.
  }
}

/** Lo stato della scelta, già inizializzato con quella ricordata. */
export function useScontrino(): [boolean, (v: boolean) => void] {
  return useState(scontrinoRicordato);
}

export function SceltaScontrino({
  valore,
  onCambia,
}: {
  valore: boolean;
  onCambia: (v: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
        Scontrino battuto?
      </legend>
      <div className="flex gap-2">
        <Tasto acceso={valore} onClick={() => onCambia(true)} colore="var(--color-positivo)">
          SÌ
        </Tasto>
        <Tasto acceso={!valore} onClick={() => onCambia(false)} colore="var(--color-attenzione)">
          NO
        </Tasto>
      </div>
    </fieldset>
  );
}

/**
 * Il tasto scelto è pieno; l'altro è appena disegnato. Non ci si affida al
 * solo colore: quello acceso porta anche il segno di spunta, perché in
 * penombra e con lo schermo al minimo due tinte si confondono.
 */
function Tasto({
  acceso,
  onClick,
  colore,
  children,
}: {
  acceso: boolean;
  onClick: () => void;
  colore: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={acceso}
      onClick={onClick}
      style={acceso ? { backgroundColor: colore, color: 'var(--color-sfondo)' } : undefined}
      className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-bold tracking-wide ${
        acceso ? '' : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
      }`}
    >
      {acceso && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}
