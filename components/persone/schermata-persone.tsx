'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePersone, useModificaPersona } from '@/lib/hooks/use-persone';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';
import type { Profilo } from '@/lib/supabase/tipi';

/**
 * Chi lavora nel locale (T-41).
 *
 * GLI ACCOUNT SI CREANO DA SUPABASE, NON DA QUI, ed è una scelta: creare un
 * utente richiede la chiave `service_role`, quella che scavalca ogni
 * permesso. Tenerla fra le variabili d'ambiente del sito vorrebbe dire che da
 * quel momento esiste in un posto in più, tutti i giorni, per un'operazione
 * che capita due volte l'anno. Il criterio di T-41 diceva "senza aprire
 * Supabase" e questo non lo rispetta: sta scritto in `05-ROADMAP.md` invece
 * che essere aggirato in silenzio.
 *
 * Qui si fa quello che serve spesso: chi è titolare, chi è barista, e chi non
 * lavora più.
 *
 * I divieti veri stanno nel database (`0019_ruoli.sql`), non in questa
 * schermata: nessuno cambia il proprio ruolo, e l'ultimo titolare attivo non
 * si retrocede. Nascondere un pulsante non è vietare — se il pulsante fosse
 * l'unica difesa, basterebbe la chiave anon e una riga di SQL.
 */
export function SchermataPersone({ ioSono }: { ioSono: string }) {
  const { data: persone, isPending, error, refetch } = usePersone();
  const modifica = useModificaPersona();
  const [errore, setErrore] = useState<string | null>(null);

  function cambia(id: string, campi: { ruolo?: Profilo['ruolo']; attivo?: boolean }) {
    setErrore(null);
    modifica.mutate({ id, campi }, { onError: (e) => setErrore(e.message) });
  }

  const attivi = (persone ?? []).filter((p) => p.attivo);
  const spenti = (persone ?? []).filter((p) => !p.attivo);

  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-2 px-5 pb-3 pt-6">
          <Link
            href="/altro"
            aria-label="Torna indietro"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold">Persone</h1>
          <IndicatoreSync />
        </header>

        {errore && (
          <p
            role="alert"
            className="mx-5 mb-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        {error ? (
          <AvvisoLettura
            errore={error}
            cosa="L'elenco delle persone"
            rassicurazione="Non cambia niente di quello che è già registrato."
            onRiprova={() => void refetch()}
          />
        ) : isPending ? (
          <div className="space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
              {attivi.map((p) => (
                <RigaPersona key={p.id} persona={p} sonoIo={p.id === ioSono} onCambia={cambia} />
              ))}
            </ul>

            {spenti.length > 0 && (
              <>
                <p className="px-5 pb-2 pt-6 text-xs font-semibold uppercase text-[var(--color-testo-tenue)]">
                  Non lavorano più
                </p>
                <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)] opacity-60">
                  {spenti.map((p) => (
                    <RigaPersona
                      key={p.id}
                      persona={p}
                      sonoIo={p.id === ioSono}
                      onCambia={cambia}
                    />
                  ))}
                </ul>
              </>
            )}

            <div className="px-5 py-6">
              <p className="rounded-2xl bg-[var(--color-superficie)] px-5 py-4 text-sm text-[var(--color-testo-tenue)]">
                <strong className="block pb-1 text-[var(--color-testo)]">
                  Per aggiungere qualcuno
                </strong>
                Si invita da Supabase: <em>Authentication → Users → Invite user</em>. Riceve una
                mail, si registra, e compare qui come barista. Poi il ruolo lo cambi da questa
                schermata.
                <span className="mt-2 block">
                  Non si fa da qui perché creare un account richiede la chiave che scavalca tutti i
                  permessi: tenerla sul sito per un&apos;operazione che capita due volte l&apos;anno
                  non vale il rischio. Il passo per esteso è in{' '}
                  <code>docs/06-SETUP-SUPABASE.md</code> §5.3.
                </span>
              </p>
            </div>
          </>
        )}
      </main>

      <BarraNavigazione />
    </div>
  );
}

function RigaPersona({
  persona,
  sonoIo,
  onCambia,
}: {
  persona: Profilo;
  sonoIo: boolean;
  onCambia: (id: string, campi: { ruolo?: Profilo['ruolo']; attivo?: boolean }) => void;
}) {
  const titolare = persona.ruolo === 'titolare';

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {persona.nome}
            {sonoIo && (
              <span className="pl-2 text-xs font-normal text-[var(--color-testo-tenue)]">
                (sei tu)
              </span>
            )}
          </span>
          <span className="block text-xs text-[var(--color-testo-tenue)]">
            {titolare ? 'Titolare — cambia prezzi, ruoli e vede i report' : 'Barista — batte i conti e incassa'}
          </span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {/* Il proprio ruolo non si tocca: il database lo vieta, e mostrare un
            pulsante che darà errore è peggio che non mostrarlo. */}
        {!sonoIo && (
          <button
            type="button"
            onClick={() => onCambia(persona.id, { ruolo: titolare ? 'barista' : 'titolare' })}
            className="h-11 rounded-lg border border-[var(--color-bordo)] px-3 text-xs text-[var(--color-testo-tenue)]"
          >
            {titolare ? 'Rendi barista' : 'Rendi titolare'}
          </button>
        )}

        <button
          type="button"
          onClick={() => onCambia(persona.id, { attivo: !persona.attivo })}
          className="h-11 rounded-lg border border-[var(--color-bordo)] px-3 text-xs text-[var(--color-testo-tenue)]"
        >
          {persona.attivo ? 'Disattiva' : 'Riattiva'}
        </button>
      </div>
    </li>
  );
}
