'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export interface StatoAccesso {
  errore?: string;
  email?: string;
}

/**
 * Traduce gli errori di Supabase in italiano comprensibile.
 *
 * Regola di CLAUDE.md: mai codici tecnici, mai "Qualcosa è andato storto".
 * Alle 5 del mattino con la fila davanti, un messaggio deve dire cosa fare.
 */
function messaggioErrore(codice: string | undefined, testo: string): string {
  switch (codice) {
    case 'invalid_credentials':
      return 'Email o password non corretti. Controlla e riprova.';
    case 'email_not_confirmed':
      return 'Questo indirizzo email non è ancora stato confermato. Controlla la posta.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Troppi tentativi ravvicinati. Aspetta un minuto e riprova.';
    case 'user_banned':
      return 'Questo accesso è stato disattivato. Chiedi al titolare.';
    default:
      // Casi non mappati: distinguo almeno la rete dal resto.
      if (/fetch|network|ENOTFOUND|ETIMEDOUT/i.test(testo)) {
        return 'Nessuna connessione. Per accedere serve la rete: una volta entrato, l\'app funziona anche senza.';
      }
      return 'Accesso non riuscito. Riprova; se continua, avvisa il titolare.';
  }
}

export async function accedi(
  _statoPrecedente: StatoAccesso,
  dati: FormData,
): Promise<StatoAccesso> {
  const email = String(dati.get('email') ?? '').trim();
  const password = String(dati.get('password') ?? '');
  const vai = String(dati.get('vai') ?? '/');

  if (!email || !password) {
    return { errore: 'Servono email e password.', email };
  }

  let supabase;
  try {
    supabase = await supabaseServer();
  } catch (e) {
    return {
      errore: e instanceof Error ? e.message : 'Configurazione non valida.',
      email,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { errore: messaggioErrore(error.code, error.message), email };
  }

  // redirect() lancia un'eccezione di controllo: va fuori dal try/catch.
  redirect(vai.startsWith('/') ? vai : '/');
}

export async function esci() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
