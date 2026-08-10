import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { ElencoScontrini } from '@/components/scontrini/elenco-scontrini';

export const metadata: Metadata = { title: 'Scontrini — Gestionale Bar' };

export default async function PaginaScontrini() {
  const utente = await richiediAccesso();

  // Il ruolo arriva dal server, non dal browser. Serve solo a mostrare o
  // nascondere il pulsante: chi vieta davvero è la policy su `pagamenti`
  // (0017_correzione_scontrino.sql). Nascondere non è vietare.
  return <ElencoScontrini puoCorreggere={utente.profilo?.ruolo === 'titolare'} />;
}
