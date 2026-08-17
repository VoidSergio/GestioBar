import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ImpostazioneBlocco } from '@/components/shell/impostazione-blocco';

export const metadata: Metadata = { title: 'Blocco schermo — Gestionale Bar' };

export default async function PaginaBlocco() {
  await richiediAccesso();
  return <ImpostazioneBlocco />;
}
