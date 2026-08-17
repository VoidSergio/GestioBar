'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { useClienti } from '@/lib/hooks/use-clienti';

/**
 * La tab bar fissa in basso (04-UX-MOBILE.md §2).
 *
 * Niente menu a panino: un menu nascosto costa un tap in più a ogni
 * spostamento, e in un bar quel tap non c'è.
 *
 * Sta sulle schermate principali, banco compreso. Il dettaglio di un conto
 * aperto a nome di qualcuno e la scheda cliente sono schermate di lavoro:
 * hanno le loro azioni in basso e la freccia indietro in alto, e la barra
 * ruberebbe spazio e bersagli.
 *
 * IL NUMERO SU CREDITI. Il credito in giro era il numero grande della vecchia
 * home. Ora che la home è la griglia dei prodotti, quel numero non ha più una
 * schermata tutta sua da occupare — ma è la ragione per cui il progetto
 * esiste e non può sparire dietro un tocco. Sta qui: piccolo, sempre a
 * schermo, rosso quando c'è qualcosa da incassare. La mattina si legge
 * accendendo l'app, senza cercarlo.
 */

const VOCI = [
  { href: '/', icona: '🏠', etichetta: 'Banco' },
  { href: '/clienti', icona: '👥', etichetta: 'Clienti' },
  { href: '/crediti', icona: '💰', etichetta: 'Crediti' },
  { href: '/altro', icona: '⚙️', etichetta: 'Altro' },
] as const;

/** Quello che si raggiunge da "Altro" e che deve tenerne accesa la scheda. */
const SOTTO_ALTRO = ['/scontrini', '/listino', '/turno', '/report', '/persone', '/blocco'] as const;

export function BarraNavigazione() {
  const percorso = usePathname();
  const { data: clienti } = useClienti();

  const credito = useMemo(
    () => (clienti ?? []).reduce((somma, c) => somma + Math.max(c.saldo_cent, 0), 0),
    [clienti],
  );

  return (
    <nav
      aria-label="Sezioni"
      className="sticky bottom-0 z-30 border-t border-[var(--color-bordo)] bg-[var(--color-sfondo)] pb-sicura"
    >
      <ul className="flex">
        {VOCI.map((v) => {
          // Le schermate di secondo livello (scontrini, listino, turno,
          // report) stanno dentro Altro: la scheda deve restare accesa,
          // altrimenti sembra di essere usciti dalla sezione.
          const attiva =
            percorso === v.href ||
            (v.href === '/altro' && SOTTO_ALTRO.some((p) => percorso.startsWith(p)));
          const conCredito = v.href === '/crediti' && credito > 0;

          return (
            <li key={v.href} className="flex-1">
              <Link
                href={v.href}
                aria-current={attiva ? 'page' : undefined}
                aria-label={conCredito ? `Crediti: ${formatEuro(credito)} da incassare` : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 ${
                  attiva ? 'text-[var(--color-accento)]' : 'text-[var(--color-testo-tenue)]'
                }`}
              >
                <span aria-hidden className="text-xl leading-none">
                  {v.icona}
                </span>
                {conCredito ? (
                  <span
                    aria-hidden
                    className="text-xs font-bold tabular-nums text-[var(--color-debito)]"
                  >
                    {formatEuro(credito)}
                  </span>
                ) : (
                  <span className="text-xs font-medium">{v.etichetta}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
