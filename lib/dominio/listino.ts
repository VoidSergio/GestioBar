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
