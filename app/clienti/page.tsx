import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ElencoClienti } from '@/components/clienti/elenco-clienti';

export const metadata: Metadata = { title: 'Clienti — Gestionale Bar' };

export default async function PaginaClienti() {
  await richiediAccesso();
  return <ElencoClienti />;
}
