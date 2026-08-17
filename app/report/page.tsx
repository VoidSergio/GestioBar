import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataReport } from '@/components/report/schermata-report';

export const metadata: Metadata = { title: 'Report — Gestionale Bar' };

export default async function PaginaReport() {
  const utente = await richiediAccesso();

  // Le viste dei report non restituiscono niente a chi non è titolare
  // (0019_ruoli.sql): senza questo rimando, un barista vedrebbe una schermata
  // di zeri e penserebbe che il locale non abbia lavorato.
  if (utente.profilo?.ruolo !== 'titolare') redirect('/altro');

  return <SchermataReport />;
}
