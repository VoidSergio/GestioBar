import Link from 'next/link';
import { configurazionePresente } from '@/lib/supabase/configurazione';
import { supabaseServer } from '@/lib/supabase/server';
import { formatEuro } from '@/lib/dominio/denaro';
import { PulsanteEsci } from '@/components/shell/pulsante-esci';

export const dynamic = 'force-dynamic';

interface Esito {
  etichetta: string;
  ok: boolean;
  dettaglio: string;
}

interface Diagnostica {
  esiti: Esito[];
  nome: string | null;
  ruolo: string | null;
  email: string | null;
}

async function controllaDatabase(): Promise<Diagnostica> {
  const esiti: Esito[] = [];
  let nome: string | null = null;
  let ruolo: string | null = null;
  let email: string | null = null;

  try {
    const sb = await supabaseServer();

    const {
      data: { user },
    } = await sb.auth.getUser();
    email = user?.email ?? null;

    if (user) {
      const { data: profilo, error: erroreProfilo } = await sb
        .from('profili')
        .select('nome, ruolo')
        .eq('id', user.id)
        .maybeSingle();

      nome = profilo?.nome ?? null;
      ruolo = profilo?.ruolo ?? null;

      esiti.push({
        etichetta: 'Profilo',
        ok: Boolean(profilo),
        dettaglio: erroreProfilo
          ? erroreProfilo.message
          : profilo
            ? `${profilo.nome} — ruolo ${profilo.ruolo}`
            : 'profilo non trovato: il trigger crea_profilo_utente non è scattato',
      });
    }

    const { count: nProdotti, error: erroreProdotti } = await sb
      .from('prodotti')
      .select('*', { count: 'exact', head: true });

    if (erroreProdotti) {
      esiti.push({
        etichetta: 'Tabelle',
        ok: false,
        dettaglio: `${erroreProdotti.message} — hai eseguito le migrazioni in supabase/migrations/?`,
      });
      return { esiti, nome, ruolo, email };
    }

    esiti.push({
      etichetta: 'Prodotti',
      ok: nProdotti === 59,
      dettaglio:
        nProdotti === 59
          ? '59 prodotti caricati'
          : `${nProdotti ?? 0} prodotti (attesi 59 — manca la migrazione del listino?)`,
    });

    const { count: nRiquadri, error: erroreGriglia } = await sb
      .from('v_griglia_prodotti')
      .select('*', { count: 'exact', head: true });

    esiti.push({
      etichetta: 'Griglia',
      ok: !erroreGriglia && nRiquadri === 34,
      dettaglio: erroreGriglia
        ? erroreGriglia.message
        : nRiquadri === 34
          ? '34 riquadri, uno per prodotto base'
          : `${nRiquadri ?? 0} riquadri (attesi 34)`,
    });

    const { error: erroreSaldi } = await sb.from('v_saldo_clienti').select('id').limit(1);

    esiti.push({
      etichetta: 'Vista saldi',
      ok: !erroreSaldi,
      dettaglio: erroreSaldi ? erroreSaldi.message : 'v_saldo_clienti risponde',
    });
  } catch (e) {
    esiti.push({
      etichetta: 'Connessione',
      ok: false,
      dettaglio: e instanceof Error ? e.message : 'errore sconosciuto',
    });
  }

  return { esiti, nome, ruolo, email };
}

export default async function Home() {
  const configurato = configurazionePresente();
  const { esiti, nome, ruolo, email } = configurato
    ? await controllaDatabase()
    : { esiti: [], nome: null, ruolo: null, email: null };

  const tuttoOk = configurato && esiti.length > 0 && esiti.every((e) => e.ok);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8 pb-sicura">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestionale Bar</h1>
          <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
            {nome ? `Ciao ${nome}` : (email ?? 'Impalcatura del progetto')}
            {ruolo && ` · ${ruolo}`}
          </p>
        </div>
        <PulsanteEsci />
      </header>

      <section className="rounded-2xl bg-[var(--color-superficie)] p-5">
        <p className="text-sm text-[var(--color-testo-tenue)]">Prova del modulo denaro</p>
        <p className="mt-1 text-3xl font-bold">{formatEuro(34850)}</p>
        <p className="mt-2 text-xs text-[var(--color-testo-tenue)]">
          Il numero sopra è l&apos;intero <code>34850</code> passato per{' '}
          <code>formatEuro</code>. Se lo vedi scritto correttamente, la regola dei
          centesimi funziona.
        </p>
      </section>

      <section className="rounded-2xl bg-[var(--color-superficie)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-testo-tenue)]">
          Stato del collegamento
        </h2>

        {!configurato ? (
          <p className="mt-3 text-sm text-[var(--color-attenzione)]">
            Supabase non è configurato: vedi <code>docs/06-SETUP-SUPABASE.md</code>.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {esiti.map((esito) => (
              <li key={esito.etichetta} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className={
                    esito.ok ? 'text-[var(--color-positivo)]' : 'text-[var(--color-debito)]'
                  }
                >
                  ●
                </span>
                <span className="flex-1">
                  <span className="font-medium">{esito.etichetta}</span>
                  <span className="block text-xs text-[var(--color-testo-tenue)]">
                    {esito.dettaglio}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tuttoOk && (
        <Link
          href="/prova-griglia"
          className="flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-[var(--color-accento)] px-5 py-4 text-[var(--color-sfondo)]"
        >
          <span>
            <span className="block font-semibold">Prova la griglia prodotti</span>
            <span className="block text-sm opacity-80">
              34 riquadri col tuo listino — conto finto, non salva nulla
            </span>
          </span>
          <span aria-hidden className="text-xl">
            →
          </span>
        </Link>
      )}

      <footer className="mt-auto text-xs text-[var(--color-testo-tenue)]">
        Questa schermata è provvisoria: verrà sostituita dall&apos;elenco dei conti
        aperti in T-11.
      </footer>
    </main>
  );
}
