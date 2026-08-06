import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ElencoCrediti } from '@/components/crediti/elenco-crediti';

export const metadata: Metadata = { title: 'Crediti — Gestionale Bar' };

export default async function PaginaCrediti() {
  await richiediAccesso();
  return <ElencoCrediti />;
}
