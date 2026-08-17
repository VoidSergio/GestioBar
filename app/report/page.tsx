import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataReport } from '@/components/report/schermata-report';

export const metadata: Metadata = { title: 'Report — Gestionale Bar' };

export default async function PaginaReport() {
  await richiediAccesso();
  return <SchermataReport />;
}
