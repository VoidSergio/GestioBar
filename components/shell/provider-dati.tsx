'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avviaSalvataggioCache, ripristinaCache } from '@/lib/offline/cache-query';

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
            // Senza rete, TanStack Query sospende le query invece di farle
            // fallire: i dati ripristinati da IndexedDB restano a schermo.
            networkMode: 'offlineFirst',
          },
        },
      }),
  );

  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let smetti: (() => void) | undefined;

    void ripristinaCache(client).then(() => {
      setPronto(true);
      smetti = avviaSalvataggioCache(client);
    });

    return () => smetti?.();
  }, [client]);

  // Finché la copia locale non è stata letta non si disegna nulla: mostrare
  // "nessun prodotto" per mezzo secondo e poi riempire la griglia è peggio
  // di una schermata vuota per mezzo secondo.
  if (!pronto) return null;

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
