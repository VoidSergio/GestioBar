'use client';

import { useMemo, useRef, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { categorieDi, nomeCompleto, variantePredefinita } from '@/lib/dominio/listino';
import { useProdotti } from '@/lib/hooks/use-prodotti';
import type { RiquadroGriglia, VarianteProdotto } from '@/lib/supabase/tipi';
import { PannelloVarianti } from './pannello-varianti';

const TUTTI = 'Tutti';

/** Etichette corte per la barra delle categorie: deve starci in una riga. */
const ABBREVIAZIONI: Record<string, string> = {
  Caffetteria: 'Caffè',
  Acque: 'Acque',
  Bibite: 'Bibite',
  Food: 'Food',
  Birre: 'Birre',
  Aperitivi: 'Aperit.',
  Vini: 'Vini',
  Superalcolici: 'Alcolici',
};

interface Props {
  /** Chiamata a ogni scelta: `nome` è già completo di variante. */
  onAggiungi: (scelta: {
    prodottoId: string;
    nome: string;
    prezzoCent: number;
  }) => void;
}

export function GrigliaProdotti({ onAggiungi }: Props) {
  const { data: riquadri, isPending, error } = useProdotti();
  const [categoria, setCategoria] = useState(TUTTI);
  const [aperto, setAperto] = useState<RiquadroGriglia | null>(null);

  const categorie = useMemo(() => categorieDi(riquadri ?? []), [riquadri]);

  const visibili = useMemo(() => {
    if (!riquadri) return [];
    if (categoria === TUTTI) return riquadri;
    return riquadri.filter((r) => r.categoria === categoria);
  }, [riquadri, categoria]);

  function scegli(riquadro: RiquadroGriglia, variante: VarianteProdotto) {
    onAggiungi({
      prodottoId: variante.id,
      nome: nomeCompleto(riquadro.nome_base, variante.variante),
      prezzoCent: variante.prezzo_cent,
    });
    setAperto(null);
  }

  if (error) {
    return (
      <p className="p-5 text-sm text-[var(--color-debito)]">
        Non riesco a leggere il listino. Controlla la connessione e riprova.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-2 p-2" aria-busy="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl bg-[var(--color-superficie)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      {/* Filtro categorie: scorrevole, perché otto voci non stanno in larghezza */}
      <div className="flex gap-1.5 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[TUTTI, ...categorie].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={`h-11 shrink-0 rounded-lg px-4 text-sm font-medium ${
              categoria === c
                ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                : 'bg-[var(--color-superficie)] text-[var(--color-testo-tenue)]'
            }`}
          >
            {ABBREVIAZIONI[c] ?? c}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2">
        {visibili.map((r) => (
          <Riquadro
            key={r.nome_base}
            riquadro={r}
            onTapBreve={() => scegli(r, variantePredefinita(r))}
            onApriVarianti={() => setAperto(r)}
          />
        ))}
      </div>

      {aperto && (
        <PannelloVarianti
          riquadro={aperto}
          onScegli={(v) => scegli(aperto, v)}
          onChiudi={() => setAperto(null)}
        />
      )}
    </div>
  );
}

function Riquadro({
  riquadro,
  onTapBreve,
  onApriVarianti,
}: {
  riquadro: RiquadroGriglia;
  onTapBreve: () => void;
  onApriVarianti: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eStataLunga = useRef(false);

  // Pressione prolungata: alternativa al ▾ per chi ha il pollice grosso.
  function iniziaPressione() {
    if (!riquadro.ha_varianti) return;
    eStataLunga.current = false;
    timer.current = setTimeout(() => {
      eStataLunga.current = true;
      onApriVarianti();
    }, 450);
  }

  function finePressione() {
    if (timer.current) clearTimeout(timer.current);
  }

  const predefinita = variantePredefinita(riquadro);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (eStataLunga.current) {
            eStataLunga.current = false;
            return;
          }
          onTapBreve();
        }}
        onPointerDown={iniziaPressione}
        onPointerUp={finePressione}
        onPointerLeave={finePressione}
        onContextMenu={(e) => e.preventDefault()}
        style={{ minHeight: 72 }}
        className="flex h-full w-full select-none flex-col justify-between rounded-xl bg-[var(--color-superficie)] p-2.5 text-left active:bg-[var(--color-superficie-alta)]"
      >
        <span className="text-sm leading-tight font-medium">{riquadro.nome_base}</span>
        <span className="text-base font-bold tabular-nums">
          {formatEuro(predefinita.prezzo_cent)}
        </span>
      </button>

      {riquadro.ha_varianti && (
        <button
          type="button"
          aria-label={`Varianti di ${riquadro.nome_base}`}
          onClick={onApriVarianti}
          className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end rounded-xl p-2 text-[var(--color-accento)] active:bg-[var(--color-superficie-alta)]"
        >
          <span aria-hidden className="text-xs leading-none">
            ▾
          </span>
        </button>
      )}
    </div>
  );
}
