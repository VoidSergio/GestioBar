'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatEuro } from '@/lib/dominio/denaro';
import { componiCsv, dataCsv, importoCsv, nomeFile } from '@/lib/dominio/csv';
import { nomeCompleto } from '@/lib/dominio/listino';
import {
  classifica,
  clientiSpariti,
  descriviPunta,
  grigliaOraria,
  GIORNI_SETTIMANA,
  intervallo,
  PERIODI,
  prodottiFermi,
  raggruppaVenduto,
  sommaGiornate,
  spiegaVariazioneCredito,
  type ChiaveClassifica,
  type Periodo,
} from '@/lib/dominio/report';
import { etichettaCliente } from '@/lib/dominio/clienti';
import {
  useClassifica,
  useGiornate,
  useOreDiPunta,
  useVendutoProdotto,
} from '@/lib/hooks/use-report';
import { useListino } from '@/lib/hooks/use-listino';
import { IndicatoreSync } from '@/components/shell/indicatore-sync';
import { BarraNavigazione } from '@/components/shell/barra-navigazione';
import { AvvisoLettura } from '@/components/shell/avviso-lettura';

/**
 * I report (T-23, T-24, T-25, T-26).
 *
 * NON È UNA SCHERMATA DA BANCO. Si apre la sera, da fermi, con le mani
 * asciutte: qui si può scorrere, si può leggere, e non c'è nessun vincolo
 * di tap da rispettare. È l'opposto di tutto il resto dell'app, ed è voluto.
 *
 * Non scrive niente. Se un numero è sbagliato si riscrive una vista e si
 * rilegge: nessun dato è in gioco.
 *
 * RICHIEDE LA RETE, e lo dice. Sono aggregati su mesi di movimenti: tenerli
 * in cache offline vorrebbe dire portarsi dietro tutto lo storico sul
 * telefono per una schermata che si guarda da fermi. Le eccezioni offline
 * sono elencate in `03-ARCHITETTURA.md` §4.5.
 */
export function SchermataReport() {
  const [periodo, setPeriodo] = useState<Periodo>('oggi');
  const [quandoClassifica, setQuandoClassifica] = useState<ChiaveClassifica>('consumato_mese_cent');

  const finestra = useMemo(() => intervallo(periodo), [periodo]);

  const giornate = useGiornate(finestra.da, finestra.a);
  const venduto = useVendutoProdotto(finestra.da, finestra.a);
  const clienti = useClassifica();
  const ore = useOreDiPunta();
  const { data: listino } = useListino();

  const totali = useMemo(() => sommaGiornate(giornate.data ?? []), [giornate.data]);
  const prodotti = useMemo(() => raggruppaVenduto(venduto.data ?? []), [venduto.data]);

  const fermi = useMemo(() => {
    if (!listino) return [];
    const aCatalogo = listino
      .filter((p) => p.attivo)
      .map((p) => nomeCompleto(p.nome_base, p.variante));
    return prodottiFermi(aCatalogo, prodotti);
  }, [listino, prodotti]);

  const inClassifica = useMemo(
    () => classifica(clienti.data ?? [], quandoClassifica),
    [clienti.data, quandoClassifica],
  );
  const spariti = useMemo(() => clientiSpariti(clienti.data ?? []), [clienti.data]);
  const griglia = useMemo(() => grigliaOraria(ore.data ?? []), [ore.data]);

  function esporta(cosa: 'giornate' | 'prodotti') {
    const contenuto =
      cosa === 'giornate'
        ? componiCsv(
            [
              'Giorno',
              'Venduto',
              'Incassato',
              'Contanti',
              'Carta',
              'Altro',
              'Credito concesso',
              'Credito rientrato',
              'Pezzi',
              'Conti',
            ],
            (giornate.data ?? []).map((g) => [
              dataCsv(g.giornata),
              importoCsv(g.venduto_cent),
              importoCsv(g.incassato_cent),
              importoCsv(g.contanti_cent),
              importoCsv(g.carta_cent),
              importoCsv(g.altro_cent),
              importoCsv(g.credito_concesso_cent),
              importoCsv(g.credito_rientrato_cent),
              String(g.pezzi),
              String(g.n_conti),
            ]),
          )
        : componiCsv(
            ['Prodotto', 'Quantità', 'Incasso'],
            prodotti.map((p) => [p.descrizione, String(p.quantita), importoCsv(p.importoCent)]),
          );

    scarica(nomeFile(cosa, finestra.da, finestra.a), contenuto);
  }

  const inErrore = giornate.error ?? venduto.error ?? clienti.error;

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
          <h1 className="text-xl font-bold">Report</h1>
          <IndicatoreSync />
        </header>

        {/* Il periodo governa tutto quello che sta sotto tranne la
            classifica e le ore, che hanno finestre loro e lo dicono. */}
        <div className="flex gap-2 px-5 pb-4">
          {PERIODI.map((p) => (
            <button
              key={p.valore}
              type="button"
              onClick={() => setPeriodo(p.valore)}
              aria-pressed={periodo === p.valore}
              className={`h-12 flex-1 rounded-xl text-sm font-medium ${
                periodo === p.valore
                  ? 'bg-[var(--color-accento)] text-[var(--color-sfondo)]'
                  : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
              }`}
            >
              {p.etichetta}
            </button>
          ))}
        </div>

        {inErrore ? (
          <AvvisoLettura
            errore={inErrore}
            cosa="I report"
            rassicurazione="Si leggono solo online, ed è voluto: sono somme su mesi di movimenti, e tenerle sul telefono vorrebbe dire portarsi dietro tutto lo storico."
            onRiprova={() => {
              void giornate.refetch();
              void venduto.refetch();
              void clienti.refetch();
            }}
          />
        ) : (
          <>
            {/* ---------------------------------------------- i soldi */}
            <Sezione titolo={finestra.etichetta}>
              <div className="rounded-2xl bg-[var(--color-superficie)] p-5">
                <p className="text-sm text-[var(--color-testo-tenue)]">Venduto</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">
                  {formatEuro(totali.vendutoCent)}
                </p>
                <p className="mt-1 text-sm text-[var(--color-testo-tenue)]">
                  {totali.pezzi} {totali.pezzi === 1 ? 'pezzo' : 'pezzi'} su {totali.nConti}{' '}
                  {totali.nConti === 1 ? 'conto' : 'conti'}
                </p>
              </div>

              <dl className="mt-3 space-y-2 rounded-2xl bg-[var(--color-superficie)] px-5 py-4">
                <Voce etichetta="Incassato" valore={totali.incassatoCent} forte />
                <Voce etichetta="di cui contanti" valore={totali.contantiCent} tenue />
                <Voce etichetta="di cui carta" valore={totali.cartaCent} tenue />
                {totali.altroCent !== 0 && (
                  <Voce etichetta="di cui altro" valore={totali.altroCent} tenue />
                )}
              </dl>

              {/* La riga che evita la telefonata delle undici di sera. */}
              <div className="mt-3 rounded-2xl bg-[var(--color-superficie)] px-5 py-4">
                <dl className="space-y-2">
                  <Voce
                    etichetta="Credito concesso"
                    valore={totali.creditoConcessoCent}
                    colore="var(--color-debito)"
                  />
                  <Voce
                    etichetta="Credito rientrato"
                    valore={totali.creditoRientratoCent}
                    colore="var(--color-positivo)"
                  />
                </dl>
                <p className="mt-3 border-t border-[var(--color-bordo)] pt-3 text-sm text-[var(--color-testo-tenue)]">
                  Venduto e incassato non coincidono di{' '}
                  <strong className="tabular-nums text-[var(--color-testo)]">
                    {formatEuro(Math.abs(totali.variazioneCreditoCent))}
                  </strong>
                  : non manca niente, {spiegaVariazioneCredito(totali.variazioneCreditoCent)}.
                </p>
              </div>

              {totali.nSenzaScontrino > 0 && (
                <p className="mt-3 rounded-2xl border border-[var(--color-attenzione)]/40 bg-[var(--color-attenzione)]/10 px-5 py-3 text-sm text-[var(--color-attenzione)]">
                  {totali.nSenzaScontrino}{' '}
                  {totali.nSenzaScontrino === 1 ? 'incasso' : 'incassi'} senza scontrino, su{' '}
                  {totali.nScontrini + totali.nSenzaScontrino}.{' '}
                  <Link href="/scontrini" className="underline">
                    Guarda quali
                  </Link>
                </p>
              )}

              {giornate.isPending && <Caricamento />}
            </Sezione>

            {/* ------------------------------------------ che cosa esce */}
            <Sezione titolo="Che cosa esce">
              {prodotti.length === 0 ? (
                <Vuoto testo="Nel periodo scelto non è uscito niente." />
              ) : (
                <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
                  {prodotti.slice(0, 15).map((p) => (
                    <li key={p.descrizione} className="flex items-baseline gap-3 px-5 py-3">
                      <span className="w-12 shrink-0 text-xl font-bold tabular-nums">
                        {p.quantita}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.descrizione}</span>
                      <span className="shrink-0 tabular-nums text-[var(--color-testo-tenue)]">
                        {formatEuro(p.importoCent)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {fermi.length > 0 && (
                <details className="mt-3 rounded-2xl bg-[var(--color-superficie)] px-5 py-3">
                  <summary className="cursor-pointer text-sm text-[var(--color-testo-tenue)]">
                    {fermi.length} a catalogo non {fermi.length === 1 ? 'è uscito' : 'sono usciti'}
                  </summary>
                  <p className="pt-2 text-sm">{fermi.join(' · ')}</p>
                  <p className="pt-2 text-xs text-[var(--color-testo-tenue)]">
                    Ognuno occupa un riquadro nella griglia e allunga la ricerca a tutti. Si
                    disattivano dal listino: restano nello storico.
                  </p>
                </details>
              )}
            </Sezione>

            {/* -------------------------------------------- i clienti */}
            <Sezione titolo="Chi consuma">
              <div className="mb-3 flex gap-2">
                {(
                  [
                    ['consumato_mese_cent', 'Questo mese'],
                    ['consumato_sempre_cent', 'Sempre'],
                  ] as const
                ).map(([chiave, testo]) => (
                  <button
                    key={chiave}
                    type="button"
                    onClick={() => setQuandoClassifica(chiave)}
                    aria-pressed={quandoClassifica === chiave}
                    className={`h-11 flex-1 rounded-lg text-sm ${
                      quandoClassifica === chiave
                        ? 'bg-[var(--color-superficie-alta)] font-semibold'
                        : 'border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]'
                    }`}
                  >
                    {testo}
                  </button>
                ))}
              </div>

              {inClassifica.length === 0 ? (
                <Vuoto testo="Nessun cliente ha consumato in questo periodo." />
              ) : (
                <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
                  {inClassifica.map((c, i) => (
                    <li key={c.cliente_id}>
                      <Link
                        href={`/clienti/${c.cliente_id}`}
                        className="flex items-baseline gap-3 px-5 py-3 active:bg-[var(--color-superficie-alta)]"
                      >
                        <span className="w-6 shrink-0 tabular-nums text-[var(--color-testo-tenue)]">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{etichettaCliente(c)}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatEuro(c[quandoClassifica])}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Senza questa riga il totale sembra sbagliato, e lo si va a
                  cercare per mezz'ora. */}
              <p className="mt-3 px-1 text-xs text-[var(--color-testo-tenue)]">
                Qui ci sono solo i conti intestati. Quello battuto al banco non ha un nome e resta
                fuori: la classifica dice chi fra i clienti che conosci consuma di più, non da dove
                vengono i tuoi soldi.
              </p>
            </Sezione>

            {spariti.length > 0 && (
              <Sezione titolo="Chi non si vede da un po'">
                <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-2xl bg-[var(--color-superficie)]">
                  {spariti.slice(0, 10).map((s) => (
                    <li key={s.cliente.cliente_id}>
                      <Link
                        href={`/clienti/${s.cliente.cliente_id}`}
                        className="flex items-baseline gap-3 px-5 py-3 active:bg-[var(--color-superficie-alta)]"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {etichettaCliente(s.cliente)}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-[var(--color-testo-tenue)]">
                          {s.giorni} giorni
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 px-1 text-xs text-[var(--color-testo-tenue)]">
                  Le classifiche mostrano chi c&apos;è, non chi manca. Chi veniva tutte le mattine e
                  non passa da tre settimane è una domanda da farsi.
                </p>
              </Sezione>
            )}

            {/* ------------------------------------------ ore di punta */}
            <Sezione titolo="A che ora si lavora">
              {griglia.celle.length === 0 ? (
                <Vuoto testo="Non ci sono ancora abbastanza movimenti." />
              ) : (
                <>
                  <GrigliaOre griglia={griglia} />
                  {descriviPunta(griglia.punta) && (
                    <p className="mt-3 px-1 text-sm text-[var(--color-testo-tenue)]">
                      Il momento più pieno degli ultimi novanta giorni è{' '}
                      <strong className="text-[var(--color-testo)]">
                        {descriviPunta(griglia.punta)}
                      </strong>
                      .
                    </p>
                  )}
                </>
              )}
            </Sezione>

            {/* ------------------------------------------ esportazione */}
            <Sezione titolo="Porta fuori i numeri">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => esporta('giornate')}
                  disabled={(giornate.data ?? []).length === 0}
                  className="h-14 flex-1 rounded-xl border border-[var(--color-bordo)] text-sm disabled:opacity-40"
                >
                  Giornate (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => esporta('prodotti')}
                  disabled={prodotti.length === 0}
                  className="h-14 flex-1 rounded-xl border border-[var(--color-bordo)] text-sm disabled:opacity-40"
                >
                  Prodotti (CSV)
                </button>
              </div>
              <p className="mt-3 px-1 text-xs text-[var(--color-testo-tenue)]">
                Si aprono in Excel con gli importi già in euro e le date leggibili. Riguardano il
                periodo scelto qui sopra.
              </p>
            </Sezione>

            <div className="h-10" />
          </>
        )}
      </main>

      <BarraNavigazione />
    </div>
  );
}

/* ------------------------------------------------------------ pezzetti */

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pb-6">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-testo-tenue)]">
        {titolo}
      </h2>
      {children}
    </section>
  );
}

function Voce({
  etichetta,
  valore,
  forte = false,
  tenue = false,
  colore,
}: {
  etichetta: string;
  valore: number;
  forte?: boolean;
  tenue?: boolean;
  colore?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={tenue ? 'text-sm text-[var(--color-testo-tenue)]' : ''}>{etichetta}</dt>
      <dd
        style={colore ? { color: colore } : undefined}
        className={`tabular-nums ${forte ? 'text-2xl font-bold' : tenue ? 'text-sm' : 'text-lg font-semibold'}`}
      >
        {formatEuro(valore)}
      </dd>
    </div>
  );
}

function Vuoto({ testo }: { testo: string }) {
  return (
    <p className="rounded-2xl bg-[var(--color-superficie)] px-5 py-6 text-center text-sm text-[var(--color-testo-tenue)]">
      {testo}
    </p>
  );
}

function Caricamento() {
  return <div className="mt-3 h-14 animate-pulse rounded-2xl bg-[var(--color-superficie)]" />;
}

/**
 * La griglia ore × giorni.
 *
 * Più pieno è il quadratino, più si è lavorato. Non ci sono numeri dentro:
 * a colpo d'occhio serve la forma — dove si addensa il colore — e il numero
 * esatto delle 8 di giovedì non cambia nessuna decisione. Chi lo vuole lo
 * legge tenendo premuto: sta nel titolo accessibile di ogni cella.
 */
function GrigliaOre({ griglia }: { griglia: ReturnType<typeof grigliaOraria> }) {
  const ore: number[] = [];
  for (let o = griglia.primaOra; o <= griglia.ultimaOra; o += 1) ore.push(o);

  const per = new Map(griglia.celle.map((c) => [`${c.giornoSettimana}-${c.ora}`, c.pezzi]));

  return (
    <div className="overflow-x-auto rounded-2xl bg-[var(--color-superficie)] p-3">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-8" />
            {ore.map((o) => (
              <th
                key={o}
                className="text-[10px] font-normal tabular-nums text-[var(--color-testo-tenue)]"
              >
                {o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GIORNI_SETTIMANA.map((nome, i) => (
            <tr key={nome}>
              <th className="text-left text-[10px] font-normal text-[var(--color-testo-tenue)]">
                {nome}
              </th>
              {ore.map((o) => {
                const pezzi = per.get(`${i + 1}-${o}`) ?? 0;
                const intensita = griglia.massimoPezzi > 0 ? pezzi / griglia.massimoPezzi : 0;
                return (
                  <td key={o} className="p-0">
                    <div
                      title={`${nome} alle ${o}: ${pezzi} ${pezzi === 1 ? 'pezzo' : 'pezzi'}`}
                      style={{
                        // Sotto il 6% resta un velo, così la cella vuota si
                        // distingue da quella con due caffè.
                        backgroundColor:
                          pezzi === 0
                            ? 'var(--color-sfondo)'
                            : `color-mix(in srgb, var(--color-accento) ${Math.max(
                                intensita * 100,
                                12,
                              )}%, var(--color-sfondo))`,
                      }}
                      className="h-6 rounded"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Scarica un file generato nel browser.
 *
 * Niente server: il CSV lo compone il telefono e lo consegna a sé stesso.
 * L'URL temporaneo va revocato, altrimenti il file resta in memoria finché
 * la scheda è aperta — e questa scheda, al banco, non si chiude mai.
 */
function scarica(nome: string, contenuto: string) {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
