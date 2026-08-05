import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataConto } from '@/components/conto/schermata-conto';

export const metadata: Metadata = { title: 'Conto — Gestionale Bar' };

export default async function PaginaConto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await richiediAccesso();
  const { id } = await params;
  return <SchermataConto id={id} />;
}
