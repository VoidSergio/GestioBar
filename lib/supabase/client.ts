'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './tipi';
import { leggiConfigurazione } from './configurazione';

let istanza: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Client Supabase per il browser.
 *
 * Riusa sempre la stessa istanza: crearne più di una significa più connessioni
 * realtime aperte e sessioni che si sovrascrivono a vicenda.
 */
export function supabaseBrowser() {
  if (istanza) return istanza;

  const { url, chiaveAnon } = leggiConfigurazione();

  istanza = createBrowserClient<Database>(url, chiaveAnon, {
    auth: {
      // La sessione dura a lungo: chiedere la password ogni mattina alle 5
      // è il modo più veloce per far abbandonare l'app.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      // Bastano pochi eventi al secondo: qui non passa traffico pesante.
      params: { eventsPerSecond: 5 },
    },
  });

  return istanza;
}
