-- Gestionale Bar — migrazione 0013
-- Storni parziali: si può stornare una parte di una riga, non solo tutta
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select indexname from pg_indexes
--    where tablename = 'righe_conto' and indexname = 'idx_storno_unico';
--     -- zero righe: l'indice è stato sostituito dal trigger
--   select tgname from pg_trigger where tgname = 'trg_storni_non_eccedono';


-- ============================================================
-- Perché l'indice unico non basta più
-- ============================================================
-- `idx_storno_unico` diceva: una riga si storna **una volta sola**. Con lo
-- storno "tutto o niente" era la regola giusta e costava zero.
--
-- Serve però spostare una consumazione da un cliente a un altro — Luca offre
-- a Michele uno dei tre caffè che Michele ha preso a credito. Lo spostamento
-- è uno storno parziale sull'origine più un addebito sulla destinazione, e di
-- storni parziali sulla stessa riga ce ne possono essere più d'uno: se Luca
-- offre un caffè e poi ne offre un altro, sono due.
--
-- L'invariante che conta non era "una sola volta": era **non si storna più di
-- quanto è stato venduto**. L'indice la garantiva per caso, essendo lo storno
-- sempre totale. Adesso la si scrive per quello che è.
--
-- Resta tutto il resto di DEC-03: le righe non si modificano né si
-- cancellano, si aggiungono movimenti di segno opposto. Uno storno parziale è
-- un movimento in più, non una riga cambiata.

drop index if exists idx_storno_unico;

create or replace function controlla_storni_riga()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quantita_originale integer;
  gia_stornata       integer;
begin
  if new.storno_di is null then
    return new;
  end if;

  select quantita into quantita_originale
  from public.righe_conto
  where id = new.storno_di;

  if quantita_originale is null then
    raise exception 'La riga da stornare non esiste.';
  end if;

  -- Non si storna uno storno: sarebbe un riaddebito mascherato, e il conto
  -- di quanto è stato venduto smetterebbe di tornare.
  if quantita_originale < 0 then
    raise exception 'Questa riga è già uno storno: non si può stornare.';
  end if;

  select coalesce(sum(abs(quantita)), 0) into gia_stornata
  from public.righe_conto
  where storno_di = new.storno_di
    and id <> new.id;

  if gia_stornata + abs(new.quantita) > quantita_originale then
    raise exception
      'Storno troppo grande: di questa riga restano % pezzi da stornare.',
      quantita_originale - gia_stornata;
  end if;

  return new;
end;
$$;

revoke all on function controlla_storni_riga() from public, anon, authenticated;

drop trigger if exists trg_storni_non_eccedono on righe_conto;

create trigger trg_storni_non_eccedono
  before insert on righe_conto
  for each row execute function controlla_storni_riga();


-- Il trigger interroga righe_conto per storno_di a ogni storno: l'indice
-- esiste già dal 0001 (idx_righe_storno), quindi non serve aggiungerne.


-- ============================================================
-- L'estratto conto deve dire abbastanza per poter spostare
-- ============================================================
-- Per proporre uno spostamento servono tre cose che la vista non dava: su
-- che conto sta la riga, quanto costa un pezzo, e quanti pezzi sono già
-- stati stornati o offerti a qualcun altro. Senza l'ultima, l'app
-- proporrebbe di spostare tre caffè quando due sono già andati via, e a
-- rifiutare sarebbe il trigger qui sopra — cioè troppo tardi, con un
-- messaggio da database.
--
-- Le colonne si aggiungono in coda: `create or replace view` pretende che
-- le esistenti restino nello stesso ordine.

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
  (r.storno_di is not null)       as e_storno,
  r.conto_id,
  r.prezzo_unitario_cent,
  coalesce((
    select sum(abs(s.quantita))
    from righe_conto s
    where s.storno_di = r.id
  ), 0)::integer                  as quantita_stornata
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
  (p.storno_di is not null),
  p.conto_id,
  0,
  0
from pagamenti p
where p.cliente_id is not null;
