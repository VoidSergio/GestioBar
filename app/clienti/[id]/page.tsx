import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchedaCliente } from '@/components/clienti/scheda-cliente';

export const metadata: Metadata = { title: 'Cliente — Gestionale Bar' };

export default async function PaginaCliente({ params }: { params: Promise<{ id: string }> }) {
  // Il ruolo arriva da qui e non da una query nel browser: `richiediAccesso`
  // lo legge già, e chiederlo di nuovo lato client sarebbe una richiesta in
  // più a ogni apertura di scheda. Non è una protezione — quella è la policy
  // RLS di 0010 — è solo per non mostrare un pulsante che non funzionerebbe.
  const utente = await richiediAccesso();
  const { id } = await params;
  return <SchedaCliente id={id} ruolo={utente.profilo?.ruolo ?? null} />;
}
