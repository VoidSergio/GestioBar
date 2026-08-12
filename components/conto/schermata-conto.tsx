'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GrigliaProdotti } from './griglia-prodotti';
import { RigheConto } from './righe-conto';
import { PannelloPagamento } from './pannello-pagamento';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { RicercaCliente } from '@/components/clienti/ricerca-cliente';
import { descriviSaldo, formatEuro, statoSaldo } from '@/lib/dominio/denaro';
import {
  contiInAttesa,
  eVuota,
  puoAndareACredito,
  totaleBozza,
  type Bozza,
} from '@/lib/dominio/bozza';
import {
  useAnnullaBozza,
  useApriConto,
  useAssegnaCliente,
  useBozza,
  useBozze,
  useConfermaConto,
} from '@/lib/hooks/use-bozze';
import { useClienti } from '@/lib/hooks/use-clienti';
import { nuovoId } from '@/lib/utils';

/**
 * Il conto in composizione.
 *
 * Si usa in due posti, ed è la stessa schermata perché è la stessa cosa:
 *
 *  - come **schermata di apertura** (`eHome`), sul conto al banco che l'app
 *    tiene sempre pronto. Aperta l'app, la griglia è già lì: si batte al
 *    primo tocco, senza passare da nessuna domanda;
 *  - come **dettaglio di un conto** aperto a nome di qualcuno, raggiunto
 *    dalla striscia in cima o dalla scheda cliente.
 *
 * PERCHÉ IL NOME SI CHIEDE ALLA FINE.
 *
 * Prima l'ordine era: chi è → cosa prende. Ma nel bar l'ordinazione arriva
 * prima del nome, e in gran parte dei casi il nome non serve mai: uno che
 * paga e se ne va non ha bisogno di essere nessuno. Chiederlo prima voleva
 * dire pagare due tocchi su ogni caffè per un'informazione che serve solo
 * quando il conto va a credito.
 *
 * Adesso: cosa prende → e solo se resta a debito, chi è. La bozza è locale
 * fino alla conferma (DEC-08), quindi cambiarle intestatario a metà strada
 * non tocca nessun dato registrato.
 */

/** Quanto resta a schermo il riepilogo dopo la conferma (04-UX-MOBILE §6). */
const DURATA_RIEPILOGO_MS = 2000;

interface Riepilogo {
  etichetta: string;
  nuovoSaldoCent: number;
  restoCent: number;
  haCliente: boolean;
}

/** Perché stiamo chiedendo "a chi?". Cambia solo cosa si fa con la risposta. */
type MotivoRicerca = 'assegna' | 'nuovo' | 'a_credito' | 'incasso';

/** La domanda in cima al pannello. Chiedere la cosa giusta costa zero. */
const DOMANDA: Record<MotivoRicerca, string> = {
  assegna: 'Di chi è questo conto?',
  nuovo: 'Un altro conto, a chi?',
  a_credito: 'A chi lo segno?',
  incasso: 'Chi paga?',
};

export function SchermataConto({ id, eHome = false }: { id: string; eHome?: boolean }) {
  const router = useRouter();
  const { bozza, caricata, aggiungiProdotto, diminuisciVoce } = useBozza(id);
  const { bozze } = useBozze();
  const { data: clienti } = useClienti();
  const conferma = useConfermaConto();
  const annulla = useAnnullaBozza();
  const apri = useApriConto();
  const assegna = useAssegnaCliente();
  const [inCorso, setInCorso] = useState(false);
  const [pagamentoAperto, setPagamentoAperto] = useState(false);
  const [ricerca, setRicerca] = useState<MotivoRicerca | null>(null);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);

  /**
   * Il riepilogo si guarda, non si tocca: due secondi e via.
   *
   * Dal dettaglio si torna ai conti; dalla schermata di apertura non si va da
   * nessuna parte — il banco successivo è già pronto e la griglia riappare.
   */
  useEffect(() => {
    if (!riepilogo) return;
    const t = setTimeout(() => {
      if (eHome) setRiepilogo(null);
      else router.push('/');
    }, DURATA_RIEPILOGO_MS);
    return () => clearTimeout(t);
  }, [riepilogo, router, eHome]);

  if (!caricata) {
    return <div className="h-dvh" aria-busy="true" />;
  }

  // Prima del controllo sulla bozza: confermare la cancella, e senza questo
  // il riepilogo verrebbe sostituito da "questo conto non c'è più".
  if (riepilogo) {
    return <RiepilogoChiusura {...riepilogo} />;
  }

  if (!bozza) {
    // Alla home la bozza sparisce solo per essere subito rifatta (il banco
    // successivo): dire "questo conto non c'è più" sarebbe un errore inventato.
    if (eHome) return <div className="h-dvh" aria-busy="true" />;

    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-medium">Questo conto non c&apos;è più.</p>
        <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
          Può essere stato confermato o annullato.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 h-14 w-full rounded-xl bg-[var(--color-accento)] font-semibold text-[var(--color-sfondo)]"
        >
          Torna al banco
        </button>
      </main>
    );
  }

  const cliente = bozza.clienteId
    ? (clienti ?? []).find((c) => c.id === bozza.clienteId)
    : undefined;
  const totale = totaleBozza(bozza);
  const vuota = eVuota(bozza);
  const altriConti = contiInAttesa(bozze, bozza.id);

  const debitoPrecedenteCent = cliente?.saldo_cent ?? 0;

  /**
   * Chiude un conto.
   *
   * **La bozza arriva come parametro, non dalla chiusura.** Sembra pedanteria
   * e invece è il bug del 12 agosto: quando si assegna un cliente e si chiude
   * subito dopo, `bozza` qui dentro è ancora la copia di *prima*
   * dell'assegnazione — quella senza cliente. Il conto finiva registrato a
   * nessuno, e il debito non compariva da nessuna parte. Chi chiude deve
   * passare la bozza che ha in mano adesso.
   */
  async function chiudi(
    daChiudere: Bozza,
    modo: Parameters<typeof conferma>[1],
    esito: Riepilogo,
  ) {
    if (eVuota(daChiudere) || inCorso) return;
    setInCorso(true);
    await conferma(daChiudere, modo);
    setPagamentoAperto(false);
    setInCorso(false);
    // Non si torna subito indietro: prima il barista vede com'è finita.
    setRiepilogo(esito);
  }

  /** A CREDITO chiude in un tap, senza conferma: è reversibile con uno storno. */
  function aCredito(daChiudere: Bozza, debitoCent: number) {
    // Rete di sicurezza: se per qualunque strada si arrivasse qui senza
    // intestatario, si chiede chi è invece di far sparire dei soldi.
    if (!puoAndareACredito(daChiudere)) {
      if (!eVuota(daChiudere)) setRicerca('a_credito');
      return;
    }

    void chiudi(
      daChiudere,
      { tipo: 'a_credito' },
      {
        etichetta: daChiudere.etichetta,
        nuovoSaldoCent: debitoCent + totaleBozza(daChiudere),
        restoCent: 0,
        haCliente: daChiudere.clienteId !== null,
      },
    );
  }

  /** Quanto deve già il cliente di una bozza, letto dalla cache dei saldi. */
  function debitoDi(b: Bozza): number {
    if (!b.clienteId) return 0;
    return (clienti ?? []).find((c) => c.id === b.clienteId)?.saldo_cent ?? 0;
  }

  /**
   * La risposta a "a chi?". Cosa se ne fa dipende da perché l'avevamo chiesto.
   */
  async function rispondiRicerca(clienteId: string | null, etichetta: string) {
    const motivo = ricerca;
    setRicerca(null);
    if (!bozza) return;

    // Un conto nuovo, a parte: quello che si sta battendo resta dov'è.
    if (motivo === 'nuovo') {
      router.push(`/conto/${await apri(clienteId, etichetta)}`);
      return;
    }

    const dopo = await assegna(bozza, clienteId, etichetta);

    // Chiesto per chiudere a credito: si chiude, e basta. Anche se le voci
    // sono confluite in un conto che quella persona aveva già aperto — è
    // comunque il suo conto, e quello che ha chiesto il barista è "segnalo
    // a lui". Mandarlo su un'altra schermata a ripetere il gesto sarebbe
    // un dispetto.
    if (motivo === 'a_credito') {
      aCredito(dopo, debitoDi(dopo));
      return;
    }

    // Negli altri casi, se le voci sono confluite altrove ci si sposta sul
    // conto vero. Un pannello d'incasso aperto si chiude: parlava di un
    // altro conto, e la cifra da chiedere adesso è un'altra.
    if (dopo.id !== bozza.id) {
      setPagamentoAperto(false);
      router.push(`/conto/${dopo.id}`);
    }
    // Stesso conto: si resta dove si è. Il nome cambia in cima e, se il
    // pannello d'incasso è aperto, anche dentro — con il debito precedente
    // che entra nel conteggio.
  }

  async function annullaConto() {
    if (!bozza) return;
    // Nessuna conferma se non c'è niente da perdere: le conferme inutili
    // costano un tap a ogni conto sbagliato per errore (04-UX-MOBILE.md §1).
    if (!vuota && !window.confirm('Annullare il conto? Le voci battute andranno perse.')) {
      return;
    }
    await annulla(bozza.id);
    // Alla home non si va da nessuna parte: il banco successivo lo rifà
    // `useBanco`, e la griglia resta dov'era.
    if (!eHome) router.push('/');
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0">
        {eHome ? (
          <StrisciaConti
            corrente={bozza.etichetta}
            altri={altriConti.map((b) => ({
              id: b.id,
              etichetta: b.etichetta,
              totaleCent: totaleBozza(b),
            }))}
            onCambiaCliente={() => setRicerca('assegna')}
            onNuovoConto={() => setRicerca('nuovo')}
            onSvuota={vuota ? null : () => void annullaConto()}
          />
        ) : (
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Torna al banco"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[var(--color-testo-tenue)]"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold">{bozza.etichetta}</h1>
                <IndicatoreSync />
              </div>
              {/* Il contesto che serve a decidere: quanto deve già */}
              {cliente && statoSaldo(cliente.saldo_cent) !== 'in_pari' && (
                <p className="text-xs text-[var(--color-debito)]">
                  {statoSaldo(cliente.saldo_cent) === 'deve' ? 'deve già ' : ''}
                  {descriviSaldo(cliente.saldo_cent)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void annullaConto()}
              className="h-11 shrink-0 rounded-lg border border-[var(--color-bordo)] px-3 text-sm text-[var(--color-testo-tenue)]"
            >
              Annulla
            </button>
          </div>
        )}
      </header>

      <section className="max-h-[26dvh] min-h-[72px] shrink-0 overflow-y-auto border-y border-[var(--color-bordo)]">
        <RigheConto
          voci={bozza.voci}
          onAumenta={(v) =>
            aggiungiProdotto({
              idRiga: nuovoId(),
              prodottoId: v.prodottoId,
              descrizione: v.descrizione,
              prezzoUnitarioCent: v.prezzoUnitarioCent,
            })
          }
          onDiminuisci={(v) => diminuisciVoce(v.id)}
        />
      </section>

      <div className="min-h-0 flex-1 overflow-hidden">
        <GrigliaProdotti
          onAggiungi={(scelta) => {
            aggiungiProdotto({
              idRiga: nuovoId(),
              prodottoId: scelta.prodottoId,
              descrizione: scelta.nome,
              prezzoUnitarioCent: scelta.prezzoCent,
            });
            if (navigator.vibrate) navigator.vibrate(8);
          }}
        />
      </div>

      {/* Barra del totale e azioni: fissa in basso, sempre visibile */}
      <footer className="shrink-0 border-t border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-testo-tenue)]">Totale conto</span>
          <span className="text-2xl font-bold tabular-nums">{formatEuro(totale)}</span>
        </div>

        <div className="mt-2 flex gap-3 pb-3">
          <button
            type="button"
            disabled={vuota || inCorso}
            onClick={() => setPagamentoAperto(true)}
            className="h-16 flex-1 rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-40"
          >
            INCASSA
          </button>

          {/* Senza cliente il tasto non sparisce: chiede a chi, che è la
              domanda giusta nell'unico momento in cui serve davvero. */}
          <button
            type="button"
            disabled={vuota || inCorso}
            onClick={() =>
              bozza.clienteId ? aCredito(bozza, debitoPrecedenteCent) : setRicerca('a_credito')
            }
            className="h-16 flex-1 rounded-xl border-2 border-[var(--color-debito)] text-lg font-semibold text-[var(--color-debito)] active:bg-[var(--color-debito)]/10 disabled:opacity-40"
          >
            A CREDITO
          </button>
        </div>
      </footer>

      {eHome && <BarraNavigazione />}

      {ricerca && (
        <RicercaCliente
          titolo={DOMANDA[ricerca]}
          // Un conto a credito senza intestatario sono soldi che spariscono.
          mostraBanco={ricerca !== 'a_credito'}
          onScegli={(clienteId, etichetta) => void rispondiRicerca(clienteId, etichetta)}
          onChiudi={() => setRicerca(null)}
        />
      )}

      {pagamentoAperto && (
        <PannelloPagamento
          nomeCliente={bozza.etichetta}
          totaleContoCent={totale}
          debitoPrecedenteCent={debitoPrecedenteCent}
          haCliente={bozza.clienteId !== null}
          inCorso={inCorso}
          onChiudi={() => setPagamentoAperto(false)}
          onCambiaCliente={() => setRicerca('incasso')}
          onConferma={(d) =>
            void chiudi(
              bozza,
              {
                tipo: 'incassato',
                importoCent: d.importoCent,
                metodo: d.metodo,
                scontrinoBattuto: d.scontrinoBattuto,
              },
              {
                etichetta: bozza.etichetta,
                nuovoSaldoCent: d.nuovoSaldoCent,
                restoCent: d.restoCent,
                haCliente: bozza.clienteId !== null,
              },
            )
          }
        />
      )}
    </div>
  );
}

/**
 * La striscia in cima alla schermata di apertura.
 *
 * Ha preso il posto dell'elenco dei conti aperti, che occupava mezza home per
 * una cosa che di solito è vuota. Qui i conti in attesa sono etichette in
 * fila: si leggono di sfuggita, si aprono con un tocco, e non rubano spazio
 * alla griglia.
 *
 * La prima etichetta è il conto che si sta battendo, e si tocca per dargli un
 * nome. Il `+` apre invece un conto a parte, senza toccare quello in corso.
 */
function StrisciaConti({
  corrente,
  altri,
  onCambiaCliente,
  onNuovoConto,
  onSvuota,
}: {
  corrente: string;
  altri: Array<{ id: string; etichetta: string; totaleCent: number }>;
  onCambiaCliente: () => void;
  onNuovoConto: () => void;
  /** `null` quando non c'è niente da buttare via: il tasto non compare. */
  onSvuota: (() => void) | null;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onCambiaCliente}
        aria-label={`Conto in corso: ${corrente}. Tocca per intestarlo a un cliente`}
        className="flex h-11 min-w-0 shrink items-center gap-1.5 rounded-lg bg-[var(--color-superficie)] px-3"
      >
        <span className="truncate text-base font-bold">{corrente}</span>
        <span aria-hidden className="text-xs text-[var(--color-testo-tenue)]">
          ▾
        </span>
      </button>

      <IndicatoreSync />

      {onSvuota && (
        <button
          type="button"
          onClick={onSvuota}
          aria-label="Svuota il conto in corso"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-bordo)] text-lg text-[var(--color-testo-tenue)]"
        >
          ✕
        </button>
      )}

      {altri.length > 0 && (
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {altri.map((b) => (
            <Link
              key={b.id}
              href={`/conto/${b.id}`}
              className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--color-bordo)] px-3 text-sm active:bg-[var(--color-superficie)]"
            >
              <span className="max-w-28 truncate">{b.etichetta}</span>
              <span className="tabular-nums text-[var(--color-testo-tenue)]">
                {formatEuro(b.totaleCent)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onNuovoConto}
        aria-label="Apri un altro conto"
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accento)] text-2xl font-light text-[var(--color-sfondo)]"
      >
        +
      </button>
    </div>
  );
}

/**
 * Che cosa è successo, per due secondi.
 *
 * Serve al barista, non al cliente: dopo aver incassato deve sapere se deve
 * dare un resto e quanto resta a debito, senza andarselo a cercare in un'altra
 * schermata mentre c'è fila.
 */
function RiepilogoChiusura({ nuovoSaldoCent, restoCent, haCliente, etichetta }: Riepilogo) {
  const stato = statoSaldo(nuovoSaldoCent);

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-[var(--color-sfondo)] px-8 text-center"
    >
      <p className="text-5xl" aria-hidden>
        ✓
      </p>

      {restoCent > 0 && (
        <>
          <p className="mt-2 text-sm text-[var(--color-testo-tenue)]">Resto da dare</p>
          <p className="text-4xl font-bold tabular-nums text-[var(--color-attenzione)]">
            {formatEuro(restoCent)}
          </p>
        </>
      )}

      {haCliente ? (
        <>
          <p className="mt-3 text-sm text-[var(--color-testo-tenue)]">
            {stato === 'deve' ? `${etichetta} ora deve` : etichetta}
          </p>
          <p
            className={`text-3xl font-bold tabular-nums ${
              stato === 'deve' ? 'text-[var(--color-debito)]' : ''
            }`}
          >
            {stato === 'deve' ? formatEuro(nuovoSaldoCent) : descriviSaldo(nuovoSaldoCent)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-lg text-[var(--color-testo-tenue)]">Conto chiuso</p>
      )}
    </div>
  );
}
