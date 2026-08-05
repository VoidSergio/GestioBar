'use client';

import { useTransition } from 'react';
import { esci } from '@/app/login/azioni';

export function PulsanteEsci() {
  const [inCorso, avvia] = useTransition();

  return (
    <button
      type="button"
      disabled={inCorso}
      onClick={() => avvia(() => void esci())}
      className="h-11 rounded-lg border border-[var(--color-bordo)] px-4 text-sm text-[var(--color-testo-tenue)] active:bg-[var(--color-superficie-alta)] disabled:opacity-60"
    >
      {inCorso ? 'Esco…' : 'Esci'}
    </button>
  );
}
