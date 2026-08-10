'use client';

import Link from 'next/link';
import { IndicatoreSync } from './indicatore-sync';
import { BarraNavigazione } from './barra-navigazione';
import { PulsanteEsci } from './pulsante-esci';

/**
 * La quarta scheda (04-UX-MOBILE.md §2): listino, cassa, magazzino,
 * impostazioni.
 *
 * Oggi contiene solo gli Scontrini. Le voci non ancora fatte compaiono
 * spente, con scritto quando arrivano: è meglio di un elenco che si allunga
 * a sorpresa, e di una scheda che sembra vuota senza spiegare perché.
 */

const VOCI = [
  {
    href: '/scontrini',
    icona: '🧾',
    titolo: 'Scontrini',
    descrizione: 'Che cosa è stato battuto e che cosa no',
  },
  {
    href: '/listino',
    icona: '📋',
    titolo: 'Listino',
    descrizione: 'Prezzi, varianti, preferiti',
  },
  {
    href: '/turno',
    icona: '💶',
    titolo: 'Chiudi turno',
    descrizione: 'Conta il cassetto, ritira, lascia il fondo',
  },
] as const;

const IN_ARRIVO = [
  { icona: '📦', titolo: 'Magazzino', quando: 'giacenze e carichi — Fase 3' },
] as const;

export function MenuAltro() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-5 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Altro</h1>
            <IndicatoreSync />
          </div>
          <PulsanteEsci />
        </header>

        <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
          {VOCI.map((v) => (
            <li key={v.href}>
              <Link
                href={v.href}
                className="flex min-h-20 items-center gap-4 px-5 py-3 active:bg-[var(--color-superficie)]"
              >
                <span aria-hidden className="text-2xl">
                  {v.icona}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{v.titolo}</span>
                  <span className="block text-xs text-[var(--color-testo-tenue)]">
                    {v.descrizione}
                  </span>
                </span>
                <span aria-hidden className="text-[var(--color-testo-tenue)]">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="px-5 pb-2 pt-6 text-xs font-semibold uppercase text-[var(--color-testo-tenue)]">
          In arrivo
        </p>
        <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)] opacity-50">
          {IN_ARRIVO.map((v) => (
            <li key={v.titolo} className="flex min-h-16 items-center gap-4 px-5 py-3">
              <span aria-hidden className="text-2xl grayscale">
                {v.icona}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{v.titolo}</span>
                <span className="block text-xs text-[var(--color-testo-tenue)]">{v.quando}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="h-6" />
      </main>

      <BarraNavigazione />
    </div>
  );
}
