'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GrigliaProdotti } from '@/components/conto/griglia-prodotti';
import { formatEuro, sommaCentesimi } from '@/lib/dominio/denaro';
import { nuovoId } from '@/lib/utils';

interface RigaFinta {
  id: string;
  prodottoId: string;
  nome: string;
  prezzoCent: number;
  quantita: number;
}

export function ProvaGriglia() {
  const [righe, setRighe] = useState<RigaFinta[]>([]);
  const [ultimoTap, setUltimoTap] = useState<number | null>(null);

  function aggiungi(scelta: { prodottoId: string; nome: string; prezzoCent: number }) {
    const inizio = performance.now();

    setRighe((precedenti) => {
      // Stesso prodotto E stessa variante: si incrementa invece di duplicare.
      // Un caffè normale e uno decaffeinato restano righe separate.
      const esistente = precedenti.findIndex((r) => r.prodottoId === scelta.prodottoId);
      if (esistente >= 0) {
        const copia = [...precedenti];
        const riga = copia[esistente]!;
        copia[esistente] = { ...riga, quantita: riga.quantita + 1 };
        return copia;
      }
      return [
        {
          id: nuovoId(),
          prodottoId: scelta.prodottoId,
          nome: scelta.nome,
          prezzoCent: scelta.prezzoCent,
          quantita: 1,
        },
        ...precedenti,
      ];
    });

    if (navigator.vibrate) navigator.vibrate(8);
    setUltimoTap(Math.round(performance.now() - inizio));
  }

  const totale = sommaCentesimi(righe.map((r) => r.prezzoCent * r.quantita));

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">Prova griglia</h1>
          <p className="text-xs text-[var(--color-testo-tenue)]">
            Conto finto, niente viene salvato
            {ultimoTap !== null && ` · ultimo tap ${ultimoTap} ms`}
          </p>
        </div>
        <Link
          href="/"
          className="flex h-11 items-center rounded-lg border border-[var(--color-bordo)] px-4 text-sm text-[var(--color-testo-tenue)]"
        >
          Chiudi
        </Link>
      </header>

      {/* Righe: occupano il terzo alto, la griglia sta sotto il pollice */}
      <section className="max-h-[30dvh] min-h-[88px] overflow-y-auto border-y border-[var(--color-bordo)]">
        {righe.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-testo-tenue)]">
            Tocca un prodotto per aggiungerlo.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-bordo)]">
            {righe.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm">{r.nome}</span>
                <span className="text-sm text-[var(--color-testo-tenue)] tabular-nums">
                  {formatEuro(r.prezzoCent)}
                </span>
                <span className="w-8 text-right text-sm tabular-nums">×{r.quantita}</span>
                <span className="w-20 text-right font-semibold tabular-nums">
                  {formatEuro(r.prezzoCent * r.quantita)}
                </span>
                <button
                  type="button"
                  aria-label={`Togli ${r.nome}`}
                  onClick={() => setRighe((p) => p.filter((x) => x.id !== r.id))}
                  className="h-11 w-11 shrink-0 text-[var(--color-testo-tenue)] active:text-[var(--color-debito)]"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="min-h-0 flex-1">
        <GrigliaProdotti onAggiungi={aggiungi} />
      </div>

      <footer className="border-t border-[var(--color-bordo)] px-4 py-3 pb-sicura">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-testo-tenue)]">Totale prova</span>
          <span className="text-2xl font-bold tabular-nums">{formatEuro(totale)}</span>
        </div>
        {righe.length > 0 && (
          <button
            type="button"
            onClick={() => setRighe([])}
            className="mt-2 h-11 w-full rounded-lg border border-[var(--color-bordo)] text-sm text-[var(--color-testo-tenue)]"
          >
            Svuota
          </button>
        )}
      </footer>
    </main>
  );
}
