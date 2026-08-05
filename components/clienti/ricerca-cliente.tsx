'use client';

import { useEffect, useMemo, useState } from 'react';
import { descriviSaldo, statoSaldo } from '@/lib/dominio/denaro';
import { etichettaCliente, filtraClienti, ordinaPerRilevanza } from '@/lib/dominio/clienti';
import { useClienti, useCreaCliente } from '@/lib/hooks/use-clienti';
import type { SaldoCliente } from '@/lib/supabase/tipi';

interface Props {
  onScegli: (clienteId: string | null, etichetta: string) => void;
  onChiudi: () => void;
}

/**
 * "A chi?" — il pannello che si apre dal + della home (04-UX-MOBILE.md §4).
 *
 * Sale dal basso perché è il tap numero 2 di tre: deve cadere sotto il pollice
 * senza spostare la mano.
 */
export function RicercaCliente({ onScegli, onChiudi }: Props) {
  const { data: clienti } = useClienti();
  const crea = useCreaCliente();
  const [ricerca, setRicerca] = useState('');

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  const visibili = useMemo(
    () => ordinaPerRilevanza(filtraClienti(clienti ?? [], ricerca)).slice(0, 12),
    [clienti, ricerca],
  );

  const nomeNuovo = ricerca.trim();
  const nessunRisultato = nomeNuovo.length > 0 && visibili.length === 0;

  async function creaEApri() {
    const cliente = await crea.mutateAsync({ nome: nomeNuovo });
    onScegli(cliente.id, cliente.nome);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--color-superficie)] pb-sicura">
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <div className="px-5 pb-3 pt-4">
          <h2 className="text-lg font-semibold">A chi?</h2>
          <input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca o scrivi un nome"
            autoCapitalize="words"
            autoCorrect="off"
            className="mt-3 h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Il banco è sempre in cima: è il caso più frequente */}
          {!ricerca && (
            <button
              type="button"
              onClick={() => onScegli(null, 'Banco')}
              className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--color-bordo)] px-5 text-left active:bg-[var(--color-superficie-alta)]"
            >
              <span className="text-xl" aria-hidden>
                🏪
              </span>
              <span>
                <span className="block font-medium">Banco</span>
                <span className="block text-xs text-[var(--color-testo-tenue)]">
                  paga subito, senza intestazione
                </span>
              </span>
            </button>
          )}

          {nessunRisultato ? (
            <div className="px-5 py-6">
              <p className="text-sm text-[var(--color-testo-tenue)]">
                Nessun cliente trovato.
              </p>
              <button
                type="button"
                onClick={() => void creaEApri()}
                disabled={crea.isPending}
                className="mt-3 h-14 w-full rounded-xl bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)] disabled:opacity-60"
              >
                {crea.isPending ? 'Creo…' : `Crea "${nomeNuovo}" e apri il conto`}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-bordo)]">
              {visibili.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onScegli(c.id, etichettaCliente(c))}
                    className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left active:bg-[var(--color-superficie-alta)]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {etichettaCliente(c)}
                    </span>
                    <SaldoAccanto cliente={c} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Il saldo accanto al nome: il barista decide con l'informazione davanti,
 * non dopo aver aperto il conto.
 */
function SaldoAccanto({ cliente }: { cliente: SaldoCliente }) {
  const stato = statoSaldo(cliente.saldo_cent);
  const oltreLimite =
    cliente.limite_credito_cent !== null && cliente.saldo_cent > cliente.limite_credito_cent;

  if (stato === 'in_pari') {
    return <span className="shrink-0 text-sm text-[var(--color-testo-tenue)]">in pari</span>;
  }

  return (
    <span className="shrink-0 text-right">
      <span
        className={`block text-sm tabular-nums ${
          stato === 'deve'
            ? 'font-semibold text-[var(--color-debito)]'
            : 'text-[var(--color-positivo)]'
        }`}
      >
        {descriviSaldo(cliente.saldo_cent)}
      </span>
      {/* Avvisa, non impedisce: rifiutare un caffè davanti agli altri
          è socialmente inaccettabile (CLAUDE.md, contesto sul dominio) */}
      {oltreLimite && (
        <span className="block text-xs text-[var(--color-debito)]">oltre il limite</span>
      )}
    </span>
  );
}
