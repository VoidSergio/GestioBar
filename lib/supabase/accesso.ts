import { redirect } from 'next/navigation';
import { supabaseServer } from './server';
import type { Profilo } from './tipi';

export interface UtenteCorrente {
  id: string;
  email: string | null;
  profilo: Pick<Profilo, 'nome' | 'ruolo'> | null;
}

/**
 * Da chiamare all'inizio di ogni pagina che richiede l'accesso.
 * Se non c'è una sessione valida, rimanda a `/login`.
 *
 * PERCHÉ ESISTE, visto che c'è già `proxy.ts`.
 *
 * Il proxy è la prima linea: intercetta la richiesta e reindirizza prima
 * ancora che la pagina venga costruita. Ma il proxy è una funzione del
 * framework, e non tutti gli host la eseguono allo stesso modo — `proxy.ts`
 * è arrivato con Next 16 e richiede il runtime Node.js, che alcuni host non
 * usano per quel gancio.
 *
 * Se il proxy non gira, senza questo controllo la home si aprirebbe a
 * chiunque. Non mostrerebbe dati — RLS li nasconde comunque — ma sarebbe una
 * protezione basata su un effetto collaterale, non su una decisione.
 *
 * Due controlli indipendenti sulla stessa cosa non sono ridondanza inutile:
 * sono il motivo per cui il sistema non ha un unico punto di rottura.
 */
export async function richiediAccesso(): Promise<UtenteCorrente> {
  const supabase = await supabaseServer();

  // getUser() e non getSession(): il primo verifica il token con Supabase,
  // il secondo si fida di quello che c'è nel cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profilo } = await supabase
    .from('profili')
    .select('nome, ruolo')
    .eq('id', user.id)
    .maybeSingle();

  return { id: user.id, email: user.email ?? null, profilo: profilo ?? null };
}
