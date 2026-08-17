'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  centesimiInCampo,
  cifreInCentesimi,
  formatEuro,
  mascheraImporto,
} from '@/lib/dominio/denaro';
import {
  avvisoCambioPrezzo,
  LIMITE_PREFERITI,
  nomeCompleto,
  raggruppaListino,
  spostaNelListino,
  troppiPreferiti,
  validaPrezzo,
  type MossaListino,
} from '@/lib/dominio/listino';
import {
  useCategorie,
  useListino,
  useModificaProdotto,
  useRiordinaListino,
  type VoceListino,
} from '@/lib/hooks/use-listino';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';
import { ModuloNuovaVoce } from './modulo-nuova-voce';

/**
 * La gestione del listino (T-16, 04-UX-MOBILE.md §9).
 *
 * "Si usa raramente, quindi non deve essere veloce — deve essere chiara."
 * È l'unica schermata dell'app che non insegue i tre tap: qui si sta fermi,
 * si legge, si cambia un prezzo e si controlla di averlo cambiato bene.
 *
 * Un prodotto non si elimina mai: si disattiva. Sparisce dalla griglia e
 * resta leggibile in tutto lo storico, dove i suoi prezzi sono congelati
 * sulle righe già battute (DEC-05).
 */

export function GestioneListino() {
  const { data: prodotti, isPending, fetchStatus, error, refetch } = useListino();
  const { data: categorie } = useCategorie();

  const riordina = useRiordinaListino();

  const [mostraInattivi, setMostraInattivi] = useState(false);
  const [creazione, setCreazione] = useState<{ nomeBase?: string } | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  /**
   * Il riordino è una modalità, non un pulsante su ogni riga.
   *
   * Si riordina una volta ogni tanto — quando cambia la stagione, quando
   * entra un prodotto nuovo — e per il resto dell'anno quei comandi
   * sarebbero solo altre due frecce accanto a ogni prezzo, da saltare con
   * l'occhio ogni volta che si viene qui per fare altro.
   */
  const [riordino, setRiordino] = useState(false);

  const inPausa = fetchStatus === 'paused' && prodotti === undefined;

  const visibili = useMemo(
    () => (prodotti ?? []).filter((p) => mostraInattivi || p.attivo),
    [prodotti, mostraInattivi],
  );

  const gruppi = useMemo(() => raggruppaListino(visibili, categorie ?? []), [visibili, categorie]);

  const nPreferiti = useMemo(
    () => (prodotti ?? []).filter((p) => p.preferito && p.attivo).length,
    [prodotti],
  );

  const nInattivi = useMemo(() => (prodotti ?? []).filter((p) => !p.attivo).length, [prodotti]);

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
          <h1 className="text-xl font-bold">Listino</h1>
          <IndicatoreSync />

          <button
            type="button"
            onClick={() => {
              // Uscendo dal riordino si torna a vedere tutto com'era; entrando
              // si nascondono i disattivati, perché rinumerare un elenco che
              // comprende prodotti che nella griglia non ci sono sposterebbe
              // cose che l'utente non sta guardando.
              setMostraInattivi(false);
              setRiordino((r) => !r);
            }}
            aria-pressed={riordino}
            className={`ml-auto h-11 shrink-0 rounded-lg px-3 text-sm font-medium ${
              riordino
                ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
            }`}
          >
            {riordino ? 'Fatto' : '↕ Riordina'}
          </button>
        </header>

        {riordino && (
          <p className="mx-5 mb-3 rounded-xl bg-[var(--color-superficie)] px-4 py-3 text-sm text-[var(--color-testo-tenue)]">
            Sposta i prodotti: quelli in alto sono i primi che vedi nella griglia. Le varianti si
            spostano insieme al loro prodotto. I preferiti restano comunque in cima a tutto.
          </p>
        )}

        {troppiPreferiti(nPreferiti) && (
          <p className="mx-5 mb-3 rounded-xl border border-[var(--color-attenzione)]/40 bg-[var(--color-attenzione)]/10 px-4 py-3 text-sm text-[var(--color-attenzione)]">
            {nPreferiti} preferiti: in cima alla griglia ne stanno {LIMITE_PREFERITI} senza
            scorrere. Oltre, smettono di essere scorciatoie.
          </p>
        )}

        {avviso && (
          <p
            role="status"
            className="mx-5 mb-3 rounded-xl border border-[var(--color-positivo)]/30 bg-[var(--color-positivo)]/10 px-4 py-3 text-sm text-[var(--color-positivo)]"
          >
            {avviso}
          </p>
        )}

        {error || inPausa ? (
          <AvvisoLettura
            errore={error}
            cosa="Il listino"
            rassicurazione="Si modifica solo online, ed è voluto: i prezzi non si cambiano mentre c'è fila."
            onRiprova={() => void refetch()}
          />
        ) : isPending ? (
          <div className="space-y-2 px-5" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--color-superficie)]" />
            ))}
          </div>
        ) : (
          <>
            {gruppi.map((g) => (
              <section key={g.categoriaId ?? 'senza'}>
                <div className="flex items-baseline justify-between bg-[var(--color-sfondo)] px-5 py-1.5">
                  <h2 className="text-xs font-semibold uppercase text-[var(--color-testo-tenue)]">
                    {g.categoria}
                  </h2>
                  {!riordino && (
                    <button
                      type="button"
                      onClick={() => setCreazione({})}
                      className="text-xs text-[var(--color-accento)]"
                    >
                      + prodotto
                    </button>
                  )}
                </div>

                <ul className="divide-y divide-[var(--color-bordo)] border-y border-[var(--color-bordo)]">
                  {g.prodotti.map((p, i) => (
                    <RigaListino
                      key={p.id}
                      voce={p}
                      riordino={riordino}
                      // I comandi stanno sulla prima riga del gruppo: la
                      // seconda variante di un caffè non ha un posto suo da
                      // cambiare, si muove insieme alla prima.
                      primoDelGruppo={i === 0 || g.prodotti[i - 1]!.nome_base !== p.nome_base}
                      inCima={g.prodotti[0]!.nome_base === p.nome_base}
                      inFondo={g.prodotti[g.prodotti.length - 1]!.nome_base === p.nome_base}
                      onSposta={(mossa) => {
                        const cambiati = spostaNelListino(g.prodotti, p.nome_base, mossa);
                        if (cambiati.length > 0) riordina.mutate(cambiati);
                      }}
                      onAvviso={setAvviso}
                      onNuovaVariante={() => setCreazione({ nomeBase: p.nome_base })}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {nInattivi > 0 && !riordino && (
              <div className="px-5 py-5">
                <button
                  type="button"
                  onClick={() => setMostraInattivi((m) => !m)}
                  className="h-14 w-full rounded-xl border border-[var(--color-bordo)] text-sm text-[var(--color-testo-tenue)]"
                >
                  {mostraInattivi
                    ? 'Nascondi i disattivati'
                    : `Mostra ${nInattivi} ${nInattivi === 1 ? 'prodotto disattivato' : 'prodotti disattivati'}`}
                </button>
              </div>
            )}
          </>
        )}

        <div className="h-6" />
      </main>

      <BarraNavigazione />

      {creazione && (
        <ModuloNuovaVoce
          nomeBaseIniziale={creazione.nomeBase}
          esistenti={prodotti ?? []}
          categorie={categorie ?? []}
          onChiudi={() => setCreazione(null)}
          onCreata={(nome) => {
            setCreazione(null);
            setAvviso(`${nome} è a listino.`);
          }}
        />
      )}
    </div>
  );
}

function RigaListino({
  voce,
  riordino,
  primoDelGruppo,
  inCima,
  inFondo,
  onSposta,
  onAvviso,
  onNuovaVariante,
}: {
  voce: VoceListino;
  riordino: boolean;
  primoDelGruppo: boolean;
  inCima: boolean;
  inFondo: boolean;
  onSposta: (mossa: MossaListino) => void;
  onAvviso: (messaggio: string) => void;
  onNuovaVariante: () => void;
}) {
  const modifica = useModificaProdotto();
  const [testo, setTesto] = useState(() => centesimiInCampo(voce.prezzo_cent));
  const [inModifica, setInModifica] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salvaPrezzo() {
    setErrore(null);
    // Stessa regola del tastierino: le cifre valgono centesimi, "125" è 1,25 €.
    const nuovo = testo === '' ? null : cifreInCentesimi(testo);
    const controllo = validaPrezzo(nuovo);

    if (!controllo.valido) {
      setErrore(controllo.errore);
      return;
    }
    if (controllo.prezzoCent === voce.prezzo_cent) {
      setInModifica(false);
      return;
    }

    const vecchio = voce.prezzo_cent;
    try {
      await modifica.mutateAsync({ id: voce.id, campi: { prezzo_cent: controllo.prezzoCent } });
      setInModifica(false);
      // Rassicurazione, non conferma: chi alza un prezzo teme di star
      // cambiando anche i conti già battuti (DEC-05).
      onAvviso(avvisoCambioPrezzo(vecchio, controllo.prezzoCent));
    } catch (e) {
      setTesto(centesimiInCampo(vecchio));
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a salvare.');
    }
  }

  if (riordino) {
    const nome = nomeCompleto(voce.nome_base, voce.variante);

    return (
      <li className="flex min-h-16 items-center gap-2 px-5 py-2">
        <span className="min-w-0 flex-1 truncate">{nome}</span>

        {/* Le varianti seguono il loro prodotto: qui non c'è niente da
            spostare, e mostrare frecce spente confonderebbe soltanto. */}
        {primoDelGruppo && (
          <>
            <Freccia
              etichetta={`Porta ${voce.nome_base} in cima`}
              disabilitato={inCima}
              onClick={() => onSposta('cima')}
            >
              ⇈
            </Freccia>
            <Freccia
              etichetta={`Sposta ${voce.nome_base} in su`}
              disabilitato={inCima}
              onClick={() => onSposta('su')}
            >
              ↑
            </Freccia>
            <Freccia
              etichetta={`Sposta ${voce.nome_base} in giù`}
              disabilitato={inFondo}
              onClick={() => onSposta('giu')}
            >
              ↓
            </Freccia>
          </>
        )}
      </li>
    );
  }

  return (
    <li className={`px-5 py-3 ${voce.attivo ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {nomeCompleto(voce.nome_base, voce.variante)}
          </span>
          {!voce.attivo && (
            <span className="block text-xs text-[var(--color-testo-tenue)]">
              disattivato — resta nello storico
            </span>
          )}
        </span>

        {inModifica ? (
          <input
            value={testo}
            onChange={(e) => setTesto(mascheraImporto(e.target.value))}
            onBlur={() => void salvaPrezzo()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void salvaPrezzo();
              if (e.key === 'Escape') {
                setTesto(centesimiInCampo(voce.prezzo_cent));
                setInModifica(false);
              }
            }}
            inputMode="numeric"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Prezzo di ${nomeCompleto(voce.nome_base, voce.variante)}`}
            className="h-14 w-28 shrink-0 rounded-xl border border-[var(--color-accento)] bg-[var(--color-sfondo)] px-3 text-right text-lg font-semibold tabular-nums outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setInModifica(true)}
            aria-label={`Cambia il prezzo di ${nomeCompleto(voce.nome_base, voce.variante)}`}
            className="h-14 w-28 shrink-0 rounded-xl border border-[var(--color-bordo)] px-3 text-right text-lg font-semibold tabular-nums"
          >
            {formatEuro(voce.prezzo_cent)}
          </button>
        )}
      </div>

      {errore && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-debito)]">
          {errore}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => modifica.mutate({ id: voce.id, campi: { preferito: !voce.preferito } })}
          aria-pressed={voce.preferito}
          className={`h-11 rounded-lg px-3 text-xs font-medium ${
            voce.preferito
              ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
              : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
          }`}
        >
          {voce.preferito ? '★ preferito' : '☆ preferito'}
        </button>

        <button
          type="button"
          onClick={onNuovaVariante}
          className="h-11 rounded-lg border border-[var(--color-bordo)] px-3 text-xs text-[var(--color-testo-tenue)]"
        >
          + variante
        </button>

        <button
          type="button"
          onClick={() => modifica.mutate({ id: voce.id, campi: { attivo: !voce.attivo } })}
          className="h-11 rounded-lg border border-[var(--color-bordo)] px-3 text-xs text-[var(--color-testo-tenue)]"
        >
          {voce.attivo ? 'Disattiva' : 'Riattiva'}
        </button>
      </div>
    </li>
  );
}

/** Un comando di spostamento. 56 px: qui le mani sono asciutte, ma il dito è lo stesso. */
function Freccia({
  etichetta,
  disabilitato,
  onClick,
  children,
}: {
  etichetta: string;
  disabilitato: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabilitato}
      aria-label={etichetta}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-bordo)] text-xl text-[var(--color-testo)] active:bg-[var(--color-superficie)] disabled:opacity-25"
    >
      {children}
    </button>
  );
}
