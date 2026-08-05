-- Gestionale Bar — migrazione 0002
-- Viste di lettura — Fase 1
-- Generato da docs/02-MODELLO-DATI.md — non modificare qui senza aggiornare il documento.
--
-- Esecuzione: incolla nel SQL Editor di Supabase e premi Run.
-- L'ordine dei file conta: 0001, 0002, 0003, 0004.
--
-- NOTA IMPORTANTE: ogni vista è creata con `security_invoker = on`.
-- Senza quell'opzione una vista gira con i permessi di chi l'ha creata
-- (l'amministratore) e scavalca la Row Level Security delle tabelle sotto:
-- chiunque avesse la chiave anon potrebbe leggere i saldi di tutti i clienti.

-- Prodotti raggruppati per la griglia: una riga per bevanda, varianti in array
create or replace view v_griglia_prodotti
with (security_invoker = on) as
select
  p.nome_base,
  c.nome    as categoria,
  c.colore  as categoria_colore,
  c.ordine  as categoria_ordine,
  min(p.ordine)                                as ordine,
  bool_or(p.preferito)                         as preferito,
  min(p.prezzo_cent)                           as prezzo_da_cent,
  count(*) > 1                                 as ha_varianti,
  jsonb_agg(
    jsonb_build_object('id', p.id, 'variante', p.variante, 'prezzo_cent', p.prezzo_cent)
    order by p.prezzo_cent
  ) as varianti
from prodotti p
left join categorie c on c.id = p.categoria_id
where p.attivo
group by p.nome_base, c.nome, c.colore, c.ordine;

-- Saldo e stato di ogni cliente
create or replace view v_saldo_clienti
with (security_invoker = on) as
select
  c.id,
  c.nome,
  c.soprannome,
  c.telefono,
  c.limite_credito_cent,
  c.attivo,
  coalesce(a.addebitato_cent, 0)                        as addebitato_cent,
  coalesce(p.pagato_cent, 0)                            as pagato_cent,
  coalesce(a.addebitato_cent, 0) - coalesce(p.pagato_cent, 0) as saldo_cent,
  a.primo_movimento_il,
  p.ultimo_pagamento_il,
  greatest(a.ultimo_movimento_il, p.ultimo_pagamento_il) as ultimo_movimento_il,
  case
    when coalesce(a.addebitato_cent, 0) - coalesce(p.pagato_cent, 0) <= 0
      then null
    else extract(day from
           now() - coalesce(p.ultimo_pagamento_il, a.primo_movimento_il)
         )::int
  end as giorni_debito
from clienti c
left join (
  select
    co.cliente_id,
    sum(r.importo_cent)  as addebitato_cent,
    min(r.creato_il)     as primo_movimento_il,
    max(r.creato_il)     as ultimo_movimento_il
  from conti co
  join righe_conto r on r.conto_id = co.id
  where co.cliente_id is not null
  group by co.cliente_id
) a on a.cliente_id = c.id
left join (
  select
    cliente_id,
    sum(importo_cent) as pagato_cent,
    max(creato_il)    as ultimo_pagamento_il
  from pagamenti
  where cliente_id is not null
  group by cliente_id
) p on p.cliente_id = c.id;

-- Conti attualmente aperti, con totale corrente
create or replace view v_conti_aperti
with (security_invoker = on) as
select
  co.id,
  co.numero,
  co.cliente_id,
  cl.nome         as cliente_nome,
  cl.soprannome   as cliente_soprannome,
  co.tavolo,
  co.aperto_il,
  coalesce(sum(r.importo_cent), 0) as totale_cent,
  count(r.id)                      as n_righe
from conti co
left join clienti cl     on cl.id = co.cliente_id
left join righe_conto r  on r.conto_id = co.id
where co.stato = 'aperto'
group by co.id, co.numero, co.cliente_id, cl.nome, cl.soprannome, co.tavolo, co.aperto_il;

-- Estratto conto: tutti i movimenti di un cliente in ordine cronologico
create or replace view v_estratto_conto
with (security_invoker = on) as
select
  co.cliente_id,
  r.creato_il                     as data,
  'consumazione'                  as tipo,
  r.descrizione,
  r.quantita,
  r.importo_cent,
  co.numero                       as conto_numero,
  r.id                            as movimento_id,
  (r.storno_di is not null)       as e_storno
from righe_conto r
join conti co on co.id = r.conto_id
where co.cliente_id is not null

union all

select
  p.cliente_id,
  p.creato_il,
  'pagamento',
  'Pagamento ' || p.metodo,
  1,
  -p.importo_cent,
  null,
  p.id,
  (p.storno_di is not null)
from pagamenti p
where p.cliente_id is not null;
