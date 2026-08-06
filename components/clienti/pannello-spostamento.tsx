'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { etichettaCliente, filtraClienti, ordinaPerRilevanza } from '@/lib/dominio/clienti';
import {
  pezziSpostabili,
  verificaSpostamento,
  type RigaSpostabile,
} from '@/lib/dominio/spostamenti';
import { useClienti } from '@/lib/hooks/use-clienti';
import { useSpostaRiga } from '@/lib/hooks/use-cliente';
import type { SaldoCliente } from '@/lib/supabase/tipi';

/**
 * "Chi lo offre?" — sposta una consumazione a un altro cliente.
 *
 * Il caso vero: Michele ha preso tre caffè a credito, passa Luca e ne offre
 * uno. Il caffè è già stato bevuto e già registrato, quindi non si torna
 * indietro: si storna un pezzo a Michele e lo si addebita a Luca, allo
 * stesso prezzo (DEC-05). Restano due movimenti visibili su entrambi gli
 * estratti conto, ed è il motivo per cui l'operazione si può disfare
 * spostando indietro.
 */

interface Props {
  riga: RigaSpostabile;
  clienteOrigine: SaldoCliente;
  onChiudi: () => void;
  onFatto: (messaggio: string) => void;
}

export function PannelloSpostamento({ riga, clienteOrigine, onChiudi, onFatto }: Props) {
  const { data: clienti } = useClienti();
  const sposta = useSpostaRiga();

  const disponibili = pezziSpostabili(riga);
  const [quantita, setQuantita] = useState(1);
  const [ricerca, setRicerca] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const candidati = useMemo(
    () =>
      ordinaPerRilevanza(
        filtraClienti(clienti ?? [], ricerca).filter((c) => c.id !== clienteOrigine.id),
      ).slice(0, 10),
    [clienti, ricerca, clienteOrigine.id],
  );

  async function spostaA(destinazione: SaldoCliente) {
    setErrore(null);

    const controllo = verificaSpostamento({
      riga,
      quantita,
      clienteOrigineId: clienteOrigine.id,
      clienteDestinazioneId: destinazione.id,
    });
    if (!controllo.valido) {
      setErrore(controllo.errore);
      return;
    }

    try {
      await sposta.mutateAsync({
        riga,
        quantita,
        clienteOrigineId: clienteOrigine.id,
        clienteDestinazioneId: destinazione.id,
      });
      onFatto(
        `${quantita > 1 ? `${riga.descrizione} ×${quantita}` : riga.descrizione} ora è sul conto di ${destinazione.nome}.`,
      );
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a spostarlo.');
    }
  }

  const importo = riga.prezzoUnitarioCent * quantita;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-[var(--color-superficie)] pb-sicura">
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <div className="px-5 pb-3 pt-4">
          <h2 className="text-lg font-semibold">Chi lo offre?</h2>
          <p className="mt-0.5 text-sm text-[var(--color-testo-tenue)]">
            {riga.descrizione} · da {etichettaCliente(clienteOrigine)}
          </p>

          {/* Quanti pezzi: compare solo se ce n'è più di uno da spostare */}
          {disponibili > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantita((q) => Math.max(1, q - 1))}
                disabled={quantita <= 1}
                aria-label="Uno di meno"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-bordo)] text-2xl disabled:opacity-30"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold tabular-nums">{quantita}</p>
                <p className="text-xs text-[var(--color-testo-tenue)]">di {disponibili}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuantita((q) => Math.min(disponibili, q + 1))}
                disabled={quantita >= disponibili}
                aria-label="Uno di più"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-bordo)] text-2xl disabled:opacity-30"
              >
                +
              </button>
            </div>
          )}

          <p className="mt-3 flex items-baseline justify-between rounded-xl bg-[var(--color-sfondo)] px-4 py-3 text-sm">
            <span className="text-[var(--color-testo-tenue)]">Si sposta</span>
            <span className="text-xl font-bold tabular-nums">{formatEuro(importo)}</span>
          </p>

          <input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca chi lo prende"
            autoCapitalize="words"
            autoCorrect="off"
            className="mt-3 h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
          />

          {errore && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
            >
              {errore}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-bordo)]">
          {candidati.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-testo-tenue)]">
              {/* Qui non si crea un cliente nuovo: chi offre è qualcuno che
                  sta al banco adesso, e se non è in anagrafica va prima
                  registrato dai Clienti. */}
              Nessun cliente trovato.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-bordo)]">
              {candidati.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void spostaA(c)}
                    disabled={sposta.isPending}
                    className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left active:bg-[var(--color-superficie-alta)] disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {etichettaCliente(c)}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-[var(--color-testo-tenue)]">
                      {c.saldo_cent > 0 ? `deve ${formatEuro(c.saldo_cent)}` : 'in pari'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-4">
          <button
            type="button"
            onClick={onChiudi}
            className="h-14 w-full rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
