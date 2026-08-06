-- Gestionale Bar — migrazione 0009
-- Patatine in busta, categoria Food
--
-- Esecuzione: incolla nel SQL Editor di Supabase e premi Run.
--
-- Verifica dopo l'esecuzione:
--   select count(*) from prodotti;            -- 61
--   select count(*) from v_griglia_prodotti;  -- 35
--   select nome, prezzo_cent from prodotti where nome_base = 'Patatine';
--     -- Patatine grandi  300
--     -- Patatine piccole 150

-- Due varianti e nessuna "normale": è voluto. Sul riquadro il tap breve
-- sceglie la più economica (variantePredefinita in lib/dominio/listino.ts),
-- cioè la busta piccola, che è quella che si vende di più. La grande sta
-- sotto il ▾, come le altre varianti.
--
-- Non sono "preferito": il preferito porta il prodotto in cima alla griglia
-- e quei posti valgono per il caffè, non per le patatine (07-LISTINO.md §2).
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  -- base,        variante,   cent, preferito, ordine
  ('Patatine',    'piccole',   150, false, 3),
  ('Patatine',    'grandi',    300, false, 3)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Food'
-- Rieseguire la migrazione non deve creare doppioni né dare errore:
-- `variante_unica` è il vincolo su (nome_base, variante).
on conflict on constraint variante_unica do nothing;
