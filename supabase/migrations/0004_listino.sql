-- Gestionale Bar — migrazione 0004
-- Listino reale del locale: 59 prodotti, 34 riquadri
-- Generato da docs/07-LISTINO.md §3.
--
-- Verifica dopo l'esecuzione:
--   select count(*) from prodotti;            -- 59
--   select count(*) from v_griglia_prodotti;  -- 34

-- ============================================
-- CATEGORIE
-- ============================================
insert into categorie (nome, colore, ordine) values
  ('Caffetteria',   '#8b5a3c', 1),
  ('Acque',         '#0891b2', 2),
  ('Bibite',        '#2563eb', 3),
  ('Food',          '#16a34a', 4),
  ('Birre',         '#ca8a04', 5),
  ('Aperitivi',     '#dc2626', 6),
  ('Vini',          '#7e22ce', 7),
  ('Superalcolici', '#b45309', 8)
on conflict (nome) do nothing;

-- ============================================
-- CAFFETTERIA
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  -- base,             variante,                         cent, preferito, ordine
  ('Caffè',            'normale',                         120, true,  1),
  ('Caffè',            'decaffeinato',                    130, true,  1),
  ('Caffè',            'corretto',                        170, true,  1),

  ('Caffè macchiato',  'normale',                         130, true,  2),
  ('Caffè macchiato',  'decaffeinato',                    140, true,  2),

  ('Cappuccino',       'normale',                         170, true,  3),
  ('Cappuccino',       'decaffeinato',                    180, true,  3),
  ('Cappuccino',       'alta digeribilità',               200, true,  3),
  ('Cappuccino',       'alta digeribilità decaffeinato',  210, true,  3),
  ('Cappuccino',       'ginseng',                         200, true,  3),

  ('Latte macchiato',  'normale',                         180, false, 4),
  ('Latte macchiato',  'decaffeinato',                    190, false, 4),
  ('Latte macchiato',  'alta digeribilità',               200, false, 4),
  ('Latte macchiato',  'alta digeribilità decaffeinato',  210, false, 4),

  ('Caffellatte',      'normale',                         180, false, 5),
  ('Caffellatte',      'decaffeinato',                    190, false, 5),
  ('Caffellatte',      'alta digeribilità',               200, false, 5),
  ('Caffellatte',      'alta digeribilità decaffeinato',  210, false, 5),

  ('Ginseng',          'normale',                         170, false, 6),
  ('Marocchino',       'normale',                         200, false, 7),
  ('Tè caldo',         'normale',                         170, false, 8),
  ('Cioccolata',       'normale',                         250, false, 9),
  ('Cioccolata',       'con panna',                       270, false, 9)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Caffetteria';

-- ============================================
-- ACQUE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Acqua bicchiere',    'normale',    30, true,  1),
  ('Acqua bottiglia',    'naturale',  100, true,  2),
  ('Acqua bottiglia',    'frizzante', 100, true,  2),
  ('Acqua con sciroppo', 'normale',   150, false, 3)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Acque';

-- ============================================
-- BIBITE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Succo di frutta', 'normale', 250, false, 1),
  ('Lattina',         'normale', 250, false, 2),
  ('Estathé brik',    'normale', 200, false, 3),
  ('Red Bull',        'normale', 300, false, 4)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Bibite';

-- ============================================
-- FOOD
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Pasta',            'normale', 150, true, 1),
  ('Pizzetta sfoglia', 'normale', 150, true, 2)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Food';

-- ============================================
-- BIRRE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Ichnusa',   '0,33',           170, false, 1),
  ('Ichnusa',   '0,66',           270, false, 1),
  ('Ichnusa',   'al limone 0,33', 250, false, 1),

  ('Heineken',  '0,33',           250, false, 2),
  ('Heineken',  '0,66',           350, false, 2),

  ('Becks',     '0,33',           250, false, 3),
  ('Becks',     '0,66',           350, false, 3),

  ('Tuborg',    '0,33',           250, false, 4),
  ('Tuborg',    '0,66',           350, false, 4),

  ('Tennents',  '0,33',           300, false, 5),
  ('Corona',    '0,33',           350, false, 6)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Birre';

-- ============================================
-- APERITIVI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Bitter',       'normale',      250, false, 1),
  ('Crodino',      'normale',      250, false, 2),
  ('Campari soda', 'normale',      300, false, 3),
  ('Campari soda', 'con aggiunta', 350, false, 3),
  ('Bicicletta',   'normale',      300, false, 4),
  ('Spritz',       'normale',      500, true,  5),
  ('Drink',        'normale',      500, false, 6)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Aperitivi';

-- ============================================
-- VINI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Vino al calice', 'rosso',      300, false, 1),
  ('Vino al calice', 'bianco',     300, false, 1),
  ('Vino al calice', 'prosecco',   300, false, 1),
  ('Vino al calice', 'vermentino', 350, false, 1)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Vini';

-- ============================================
-- SUPERALCOLICI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Amaro',          'normale', 300, false, 1),
  ('Superalcolico',  'baby',    300, false, 2),
  ('Superalcolico',  'normale', 350, false, 2),
  ('Rum Zacapa',     'normale', 500, false, 3)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Superalcolici';
