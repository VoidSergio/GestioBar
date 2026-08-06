-- Gestionale Bar — migrazione 0011
-- Vista degli scontrini: che cosa è stato battuto e che cosa no
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select tipo, scontrino_battuto, count(*), sum(importo_cent)
--   from v_scontrini group by 1, 2 order by 1, 2;


-- ============================================================
-- Due cose diverse che sembrano una sola
-- ============================================================
-- `scontrino_battuto` sta su `pagamenti`, non sulle righe di conto. Ne segue
-- che ci sono DUE modi in cui della merce esce dal bar senza scontrino, e
-- vanno letti separati perché sono problemi diversi:
--
--   1. INCASSO SENZA SCONTRINO — sono entrati dei soldi e non è stato
--      battuto niente. È il caso che serve a quadrare la cassa a fine
--      turno: contanti in cassa che non trovano riscontro nel registratore.
--
--   2. CONSUMAZIONE A CREDITO — non è entrato un euro, quindi non c'era
--      niente da battere. Non è un ammanco: è un credito. Diventerà un
--      incasso (con o senza scontrino) il giorno in cui il cliente paga.
--
-- La vista li tiene distinti con la colonna `tipo`. **Non vanno sommati.**
-- Un conto a credito del lunedì e il pagamento di quel debito del venerdì
-- sono due righe in due giorni diversi: la prima dice che merce è uscita,
-- la seconda che soldi sono entrati. Sommarle conterebbe due volte lo
-- stesso caffè.
--
-- `security_invoker = on` come tutte le altre viste (0002): senza, la vista
-- girerebbe con i permessi di chi l'ha creata e scavalcherebbe RLS.

create or replace view v_scontrini
with (security_invoker = on) as

-- 1. I soldi entrati. La spunta dice se è stato battuto lo scontrino.
select
  p.id                          as movimento_id,
  'incasso'::text               as tipo,
  p.creato_il                   as data,
  p.importo_cent,
  p.scontrino_battuto,
  p.metodo::text                as metodo,
  p.cliente_id,
  cl.nome                       as cliente_nome,
  cl.soprannome                 as cliente_soprannome,
  co.numero                     as conto_numero
from pagamenti p
left join clienti cl on cl.id = p.cliente_id
left join conti   co on co.id = p.conto_id
-- Gli storni non sono un incasso: annullano quello di prima, e mostrarli
-- come "da battere" farebbe cercare uno scontrino che non deve esistere.
where p.storno_di is null

union all

-- 2. La merce uscita a credito: quanto di quel conto non è stato coperto
--    da nessun pagamento.
select
  co.id,
  'a_credito'::text,
  co.chiuso_il,
  r.totale_cent - coalesce(pg.pagato_cent, 0),
  false,
  null::text,
  co.cliente_id,
  cl.nome,
  cl.soprannome,
  co.numero
from conti co
join (
  select conto_id, sum(importo_cent) as totale_cent
  from righe_conto
  group by conto_id
) r on r.conto_id = co.id
left join (
  select conto_id, sum(importo_cent) as pagato_cent
  from pagamenti
  where conto_id is not null and storno_di is null
  group by conto_id
) pg on pg.conto_id = co.id
left join clienti cl on cl.id = co.cliente_id
where co.chiuso_il is not null
  -- Solo la parte scoperta: un conto pagato a metà compare per la differenza
  and r.totale_cent - coalesce(pg.pagato_cent, 0) > 0;


-- La schermata legge sempre una giornata alla volta, filtrando su `data`.
-- Questi due indici servono a quel filtro; senza, ogni apertura leggerebbe
-- tutta la tabella.
create index if not exists idx_pagamenti_creato_il on pagamenti (creato_il desc);
create index if not exists idx_conti_chiuso_il     on conti (chiuso_il desc)
  where chiuso_il is not null;
