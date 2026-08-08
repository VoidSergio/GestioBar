-- Gestionale Bar — migrazione 0014
-- Bitter con aggiunta, categoria Aperitivi
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select count(*) from prodotti;            -- 63
--   select count(*) from v_griglia_prodotti;  -- 36 (invariato: 'Bitter' esisteva già)
--   select nome, prezzo_cent from prodotti where nome_base = 'Bitter';
--     -- Bitter               250
--     -- Bitter con aggiunta  300

-- Perché questo file esiste.
-- Il prodotto era già stato aggiunto dall'app (Altro → Listino, T-16) ed è
-- quindi già in produzione: qui la migrazione non cambia nulla. Serve perché
-- un criterio di T-02 dice che i file .sql devono riprodurre il database da
-- zero. Senza questa riga, un database ricostruito dalle sole migrazioni
-- avrebbe un listino diverso da quello vero, e la differenza si scoprirebbe
-- il giorno peggiore.
--
-- La lezione, per la prossima volta: un prodotto aggiunto dall'app va
-- rispecchiato in una migrazione **nuova**, mai modificando 0004_listino.sql.
-- Quel file è già stato applicato in remoto; cambiarlo fa fallire il push
-- successivo per disallineamento di cronologia, che è esattamente l'errore
-- incontrato il 7 agosto.
--
-- Sul prezzo: 3,00 € e non 2,50 come il Bitter liscio. Segue la regolarità
-- del listino (07-LISTINO.md §1), la stessa del Campari soda, dove
-- l'aggiunta vale cinquanta centesimi: 3,00 → 3,50.
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  -- base,       variante,        cent, preferito, ordine
  ('Bitter',     'con aggiunta',   300, false, 1)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Aperitivi'
on conflict on constraint variante_unica do nothing;
