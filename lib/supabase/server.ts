import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './tipi';
import { leggiConfigurazione } from './configurazione';

/**
 * Client Supabase per i componenti server e le route handler.
 *
 * Va creato a ogni richiesta: contiene i cookie di quella richiesta e non
 * può essere condiviso fra utenti diversi.
 */
export async function supabaseServer() {
  const { url, chiaveAnon } = leggiConfigurazione();
  const magazzinoCookie = await cookies();

  return createServerClient<Database>(url, chiaveAnon, {
    cookies: {
      getAll() {
        return magazzinoCookie.getAll();
      },
      setAll(daImpostare) {
        try {
          for (const { name, value, options } of daImpostare) {
            magazzinoCookie.set(name, value, options);
          }
        } catch {
          // Chiamato da un Server Component: i cookie non si possono scrivere qui.
          // Il refresh della sessione avviene nel middleware, quindi si può ignorare.
        }
      },
    },
  });
}
