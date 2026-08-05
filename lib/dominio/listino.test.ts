import { describe, it, expect } from 'vitest';
import { variantePredefinita, nomeCompleto, categorieDi } from './listino';
import type { RiquadroGriglia } from '@/lib/supabase/tipi';

function riquadro(
  nomeBase: string,
  varianti: Array<[string, number]>,
  categoria = 'Caffetteria',
  ordineCategoria = 1,
): RiquadroGriglia {
  return {
    nome_base: nomeBase,
    categoria,
    categoria_colore: '#000',
    categoria_ordine: ordineCategoria,
    ordine: 1,
    preferito: false,
    prezzo_da_cent: Math.min(...varianti.map(([, p]) => p)),
    ha_varianti: varianti.length > 1,
    varianti: varianti.map(([variante, prezzo_cent], i) => ({
      id: `${nomeBase}-${i}`,
      variante,
      prezzo_cent,
    })),
  };
}

describe('variantePredefinita', () => {
  it('sceglie "normale" quando esiste', () => {
    // Cappuccino: normale 1,70 è più caro dell'ipotetica variante più economica,
    // ma è quello che il cliente intende dicendo "un cappuccino".
    const cappuccino = riquadro('Cappuccino', [
      ['normale', 170],
      ['decaffeinato', 180],
      ['alta digeribilità', 200],
      ['alta digeribilità decaffeinato', 210],
      ['ginseng', 200],
    ]);
    expect(variantePredefinita(cappuccino).variante).toBe('normale');
    expect(variantePredefinita(cappuccino).prezzo_cent).toBe(170);
  });

  it('sceglie la meno costosa quando "normale" non esiste', () => {
    // Ichnusa: nessuna variante si chiama "normale", la 0,33 è la più venduta
    const ichnusa = riquadro(
      'Ichnusa',
      [
        ['0,33', 170],
        ['al limone 0,33', 250],
        ['0,66', 270],
      ],
      'Birre',
      5,
    );
    expect(variantePredefinita(ichnusa).variante).toBe('0,33');
  });

  it('non si affida all\'ordine dell\'elenco', () => {
    // Stesse varianti, ordine invertito: il risultato non cambia
    const vino = riquadro(
      'Vino al calice',
      [
        ['vermentino', 350],
        ['rosso', 300],
        ['bianco', 300],
        ['prosecco', 300],
      ],
      'Vini',
      7,
    );
    expect(variantePredefinita(vino).prezzo_cent).toBe(300);
  });

  it('funziona con una sola variante', () => {
    const marocchino = riquadro('Marocchino', [['normale', 200]]);
    expect(variantePredefinita(marocchino).prezzo_cent).toBe(200);
  });

  it('lancia un errore se il prodotto non ha varianti', () => {
    const rotto = riquadro('Fantasma', []);
    expect(() => variantePredefinita(rotto)).toThrow(/non ha varianti/);
  });
});

describe('nomeCompleto', () => {
  it('omette la parola "normale"', () => {
    expect(nomeCompleto('Caffè', 'normale')).toBe('Caffè');
  });

  it('scrive la variante per esteso: il cliente deve poter leggere cosa ha preso', () => {
    expect(nomeCompleto('Cappuccino', 'decaffeinato')).toBe('Cappuccino decaffeinato');
    expect(nomeCompleto('Ichnusa', '0,66')).toBe('Ichnusa 0,66');
    expect(nomeCompleto('Vino al calice', 'vermentino')).toBe('Vino al calice vermentino');
  });
});

describe('categorieDi', () => {
  it('restituisce le categorie nell\'ordine del listino, senza ripetizioni', () => {
    const riquadri = [
      riquadro('Spritz', [['normale', 500]], 'Aperitivi', 6),
      riquadro('Caffè', [['normale', 120]], 'Caffetteria', 1),
      riquadro('Cappuccino', [['normale', 170]], 'Caffetteria', 1),
      riquadro('Ichnusa', [['0,33', 170]], 'Birre', 5),
    ];
    expect(categorieDi(riquadri)).toEqual(['Caffetteria', 'Birre', 'Aperitivi']);
  });

  it('regge un elenco vuoto', () => {
    expect(categorieDi([])).toEqual([]);
  });
});
