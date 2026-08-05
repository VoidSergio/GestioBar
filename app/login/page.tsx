import type { Metadata } from 'next';
import { configurazionePresente } from '@/lib/supabase/configurazione';
import { ModuloAccesso } from './modulo-accesso';

export const metadata: Metadata = { title: 'Accedi — Gestionale Bar' };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ vai?: string }>;
}) {
  const { vai } = await searchParams;
  const configurato = configurazionePresente();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-sicura">
      {/*
        Il modulo sta nella metà bassa: si compila con il pollice, in piedi,
        con una mano sola (04-UX-MOBILE.md §1).
      */}
      <div className="flex flex-1 flex-col justify-end pb-10 pt-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold">Gestionale Bar</h1>
          <p className="mt-2 text-[var(--color-testo-tenue)]">
            Entra per vedere conti e crediti.
          </p>
        </header>

        {configurato ? (
          <ModuloAccesso vai={vai ?? '/'} />
        ) : (
          <div className="rounded-xl border border-[var(--color-attenzione)]/40 bg-[var(--color-attenzione)]/10 p-4 text-sm">
            <p className="font-medium text-[var(--color-attenzione)]">
              Configurazione mancante
            </p>
            <p className="mt-1 text-[var(--color-testo-tenue)]">
              Il file <code>.env.local</code> non contiene indirizzo e chiave di
              Supabase. Vedi <code>docs/06-SETUP-SUPABASE.md</code> §3.
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[var(--color-testo-tenue)]">
          Gli accessi li crea il titolare. Se non riesci a entrare, chiedi a lui.
        </p>
      </div>
    </main>
  );
}
