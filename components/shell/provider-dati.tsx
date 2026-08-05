'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Provider di TanStack Query.
 *
 * La persistenza su IndexedDB e l'indicatore di rete arrivano con T-07:
 * qui c'è solo la cache in memoria, che basta a far funzionare gli hook.
 */
export function ProviderDati({ children }: { children: ReactNode }) {
  // useState e non una costante a livello di modulo: un QueryClient condiviso
  // fra richieste diverse sul server farebbe vedere a un utente i dati di
  // un altro.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Il listino cambia di rado: un'ora di dati "freschi" evita
            // richieste inutili a ogni cambio di schermata.
            staleTime: 60 * 60 * 1000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
