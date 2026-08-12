import { configurazionePresente } from '@/lib/supabase/configurazione';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { SchermataApertura } from '@/components/shell/schermata-apertura';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!configurazionePresente()) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold">Gestionale Bar</h1>
        <p className="mt-4 text-sm text-[var(--color-attenzione)]">
          Supabase non è configurato.
        </p>
        <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
          Copia <code>.env.local.example</code> in <code>.env.local</code> e inserisci i
          due valori che trovi su Supabase in Settings → API. Poi riavvia{' '}
          <code>npm run dev</code>. Guida completa in{' '}
          <code>docs/06-SETUP-SUPABASE.md</code>.
        </p>
      </main>
    );
  }

  // Seconda linea di difesa, indipendente da proxy.ts (lib/supabase/accesso.ts)
  await richiediAccesso();

  return <SchermataApertura />;
}
