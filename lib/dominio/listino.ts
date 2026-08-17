/**
 * Regole pure sul listino. Niente React, niente Supabase (CLAUDE.md).
 * I tipi vengono da lib/supabase/tipi.ts, che è solo una dichiarazione di forme.
 */
import type { RiquadroGriglia, VarianteProdotto } from '@/lib/supabase/tipi';

/**
 * Variante addebitata dal tap breve su un riquadro.
 *
 * Regola: la variante `normale` se esiste, altrimenti la meno costosa.
 *
 * Birre e vini non hanno una variante chiamata `normale` — hanno `0,33`,
 * `rosso` e simili — e lì la meno cara è anche la più venduta: la birra
 * piccola, il vino della casa. Vedi 07-LISTINO.md §4.
 */
export function variantePredefinita(riquadro: RiquadroGriglia): VarianteProdotto {
  const normale = riquadro.varianti.find((v) => v.variante === 'normale');
  if (normale) return normale;

  const prima = riquadro.varianti[0];
  if (!prima) {
    throw new Error(`Il prodotto "${riquadro.nome_base}" non ha varianti.`);
  }

  // Non ci si affida all'ordine restituito dalla vista: se un domani
  // cambia, questa funzione resta corretta.
  return riquadro.varianti.reduce(
    (piuEconomica, v) => (v.prezzo_cent < piuEconomica.prezzo_cent ? v : piuEconomica),
    prima,
  );
}

/** Nome completo da scrivere sulla riga di conto: "Cappuccino decaffeinato". */
export function nomeCompleto(nomeBase: string, variante: string): string {
  return variante === 'normale' ? nomeBase : `${nomeBase} ${variante}`;
}

/** Categorie presenti nella griglia, nell'ordine deciso nel listino. */
export function categorieDi(riquadri: readonly RiquadroGriglia[]): string[] {
  const viste = new Map<string, number>();
  for (const r of riquadri) {
    if (r.categoria && !viste.has(r.categoria)) {
      viste.set(r.categoria, r.categoria_ordine ?? 999);
    }
  }
  return [...viste.entries()].sort((a, b) => a[1] - b[1]).map(([nome]) => nome);
}

/* ------------------------------------------------ gestione del listino (T-16) */

/**
 * Quanti preferiti stanno in cima alla griglia senza far scorrere.
 * Tre colonne per tre righe: oltre, i preferiti smettono di essere tali.
 */
export const LIMITE_PREFERITI = 9;

export function troppiPreferiti(quanti: number): boolean {
  return quanti > LIMITE_PREFERITI;
}

/**
 * Il messaggio che accompagna un cambio di prezzo.
 *
 * Non è una richiesta di conferma, è una rassicurazione (04-UX-MOBILE §9):
 * chi alza il prezzo del caffè teme di star cambiando anche i conti già
 * aperti. Non è così — il prezzo si congela sulla riga (DEC-05) — e dirlo
 * una volta evita la domanda.
 */
export function avvisoCambioPrezzo(daCent: number, aCent: number): string {
  const verso = aCent > daCent ? 'alzato' : 'abbassato';
  return `Prezzo ${verso}. Vale per le prossime consumazioni: quelle già registrate restano al prezzo di quando le hai battute.`;
}

export type EsitoModificaPrezzo =
  { valido: true; prezzoCent: number } | { valido: false; errore: string };

/**
 * Un prezzo battuto a mano nel listino.
 *
 * Il tetto a 1.000 € non è una regola commerciale: è la rete contro lo zero
 * di troppo. In un bar nessuno vende niente a quella cifra, e un prezzo
 * sbagliato di dieci volte si scopre solo quando il cliente protesta.
 */
export const PREZZO_MASSIMO_CENT = 100_000;

export function validaPrezzo(prezzoCent: number | null): EsitoModificaPrezzo {
  if (prezzoCent === null) {
    return { valido: false, errore: 'Prezzo non valido. Scrivi per esempio 1,20' };
  }
  if (prezzoCent < 0) {
    return { valido: false, errore: 'Un prezzo non può essere negativo.' };
  }
  if (prezzoCent > PREZZO_MASSIMO_CENT) {
    return { valido: false, errore: 'Prezzo troppo alto: hai sbagliato uno zero?' };
  }
  return { valido: true, prezzoCent };
}

export type EsitoNuovaVoce =
  | { valido: true; dati: { nomeBase: string; variante: string; prezzoCent: number } }
  | { valido: false; errore: string };

/**
 * Valida un prodotto nuovo o una variante nuova.
 *
 * `variante` vuota diventa `normale`: è il valore predefinito della colonna e
 * il modo in cui il database sa che il nome del prodotto è solo il nome base
 * (02-MODELLO-DATI §3.4). Chi aggiunge "Caffè" senza specificare non sta
 * creando una variante chiamata "".
 *
 * Il controllo sui doppioni si fa qui e non solo nel database: il vincolo
 * `variante_unica` esiste e regge, ma restituisce un errore di chiave che
 * non si può mostrare a nessuno.
 */
export function validaNuovaVoce(
  dati: { nomeBase: string; variante?: string; prezzoCent: number | null },
  esistenti: readonly { nome_base: string; variante: string }[],
): EsitoNuovaVoce {
  const nomeBase = dati.nomeBase.trim().replace(/\s+/g, ' ');
  const variante = (dati.variante ?? '').trim().replace(/\s+/g, ' ') || 'normale';

  if (nomeBase.length === 0) {
    return { valido: false, errore: 'Serve il nome del prodotto.' };
  }
  if (nomeBase.length > 40) {
    return { valido: false, errore: 'Il nome è troppo lungo: massimo 40 caratteri.' };
  }
  if (variante.length > 40) {
    return { valido: false, errore: 'La variante è troppo lunga: massimo 40 caratteri.' };
  }

  const prezzo = validaPrezzo(dati.prezzoCent);
  if (!prezzo.valido) return { valido: false, errore: prezzo.errore };

  const gemello = esistenti.some(
    (p) =>
      p.nome_base.toLowerCase() === nomeBase.toLowerCase() &&
      p.variante.toLowerCase() === variante.toLowerCase(),
  );
  if (gemello) {
    return {
      valido: false,
      errore:
        variante === 'normale'
          ? `"${nomeBase}" esiste già.`
          : `"${nomeCompleto(nomeBase, variante)}" esiste già.`,
    };
  }

  return { valido: true, dati: { nomeBase, variante, prezzoCent: prezzo.prezzoCent } };
}

export interface GruppoListino {
  categoriaId: string | null;
  categoria: string;
  ordine: number;
  prodotti: Array<{
    id: string;
    nome_base: string;
    variante: string;
    prezzo_cent: number;
    preferito: boolean;
    attivo: boolean;
    ordine: number;
    categoria_id: string | null;
  }>;
}

/* ------------------------------------------------ riordino del listino */

export type MossaListino = 'su' | 'giu' | 'cima';

/** Un `ordine` nuovo da scrivere su un prodotto. */
export interface NuovoOrdine {
  id: string;
  ordine: number;
}

/**
 * Sposta un prodotto dentro la sua categoria.
 *
 * SI MUOVE IL NOME BASE, NON LA SINGOLA VARIANTE. Nella griglia un riquadro
 * è un `nome_base` — "Caffè" con dentro normale, decaffeinato e d'orzo
 * (`v_griglia_prodotti` raggruppa e prende `min(ordine)`). Spostare una
 * variante da sola vorrebbe dire spostare mezzo riquadro: a schermo non
 * cambierebbe niente, oppure cambierebbe il posto dell'intero gruppo per un
 * motivo che nessuno riesce a indovinare.
 *
 * Restituisce **solo le voci il cui `ordine` cambia davvero**. Rinumerare
 * tutto è semplice e non lascia buchi, ma scrivere sessanta righe per
 * spostarne una di un posto sarebbe uno spreco visibile: alla prima mossa
 * si aspetterebbe la rete per un secondo.
 *
 * L'elenco in ingresso dev'essere già nell'ordine in cui si vede a schermo,
 * e di una sola categoria: mescolare due categorie qui rinumererebbe voci
 * che l'utente non stava guardando.
 */
export function spostaNelListino<T extends { id: string; nome_base: string; ordine: number }>(
  prodotti: readonly T[],
  nomeBase: string,
  mossa: MossaListino,
): NuovoOrdine[] {
  const blocchi: Array<{ nomeBase: string; voci: T[] }> = [];

  for (const p of prodotti) {
    const suo = blocchi.find((b) => b.nomeBase === p.nome_base);
    if (suo) suo.voci.push(p);
    else blocchi.push({ nomeBase: p.nome_base, voci: [p] });
  }

  const da = blocchi.findIndex((b) => b.nomeBase === nomeBase);
  if (da < 0) return [];

  const a = mossa === 'cima' ? 0 : mossa === 'su' ? da - 1 : da + 1;
  // Fuori dai bordi non è un errore: è il primo che prova a salire ancora.
  if (a === da || a < 0 || a >= blocchi.length) return [];

  const riordinati = [...blocchi];
  const [preso] = riordinati.splice(da, 1);
  if (!preso) return [];
  riordinati.splice(a, 0, preso);

  const cambiati: NuovoOrdine[] = [];
  let posizione = 1;

  for (const b of riordinati) {
    for (const v of b.voci) {
      if (v.ordine !== posizione) cambiati.push({ id: v.id, ordine: posizione });
      posizione += 1;
    }
  }

  return cambiati;
}

/**
 * Il listino come si legge a schermo: per categoria, e dentro ogni categoria
 * i prodotti dello stesso nome base vicini, così le varianti si vedono in fila.
 */
export function raggruppaListino<
  T extends {
    id: string;
    nome_base: string;
    variante: string;
    prezzo_cent: number;
    preferito: boolean;
    attivo: boolean;
    ordine: number;
    categoria_id: string | null;
  },
>(
  prodotti: readonly T[],
  categorie: readonly { id: string; nome: string; ordine: number }[],
): GruppoListino[] {
  const perId = new Map(categorie.map((c) => [c.id, c]));
  const gruppi = new Map<string, GruppoListino>();

  for (const p of prodotti) {
    const chiave = p.categoria_id ?? 'senza';
    const categoria = p.categoria_id ? perId.get(p.categoria_id) : undefined;

    let gruppo = gruppi.get(chiave);
    if (!gruppo) {
      gruppo = {
        categoriaId: p.categoria_id,
        categoria: categoria?.nome ?? 'Senza categoria',
        ordine: categoria?.ordine ?? 999,
        prodotti: [],
      };
      gruppi.set(chiave, gruppo);
    }
    gruppo.prodotti.push(p);
  }

  for (const g of gruppi.values()) {
    g.prodotti.sort(
      (a, b) =>
        a.ordine - b.ordine ||
        a.nome_base.localeCompare(b.nome_base, 'it') ||
        a.prezzo_cent - b.prezzo_cent,
    );
  }

  return [...gruppi.values()].sort((a, b) => a.ordine - b.ordine);
}
