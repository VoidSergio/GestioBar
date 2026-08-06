import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { GestioneListino } from '@/components/listino/gestione-listino';

export const metadata: Metadata = { title: 'Listino — Gestionale Bar' };

export default async function PaginaListino() {
  await richiediAccesso();
  return <GestioneListino />;
}
