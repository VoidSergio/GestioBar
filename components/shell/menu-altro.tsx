'use client';

import Link from 'next/link';
import { IndicatoreSync } from './indicatore-sync';
import { BarraNavigazione } from './barra-navigazione';
import { PulsanteEsci } from './pulsante-esci';
import type { Ruolo } from '@/lib/dominio/clienti';

/**
 * La quarta scheda (04-UX-MOBILE.md §2): listino, cassa, magazzino,
 * impostazioni.
 *
 * Le voci non ancora fatte compaiono spente, con scritto quando arrivano: è
 * meglio di un elenco che si allunga a sorpresa, e di una scheda che sembra
 * vuota senza spiegare perché.
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
  {
    href: '/magazzino',
    icona: '📦',
    titolo: 'Magazzino',
    descrizione: 'Giacenze, carichi, che cosa manca',
  },
  {
    href: '/blocco',
    icona: '🔒',
    titolo: 'Blocco schermo',
    descrizione: 'Quattro cifre per coprire i crediti quando posi il telefono',
  },
] as const;

/** Quello che vede solo il titolare. Chi vieta davvero sono le policy (0019). */
const SOLO_TITOLARE = [
  {
    href: '/report',
    icona: '📈',
    titolo: 'Report',
    descrizione: 'Quanto è entrato, cosa esce, chi consuma, a che ora',
  },
  {
    href: '/persone',
    icona: '👤',
    titolo: 'Persone',
    descrizione: 'Chi lavora, chi è titolare, chi non c’è più',
  },
] as const;

export function MenuAltro({ ruolo }: { ruolo: Ruolo | null }) {
  const voci = ruolo === 'titolare' ? [...VOCI, ...SOLO_TITOLARE] : VOCI;

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
          {voci.map((v) => (
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

        <div className="h-6" />
      </main>

      <BarraNavigazione />
    </div>
  );
}
