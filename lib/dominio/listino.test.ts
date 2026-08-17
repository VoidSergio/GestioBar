import { describe, it, expect } from 'vitest';
import {
  variantePredefinita,
  nomeCompleto,
  categorieDi,
  avvisoCambioPrezzo,
  raggruppaListino,
  spostaNelListino,
  troppiPreferiti,
  validaNuovaVoce,
  validaPrezzo,
} from './listino';
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

  it("non si affida all'ordine dell'elenco", () => {
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
  it("restituisce le categorie nell'ordine del listino, senza ripetizioni", () => {
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

describe('validaPrezzo', () => {
  it('accetta un prezzo normale', () => {
    expect(validaPrezzo(120)).toEqual({ valido: true, prezzoCent: 120 });
  });

  it('accetta lo zero: esiste il prodotto in omaggio', () => {
    expect(validaPrezzo(0).valido).toBe(true);
  });

  it('rifiuta il non-numero e il negativo', () => {
    expect(validaPrezzo(null).valido).toBe(false);
    expect(validaPrezzo(-1).valido).toBe(false);
  });

  it('ferma lo zero di troppo', () => {
    // 1.200,00 € per un caffè: è un dito scivolato, non un prezzo
    const e = validaPrezzo(120_000);
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/zero/i);
  });
});

describe('troppiPreferiti', () => {
  it('nove entrano nella griglia, dieci no', () => {
    expect(troppiPreferiti(9)).toBe(false);
    expect(troppiPreferiti(10)).toBe(true);
  });
});

describe('avvisoCambioPrezzo', () => {
  it('dice che vale per il futuro, e non chiede conferma', () => {
    const a = avvisoCambioPrezzo(120, 130);
    expect(a).toMatch(/alzato/);
    expect(a).toMatch(/prossime consumazioni/i);
    expect(a).not.toMatch(/\?$/);
  });

  it('riconosce anche il ribasso', () => {
    expect(avvisoCambioPrezzo(130, 120)).toMatch(/abbassato/);
  });
});

describe('validaNuovaVoce', () => {
  const esistenti = [
    { nome_base: 'Caffè', variante: 'normale' },
    { nome_base: 'Caffè', variante: 'decaffeinato' },
  ];

  it('accetta un prodotto nuovo', () => {
    const e = validaNuovaVoce({ nomeBase: '  Spritz ', prezzoCent: 500 }, esistenti);
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.dati.nomeBase).toBe('Spritz');
    expect(e.dati.variante).toBe('normale');
  });

  it('senza variante mette "normale", non la stringa vuota', () => {
    const e = validaNuovaVoce({ nomeBase: 'Spritz', variante: '   ', prezzoCent: 500 }, []);
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.dati.variante).toBe('normale');
  });

  it('accetta una variante nuova di un prodotto che esiste', () => {
    const e = validaNuovaVoce(
      { nomeBase: 'Caffè', variante: 'in vetro', prezzoCent: 130 },
      esistenti,
    );
    expect(e.valido).toBe(true);
  });

  it('rifiuta il doppione, ignorando le maiuscole', () => {
    const e = validaNuovaVoce(
      { nomeBase: 'caffè', variante: 'DECAFFEINATO', prezzoCent: 130 },
      esistenti,
    );
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/esiste già/);
  });

  it('rifiuta il nome vuoto e il prezzo assurdo', () => {
    expect(validaNuovaVoce({ nomeBase: '   ', prezzoCent: 100 }, []).valido).toBe(false);
    expect(validaNuovaVoce({ nomeBase: 'Spritz', prezzoCent: null }, []).valido).toBe(false);
  });
});

describe('raggruppaListino', () => {
  const categorie = [
    { id: 'cat-caffe', nome: 'Caffetteria', ordine: 1 },
    { id: 'cat-birre', nome: 'Birre', ordine: 5 },
  ];

  function prod(nomeBase: string, variante: string, categoriaId: string | null, ordine = 0) {
    return {
      id: `${nomeBase}-${variante}`,
      nome_base: nomeBase,
      variante,
      prezzo_cent: 120,
      preferito: false,
      attivo: true,
      ordine,
      categoria_id: categoriaId,
    };
  }

  it('mette le categorie nel loro ordine, non alfabetico', () => {
    const g = raggruppaListino(
      [prod('Ichnusa', '0,33', 'cat-birre'), prod('Caffè', 'normale', 'cat-caffe')],
      categorie,
    );
    expect(g.map((x) => x.categoria)).toEqual(['Caffetteria', 'Birre']);
  });

  it('tiene vicine le varianti dello stesso prodotto', () => {
    const g = raggruppaListino(
      [
        prod('Cappuccino', 'normale', 'cat-caffe', 3),
        prod('Caffè', 'decaffeinato', 'cat-caffe', 1),
        prod('Caffè', 'normale', 'cat-caffe', 1),
      ],
      categorie,
    );
    expect(g[0]!.prodotti.map((p) => p.nome_base)).toEqual(['Caffè', 'Caffè', 'Cappuccino']);
  });

  it('un prodotto senza categoria non sparisce', () => {
    const g = raggruppaListino([prod('Boh', 'normale', null)], categorie);
    expect(g).toHaveLength(1);
    expect(g[0]!.categoria).toBe('Senza categoria');
  });
});

describe('spostaNelListino', () => {
  const voce = (id: string, nome_base: string, ordine: number) => ({ id, nome_base, ordine });

  // Caffè ha due varianti: si muovono insieme, sono un riquadro solo.
  const listino = [
    voce('caffe-1', 'Caffè', 1),
    voce('caffe-2', 'Caffè', 2),
    voce('cappuccino', 'Cappuccino', 3),
    voce('cornetto', 'Cornetto', 4),
  ];

  it('sposta in giù un prodotto e rinumera quello che ha scavalcato', () => {
    expect(spostaNelListino(listino, 'Caffè', 'giu')).toEqual([
      { id: 'cappuccino', ordine: 1 },
      { id: 'caffe-1', ordine: 2 },
      { id: 'caffe-2', ordine: 3 },
    ]);
  });

  it('le varianti seguono il loro prodotto, non restano indietro', () => {
    const cambiati = spostaNelListino(listino, 'Cornetto', 'cima');
    const ordinePerId = new Map(cambiati.map((c) => [c.id, c.ordine]));

    expect(ordinePerId.get('cornetto')).toBe(1);
    expect(ordinePerId.get('caffe-1')).toBe(2);
    expect(ordinePerId.get('caffe-2')).toBe(3);
    expect(ordinePerId.get('cappuccino')).toBe(4);
  });

  it('restituisce solo quello che cambia davvero', () => {
    // Cappuccino sale di un posto: Cornetto, che sta sotto, non si muove.
    const cambiati = spostaNelListino(listino, 'Cappuccino', 'su');
    expect(cambiati.map((c) => c.id)).not.toContain('cornetto');
  });

  it('il primo non sale e l’ultimo non scende: nessuna scrittura', () => {
    expect(spostaNelListino(listino, 'Caffè', 'su')).toEqual([]);
    expect(spostaNelListino(listino, 'Caffè', 'cima')).toEqual([]);
    expect(spostaNelListino(listino, 'Cornetto', 'giu')).toEqual([]);
  });

  it('un nome che non c’è non tocca niente', () => {
    expect(spostaNelListino(listino, 'Spritz', 'su')).toEqual([]);
  });

  it('non modifica l’elenco di partenza', () => {
    spostaNelListino(listino, 'Cornetto', 'cima');
    expect(listino.map((v) => v.id)).toEqual(['caffe-1', 'caffe-2', 'cappuccino', 'cornetto']);
    expect(listino[0]!.ordine).toBe(1);
  });

  it('applicato al listino, l’ordine finale è quello che ci si aspetta', () => {
    const cambiati = spostaNelListino(listino, 'Cornetto', 'cima');
    const perId = new Map(cambiati.map((c) => [c.id, c.ordine]));

    const dopo = listino
      .map((v) => ({ ...v, ordine: perId.get(v.id) ?? v.ordine }))
      .sort((a, b) => a.ordine - b.ordine);

    expect(dopo.map((v) => v.nome_base)).toEqual(['Cornetto', 'Caffè', 'Caffè', 'Cappuccino']);
  });

  it('rinumera senza buchi né doppioni: la griglia legge min(ordine) per riquadro', () => {
    const cambiati = spostaNelListino(listino, 'Cornetto', 'cima');
    const perId = new Map(cambiati.map((c) => [c.id, c.ordine]));
    const ordini = listino.map((v) => perId.get(v.id) ?? v.ordine).sort((a, b) => a - b);

    expect(ordini).toEqual([1, 2, 3, 4]);
  });
});
