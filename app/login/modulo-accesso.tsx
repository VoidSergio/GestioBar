'use client';

import { useActionState, useState } from 'react';
import { accedi, type StatoAccesso } from './azioni';

const STATO_INIZIALE: StatoAccesso = {};

export function ModuloAccesso({ vai }: { vai: string }) {
  const [stato, azione, inCorso] = useActionState(accedi, STATO_INIZIALE);
  const [mostraPassword, setMostraPassword] = useState(false);

  return (
    <form action={azione} className="flex flex-col gap-4">
      <input type="hidden" name="vai" value={vai} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-[var(--color-testo-tenue)]">Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          defaultValue={stato.email}
          className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-superficie)] px-4 text-[var(--color-testo)] outline-none focus:border-[var(--color-accento)]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-[var(--color-testo-tenue)]">Password</span>
        <div className="relative">
          <input
            name="password"
            type={mostraPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-superficie)] pl-4 pr-20 text-[var(--color-testo)] outline-none focus:border-[var(--color-accento)]"
          />
          <button
            type="button"
            onClick={() => setMostraPassword((v) => !v)}
            className="absolute right-1 top-1 h-12 min-w-16 rounded-lg px-3 text-sm text-[var(--color-testo-tenue)] active:bg-[var(--color-superficie-alta)]"
          >
            {mostraPassword ? 'Nascondi' : 'Mostra'}
          </button>
        </div>
      </label>

      {stato.errore && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
        >
          {stato.errore}
        </p>
      )}

      <button
        type="submit"
        disabled={inCorso}
        className="mt-2 h-14 rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
      >
        {inCorso ? 'Accesso in corso…' : 'Entra'}
      </button>
    </form>
  );
}
