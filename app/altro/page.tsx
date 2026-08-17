import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { MenuAltro } from '@/components/shell/menu-altro';

export const metadata: Metadata = { title: 'Altro — Gestionale Bar' };

export default async function PaginaAltro() {
  const utente = await richiediAccesso();

  // Il ruolo arriva dal server, non dal browser. Serve solo a decidere quali
  // voci mostrare: chi vieta davvero sono le policy (0019_ruoli.sql) e i
  // rimandi nelle pagine. Nascondere non è vietare.
  return <MenuAltro ruolo={utente.profilo?.ruolo ?? null} />;
}
