/**
 * Lettura delle variabili d'ambiente, con messaggi in italiano.
 *
 * Se manca la configurazione, un errore chiaro adesso vale dieci minuti
 * di ricerca dopo.
 */

export interface ConfigurazioneSupabase {
  url: string;
  chiaveAnon: string;
}

export function configurazionePresente(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function leggiConfigurazione(): ConfigurazioneSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !chiaveAnon) {
    throw new Error(
      'Configurazione Supabase mancante.\n' +
        'Copia .env.local.example in .env.local e inserisci i due valori che trovi ' +
        'su Supabase in Settings → API (vedi docs/06-SETUP-SUPABASE.md §3).\n' +
        'Dopo aver modificato .env.local riavvia `npm run dev`.',
    );
  }

  if (url.includes('xxxxxxxxxxxx')) {
    throw new Error(
      'In .env.local c\'è ancora l\'indirizzo di esempio. ' +
        'Sostituiscilo con il Project URL del tuo progetto Supabase.',
    );
  }

  return { url, chiaveAnon };
}
