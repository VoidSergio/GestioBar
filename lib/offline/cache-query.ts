'use client';

import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { dbLocale } from './db';

const CHIAVE = 'stato-query';

/**
 * Durata massima della copia locale. Oltre, si riparte puliti: dati di due
 * giorni fa non servono a nessuno e occupano spazio.
 */
const SCADENZA_MS = 24 * 60 * 60 * 1000;

/**
 * Salva e ripristina la cache di TanStack Query su IndexedDB.
 *
 * Perché scritto a mano invece di usare `@tanstack/react-query-persist-client`:
 * quel pacchetto fa esattamente questo, ma sarebbe una dipendenza in più non
 * prevista in 03-ARCHITETTURA.md §1. `dehydrate` e `hydrate` sono già dentro
 * TanStack Query e `idb` è già in elenco: quaranta righe contro un pacchetto.
 * Se un domani servisse la gestione fine delle versioni, si passa al pacchetto
 * ufficiale senza cambiare nient'altro.
 */

export async function ripristinaCache(client: QueryClient): Promise<boolean> {
  try {
    const db = await dbLocale();
    const salvato = await db.get('cache', CHIAVE);
    if (!salvato) return false;

    if (Date.now() - salvato.salvatoIl > SCADENZA_MS) {
      await db.delete('cache', CHIAVE);
      return false;
    }

    hydrate(client, salvato.contenuto);
    return true;
  } catch {
    // Un database locale illeggibile non deve impedire l'avvio dell'app:
    // si riparte senza copia locale e si ricarica dal server.
    return false;
  }
}

export async function salvaCache(client: QueryClient): Promise<void> {
  try {
    const db = await dbLocale();
    await db.put('cache', {
      chiave: CHIAVE,
      contenuto: dehydrate(client),
      salvatoIl: Date.now(),
    });
  } catch {
    // Spazio esaurito o modalità privata: l'app continua a funzionare
    // online, perde solo la capacità di leggere offline.
  }
}

/**
 * Comincia a salvare la cache a ogni cambiamento, accorpando le scritture.
 * Restituisce la funzione per smettere.
 */
export function avviaSalvataggioCache(client: QueryClient, attesaMs = 1000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const annulla = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void salvaCache(client), attesaMs);
  });

  const primaDiChiudere = () => void salvaCache(client);
  window.addEventListener('pagehide', primaDiChiudere);

  return () => {
    if (timer) clearTimeout(timer);
    annulla();
    window.removeEventListener('pagehide', primaDiChiudere);
  };
}
