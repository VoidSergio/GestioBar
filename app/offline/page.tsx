import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Senza rete — Gestionale Bar' };

/**
 * Il ripiego del service worker, quando non c'è né rete né una copia della
 * schermata che si stava aprendo.
 *
 * Non chiama `richiediAccesso()`: è l'unica pagina che deve poter comparire
 * anche senza server, ed è il motivo per cui non mostra niente di riservato.
 */
export default function PaginaOffline() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-5xl" aria-hidden>
        📶
      </p>
      <h1 className="text-xl font-bold">Questa schermata non era in memoria</h1>
      <p className="max-w-sm text-sm leading-relaxed text-[var(--color-testo-tenue)]">
        Senza rete l&apos;app apre solo le schermate già viste. I conti che stai battendo sono al
        sicuro sul telefono: partiranno da soli appena torna la linea.
      </p>
      {/*
        `<a>` e non `<Link>`, di proposito. Questa pagina compare quando il
        router di Next non è mai partito: una navigazione lato client non
        avrebbe nulla su cui girare, mentre un caricamento vero fa ritentare
        il service worker e, se la rete è tornata, l'app riparte davvero.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="mt-4 flex h-14 items-center rounded-xl bg-[var(--color-accento)] px-8 font-semibold text-[var(--color-sfondo)]"
      >
        Torna al banco
      </a>
    </main>
  );
}
