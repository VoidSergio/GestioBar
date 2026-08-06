-- Gestionale Bar — migrazione 0012
-- Stella Artois, categoria Birre
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select count(*) from prodotti;            -- 62
--   select count(*) from v_griglia_prodotti;  -- 36
--   select nome, prezzo_cent from prodotti where nome_base = 'Stella Artois';
--     -- Stella Artois 0,33  250

-- La variante si chiama '0,33' e non 'normale' come per le altre birre: nella
-- griglia il formato fa parte del nome del prodotto, e "Stella Artois" senza
-- formato starebbe accanto a "Heineken 0,33" senza dire quanto è grande.
--
-- Solo il formato piccolo, perché è l'unico prezzo che mi è stato dato.
-- 2,50 è esattamente la 0,33 di Heineken, Beck's e Tuborg. Se si vende anche
-- la 0,66, la regolarità del listino (07-LISTINO.md §1) direbbe 3,50 — ma un
-- prezzo non si deduce, si chiede: va aggiunto con una riga qui.
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  -- base,             variante, cent, preferito, ordine
  ('Stella Artois',    '0,33',    250, false, 7)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Birre'
on conflict on constraint variante_unica do nothing;
