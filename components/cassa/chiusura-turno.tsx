'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatEuro, parseEuro } from '@/lib/dominio/denaro';
import {
  calcolaLettura,
  descriviDurata,
  intestazioneTurno,
  segnoDifferenza,
  serveCausale,
  turnoTroppoLungo,
  validaConteggio,
  type StatoTurno,
} from '@/lib/dominio/cassa';
import { useChiudiTurno, useTurnoCorrente } from '@/lib/hooks/use-turno';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';

interface Props {
  utenteId: string;
  nome: string;
}

export function ChiusuraTurno({ utenteId, nome }: Props) {
  const turno = useTurnoCorrente();
  const chiudi = useChiudiTurno();

  const [testo, setTesto] = useState('');
  const [causale, setCausale] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [fatta, setFatta] = useState<{ ritiraCent: number; lasciaCent: number } | null>(null);

  if (turno.isLoading) {
    return <Guscio><p className="px-5 py-8 text-[var(--color-testo-tenue)]">Sto leggendo il turno…</p></Guscio>;
  }

  if (turno.isError || !turno.data) {
    return (
      <Guscio>
        <AvvisoLettura
          errore={turno.error}
          cosa="La chiusura di turno"
          rassicurazione="Gli incassi restano registrati: quello che manca è il riepilogo."
          onRiprova={() => void turno.refetch()}
        />
      </Guscio>
    );
  }

  const d = turno.data;
  const stato: StatoTurno = {
    iniziatoIl: d.iniziato_il,
    fondoCassaCent: d.fondo_cassa_cent,
    incassatoContantiCent: d.incassato_contanti_cent,
    incassatoCartaCent: d.incassato_carta_cent,
    incassatoAltroCent: d.incassato_altro_cent,
    variazioneCreditoCent: d.variazione_credito_cent,
  };

  /* ------------------------------------------ dopo la conferma */
  if (fatta) {
    return (
      <Guscio>
        <div className="px-5 py-10">
          <p className="mb-8 text-lg">Turno chiuso.</p>

          <p className="text-sm uppercase tracking-wide text-[var(--color-testo-tenue)]">Ritira</p>
          <p className="mb-6 text-4xl font-bold tabular-nums">{formatEuro(fatta.ritiraCent)}</p>

          <p className="text-sm uppercase tracking-wide text-[var(--color-testo-tenue)]">
            Lascia in cassa
          </p>
          <p className="text-4xl font-bold tabular-nums">{formatEuro(fatta.lasciaCent)}</p>

          <p className="mt-8 text-sm text-[var(--color-testo-tenue)]">
            Se ti sei sbagliato a contare hai cinque minuti per rifarla, poi resta.
          </p>

          <Link
            href="/"
            className="mt-8 flex min-h-16 items-center justify-center rounded-xl bg-[var(--color-accento-scuro)] text-lg font-semibold"
          >
            Ho finito
          </Link>
        </div>
      </Guscio>
    );
  }

  /* ------------------------------------------ la lettura */
  const contato = parseEuro(testo);
  const lettura = contato === null ? null : calcolaLettura(stato, contato);
  const segno = lettura ? segnoDifferenza(lettura.differenzaCent) : null;
  const causaleRichiesta = lettura !== null && serveCausale(lettura.differenzaCent);
  const sospetto = turnoTroppoLungo(d.iniziato_il);

  async function conferma() {
    setErrore(null);
    const esito = validaConteggio(contato, stato);
    if (!esito.valido) {
      setErrore(esito.motivo);
      return;
    }
    if (causaleRichiesta && causale.trim() === '') {
      setErrore('Scrivi in due parole perché la cassa non torna.');
      return;
    }

    const l = calcolaLettura(stato, esito.contatoCent);
    await chiudi.mutateAsync({
      iniziatoIl: stato.iniziatoIl,
      fondoCassaCent: stato.fondoCassaCent,
      contatoCent: esito.contatoCent,
      incassatoContantiCent: stato.incassatoContantiCent,
      incassatoCartaCent: stato.incassatoCartaCent,
      incassatoAltroCent: stato.incassatoAltroCent,
      variazioneCreditoCent: stato.variazioneCreditoCent,
      causale: causale.trim() === '' ? null : causale.trim(),
      chiusoDa: utenteId,
    });
    setFatta({ ritiraCent: l.ritiraCent, lasciaCent: l.lasciaCent });
  }

  return (
    <Guscio>
      <div className="px-5 pb-40">
        <p className="text-sm text-[var(--color-testo-tenue)]">
          {nome} · {intestazioneTurno(d.iniziato_il)} · {descriviDurata(d.iniziato_il)}
        </p>

        {sospetto && (
          <p className="mt-3 rounded-xl border border-[var(--color-attenzione)] px-4 py-3 text-sm">
            Questo turno è aperto da più di sedici ore: probabilmente chi ha smontato prima non ha
            chiuso. Gli incassi qui sotto comprendono anche i suoi.
          </p>
        )}

        {/* Il conto, tre righe e una somma. Il venduto non compare: chi conta
            i soldi non ne ha bisogno, e messo qui farebbe sottrarre due volte. */}
        <dl className="mt-6 space-y-3 text-lg">
          <Riga etichetta="Fondo cassa" valore={formatEuro(stato.fondoCassaCent)} />
          <Riga
            etichetta="Incassato in contanti"
            valore={formatEuro(stato.incassatoContantiCent)}
          />
          <div className="border-t border-[var(--color-bordo)] pt-3">
            <Riga
              etichetta="Atteso nel cassetto"
              valore={formatEuro(stato.fondoCassaCent + stato.incassatoContantiCent)}
              forte
            />
          </div>
        </dl>

        <label className="mt-8 block">
          <span className="text-sm uppercase tracking-wide text-[var(--color-testo-tenue)]">
            Contato nel cassetto
          </span>
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder="0,00"
            aria-label="Quanto c'è nel cassetto"
            className="mt-2 min-h-16 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-superficie)] px-4 text-3xl font-bold tabular-nums"
          />
        </label>

        {lettura && (
          <div className="mt-6">
            <div
              className={`rounded-xl px-4 py-4 ${
                segno === 'in_pari'
                  ? 'bg-[var(--color-superficie)]'
                  : 'border border-[var(--color-attenzione)]'
              }`}
            >
              <Riga
                etichetta={
                  segno === 'in_pari' ? 'La cassa torna' : segno === 'manca' ? 'Manca' : 'Avanza'
                }
                valore={
                  segno === 'in_pari' ? '' : formatEuro(Math.abs(lettura.differenzaCent))
                }
                forte
              />
            </div>

            <dl className="mt-6 space-y-3 text-lg">
              <Riga etichetta="Ritira" valore={formatEuro(lettura.ritiraCent)} forte />
              <Riga etichetta="Lascia in cassa" valore={formatEuro(lettura.lasciaCent)} forte />
            </dl>
          </div>
        )}

        {causaleRichiesta && (
          <label className="mt-6 block">
            <span className="text-sm text-[var(--color-testo-tenue)]">
              Perché non torna? Basta una riga, serve fra un mese.
            </span>
            <input
              value={causale}
              onChange={(e) => setCausale(e.target.value)}
              placeholder="es. resto sbagliato a un cliente"
              className="mt-2 min-h-14 w-full rounded-xl border border-[var(--color-bordo)] bg-[var(--color-superficie)] px-4 text-base"
            />
          </label>
        )}

        {/* Fuori dalla riconciliazione, e detto chiaramente. */}
        <p className="mt-8 text-sm text-[var(--color-testo-tenue)]">
          Non è nel cassetto: {formatEuro(stato.incassatoCartaCent)} con carta
          {stato.incassatoAltroCent !== 0 && <> · {formatEuro(stato.incassatoAltroCent)} altro</>}
          {stato.variazioneCreditoCent !== 0 && (
            <> · il credito in giro è cambiato di {formatEuro(stato.variazioneCreditoCent)}</>
          )}
        </p>

        {errore && <p className="mt-6 text-[var(--color-debito)]">{errore}</p>}
      </div>

      {/* Azione principale in basso: 04-UX-MOBILE §1 */}
      <div className="fixed inset-x-0 bottom-16 border-t border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-5 py-3">
        <button
          onClick={() => void conferma()}
          disabled={contato === null || chiudi.isPending}
          className="min-h-16 w-full rounded-xl bg-[var(--color-accento-scuro)] text-lg font-semibold disabled:opacity-40"
        >
          {chiudi.isPending ? 'Chiudo…' : 'Chiudi il turno'}
        </button>
      </div>
    </Guscio>
  );
}

function Guscio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-2 px-5 pb-2 pt-6">
          <h1 className="text-xl font-bold">Chiusura turno</h1>
          <IndicatoreSync />
        </header>
        {children}
      </main>
      <BarraNavigazione />
    </div>
  );
}

function Riga({
  etichetta,
  valore,
  forte = false,
}: {
  etichetta: string;
  valore: string;
  forte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={forte ? 'font-semibold' : 'text-[var(--color-testo-tenue)]'}>{etichetta}</dt>
      <dd className={`tabular-nums ${forte ? 'text-2xl font-bold' : 'text-xl'}`}>{valore}</dd>
    </div>
  );
}
