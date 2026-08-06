import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ElencoScontrini } from '@/components/scontrini/elenco-scontrini';

export const metadata: Metadata = { title: 'Scontrini — Gestionale Bar' };

export default async function PaginaScontrini() {
  await richiediAccesso();
  return <ElencoScontrini />;
}
