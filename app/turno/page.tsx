import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ChiusuraTurno } from '@/components/cassa/chiusura-turno';

export const metadata: Metadata = { title: 'Chiusura turno — Gestionale Bar' };

/**
 * T-22. Chi chiude scrive un numero solo: quanto c'è nel cassetto.
 *
 * L'identità arriva dal server e non dal browser: la policy di inserimento su
 * `chiusure_turno` pretende che `chiuso_da` coincida con `auth.uid()`, quindi
 * un valore scelto dal client verrebbe rifiutato — ed è giusto così, la firma
 * su una lettura di cassa non la sceglie chi firma.
 */
export default async function PaginaTurno() {
  const utente = await richiediAccesso();
  return <ChiusuraTurno utenteId={utente.id} nome={utente.profilo?.nome ?? 'Turno'} />;
}
