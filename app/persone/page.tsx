import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataPersone } from '@/components/persone/schermata-persone';

export const metadata: Metadata = { title: 'Persone — Gestionale Bar' };

export default async function PaginaPersone() {
  const utente = await richiediAccesso();

  // Chi vieta davvero sono le policy su `profili` (0019_ruoli.sql). Questo
  // rimando serve a non far vedere a un barista una schermata di comandi che
  // gli darebbero tutti errore: nascondere non è vietare, ma mostrare una
  // porta chiusa senza dirlo è solo scortese.
  if (utente.profilo?.ruolo !== 'titolare') redirect('/altro');

  return <SchermataPersone ioSono={utente.id} />;
}
