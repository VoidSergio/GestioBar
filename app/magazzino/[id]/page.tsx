import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchedaArticolo } from '@/components/magazzino/scheda-articolo';

export const metadata: Metadata = { title: 'Articolo — Gestionale Bar' };

export default async function PaginaArticolo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utente = await richiediAccesso();
  const { id } = await params;
  return <SchedaArticolo id={id} eTitolare={utente.profilo?.ruolo === 'titolare'} />;
}
