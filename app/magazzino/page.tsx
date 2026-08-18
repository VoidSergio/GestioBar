import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataMagazzino } from '@/components/magazzino/schermata-magazzino';

export const metadata: Metadata = { title: 'Magazzino — Gestionale Bar' };

export default async function PaginaMagazzino() {
  const utente = await richiediAccesso();

  // Un barista vede le giacenze e registra uno scarto: la bottiglia la rompe
  // chi sta al banco. Anagrafiche, distinta base e scarico automatico sono
  // del titolare, e chi vieta davvero sono le policy (0020_magazzino.sql).
  return <SchermataMagazzino eTitolare={utente.profilo?.ruolo === 'titolare'} />;
}
