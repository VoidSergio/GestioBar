import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchedaCliente } from '@/components/clienti/scheda-cliente';

export const metadata: Metadata = { title: 'Cliente — Gestionale Bar' };

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await richiediAccesso();
  const { id } = await params;
  return <SchedaCliente id={id} />;
}
