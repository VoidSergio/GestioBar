'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * La tab bar fissa in basso (04-UX-MOBILE.md §2).
 *
 * Niente menu a panino: un menu nascosto costa un tap in più a ogni
 * spostamento, e in un bar quel tap non c'è.
 *
 * Manca la quarta voce, "Altro" (listino, cassa, magazzino, impostazioni):
 * arriva con T-16, che è il primo contenuto che ci finirebbe dentro. Una
 * scheda che si apre su una schermata vuota è peggio di una scheda assente.
 *
 * Sta solo sulle tre schermate principali. Il dettaglio di un conto e la
 * scheda cliente sono schermate di lavoro: hanno le loro azioni in basso e
 * la freccia indietro in alto, e la barra ruberebbe spazio e bersagli.
 */

const VOCI = [
  { href: '/', icona: '🏠', etichetta: 'Conti' },
  { href: '/clienti', icona: '👥', etichetta: 'Clienti' },
  { href: '/crediti', icona: '💰', etichetta: 'Crediti' },
] as const;

export function BarraNavigazione() {
  const percorso = usePathname();

  return (
    <nav
      aria-label="Sezioni"
      className="sticky bottom-0 z-30 border-t border-[var(--color-bordo)] bg-[var(--color-sfondo)] pb-sicura"
    >
      <ul className="flex">
        {VOCI.map((v) => {
          const attiva = percorso === v.href;
          return (
            <li key={v.href} className="flex-1">
              <Link
                href={v.href}
                aria-current={attiva ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 ${
                  attiva ? 'text-[var(--color-accento)]' : 'text-[var(--color-testo-tenue)]'
                }`}
              >
                <span aria-hidden className="text-xl leading-none">
                  {v.icona}
                </span>
                <span className="text-xs font-medium">{v.etichetta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
