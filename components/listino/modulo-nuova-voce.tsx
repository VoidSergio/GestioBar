'use client';

import { useEffect, useState } from 'react';
import { cifreInCentesimi, mascheraImporto } from '@/lib/dominio/denaro';
import { nomeCompleto, validaNuovaVoce } from '@/lib/dominio/listino';
import { useCreaVoceListino } from '@/lib/hooks/use-listino';
import type { Categoria } from '@/lib/supabase/tipi';

/**
 * Aggiungere un prodotto o una variante.
 *
 * È lo stesso modulo per tutti e due i casi, perché nel modello sono la
 * stessa cosa: un prodotto è una riga con `variante = 'normale'`, una
 * variante è una riga con lo stesso `nome_base` e una variante diversa
 * (02-MODELLO-DATI §3.4). Arrivando da "+ variante" il nome base è già
 * riempito e non si tocca — cambiarlo creerebbe un altro prodotto senza
 * dirlo.
 */

interface Props {
  /** presente quando si aggiunge una variante a un prodotto esistente */
  nomeBaseIniziale?: string;
  esistenti: readonly { nome_base: string; variante: string; categoria_id: string | null }[];
  categorie: readonly Categoria[];
  onChiudi: () => void;
  onCreata: (nome: string) => void;
}

export function ModuloNuovaVoce({
  nomeBaseIniziale,
  esistenti,
  categorie,
  onChiudi,
  onCreata,
}: Props) {
  const crea = useCreaVoceListino();

  const eVariante = nomeBaseIniziale !== undefined;
  const [nomeBase, setNomeBase] = useState(nomeBaseIniziale ?? '');
  const [variante, setVariante] = useState('');
  const [prezzo, setPrezzo] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(() => {
    if (!nomeBaseIniziale) return categorie[0]?.id ?? null;
    // Una variante sta nella stessa categoria del prodotto di cui è variante:
    // chiederlo di nuovo sarebbe un'occasione di sbagliare.
    return esistenti.find((p) => p.nome_base === nomeBaseIniziale)?.categoria_id ?? null;
  });
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  async function conferma() {
    setErrore(null);

    const controllo = validaNuovaVoce(
      // Le cifre valgono centesimi, come sul tastierino: "120" è 1,20 €.
      { nomeBase, variante, prezzoCent: prezzo === '' ? null : cifreInCentesimi(prezzo) },
      esistenti,
    );
    if (!controllo.valido) {
      setErrore(controllo.errore);
      return;
    }

    try {
      await crea.mutateAsync({
        nomeBase: controllo.dati.nomeBase,
        variante: controllo.dati.variante,
        prezzoCent: controllo.dati.prezzoCent,
        categoriaId,
        // In fondo alla sua categoria: chi la vuole più in alto la sposta,
        // ma il posto nuovo non deve scombinare quello che c'è.
        ordine: 999,
      });
      onCreata(nomeCompleto(controllo.dati.nomeBase, controllo.dati.variante));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a salvarlo.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-superficie)] px-5 pb-sicura pt-3">
        <div className="flex justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <h2 className="pb-3 pt-4 text-lg font-semibold">
          {eVariante ? `Nuova variante di ${nomeBaseIniziale}` : 'Nuovo prodotto'}
        </h2>

        {!eVariante && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--color-testo-tenue)]">Nome</span>
            <input
              value={nomeBase}
              onChange={(e) => setNomeBase(e.target.value)}
              placeholder="Spritz"
              autoCapitalize="words"
              autoCorrect="off"
              autoFocus
              className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
            />
          </label>
        )}

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">
            Variante {eVariante ? '' : '(facoltativa)'}
          </span>
          <input
            value={variante}
            onChange={(e) => setVariante(e.target.value)}
            placeholder={eVariante ? 'decaffeinato, 0,66, grande…' : 'lascia vuoto se non serve'}
            autoCorrect="off"
            autoFocus={eVariante}
            className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">Prezzo</span>
          <input
            value={prezzo}
            onChange={(e) => setPrezzo(mascheraImporto(e.target.value))}
            placeholder="1,20"
            inputMode="numeric"
            className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 text-lg font-semibold tabular-nums outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        {!eVariante && categorie.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-[var(--color-testo-tenue)]">Categoria</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {categorie.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  className={`h-12 rounded-lg px-4 text-sm font-medium ${
                    categoriaId === c.id
                      ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                      : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {errore && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        <div className="mt-5 flex gap-3 pb-5">
          <button
            type="button"
            onClick={onChiudi}
            className="h-16 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void conferma()}
            disabled={crea.isPending}
            className="h-16 flex-[2] rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
          >
            {crea.isPending ? 'Salvo…' : 'AGGIUNGI'}
          </button>
        </div>
      </div>
    </div>
  );
}
