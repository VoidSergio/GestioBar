import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './tipi';
import { configurazionePresente, leggiConfigurazione } from './configurazione';
import { rottaPubblica } from '@/lib/dominio/rotte';

/**
 * Rinnova la sessione a ogni richiesta e protegge le rotte.
 *
 * Il token di accesso di Supabase dura un'ora: senza questo rinnovo, un barista
 * che lascia l'app aperta si troverebbe scollegato a metà turno. Qui il token
 * viene rinfrescato in silenzio e il nuovo cookie riscritto nella risposta.
 */
export async function aggiornaSessione(request: NextRequest) {
  // Senza configurazione non si può fare nulla: lascia passare, ci pensa la
  // schermata a spiegare cosa manca.
  if (!configurazionePresente()) {
    return NextResponse.next({ request });
  }

  let risposta = NextResponse.next({ request });
  const { url, chiaveAnon } = leggiConfigurazione();

  const supabase = createServerClient<Database>(url, chiaveAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(daImpostare) {
        for (const { name, value } of daImpostare) {
          request.cookies.set(name, value);
        }
        risposta = NextResponse.next({ request });
        for (const { name, value, options } of daImpostare) {
          risposta.cookies.set(name, value, options);
        }
      },
    },
  });

  // Va chiamato getUser() e non getSession(): il primo verifica il token con
  // il server di Supabase, il secondo si fida di quello che c'è nel cookie.
  // Su una rotta di protezione, fidarsi del cookie non basta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const percorso = request.nextUrl.pathname;
  // La regola sta in `lib/dominio/rotte.ts`, con i test: il `matcher` di
  // `proxy.ts` esclude già `/offline` a monte, questa è la seconda serratura.
  const ePubblica = rottaPubblica(percorso);

  if (!user && !ePubblica) {
    const destinazione = request.nextUrl.clone();
    destinazione.pathname = '/login';
    // Ricorda dove voleva andare, per riportarcelo dopo l'accesso.
    if (percorso !== '/') {
      destinazione.searchParams.set('vai', percorso);
    }
    return NextResponse.redirect(destinazione);
  }

  if (user && percorso.startsWith('/login')) {
    const destinazione = request.nextUrl.clone();
    destinazione.pathname = '/';
    destinazione.search = '';
    return NextResponse.redirect(destinazione);
  }

  // IMPORTANTE: va restituito proprio questo oggetto, non uno nuovo.
  // Costruirne un altro perderebbe i cookie di sessione appena riscritti,
  // e l'utente verrebbe scollegato a ogni richiesta.
  return risposta;
}
