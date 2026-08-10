-- Gestionale Bar — migrazione 0016
-- Chiusura di turno (T-20 e T-22)
--
-- Esecuzione: SQL Editor di Supabase. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select * from impostazioni;              -- fondo_cassa_cent = 8000
--   select * from v_turno_corrente;          -- una riga, il turno aperto adesso
--   select * from v_riepilogo_giornata;      -- vuota finché non si chiude un turno
--
-- Sostituisce il vecchio 0005_fase2_cassa.sql, che non è mai stato eseguito e
-- dava per scontata una chiusura al giorno. Il perché sta in 02-MODELLO-DATI §4.1.


-- ============================================================
-- 1. Impostazioni del locale
-- ============================================================
-- Il fondo cassa è un numero che cambia una volta ogni tre anni e va ribattuto
-- a ogni chiusura se non sta da qualche parte. Una tabella chiave/valore invece
-- di una colonna: la prossima impostazione arriverà, e non voglio una
-- migrazione per ognuna.

create table if not exists impostazioni (
  chiave        text primary key,
  valore        text not null,
  descrizione   text,
  aggiornato_il timestamptz not null default now()
);

insert into impostazioni (chiave, valore, descrizione) values
  ('fondo_cassa_cent', '8000', 'Quanto resta nel cassetto a fine turno, in centesimi')
on conflict (chiave) do nothing;

alter table impostazioni enable row level security;

drop policy if exists "lettura impostazioni"  on impostazioni;
drop policy if exists "modifica impostazioni" on impostazioni;

create policy "lettura impostazioni" on impostazioni
  for select to authenticated using (true);

-- Il fondo cassa lo cambia solo il titolare: è il numero contro cui si misura
-- l'onestà di ogni turno, e chi viene misurato non tiene il metro.
create policy "modifica impostazioni" on impostazioni
  for update to authenticated
  using (ruolo_corrente() = 'titolare')
  with check (ruolo_corrente() = 'titolare');


-- ============================================================
-- 2. Le chiusure di turno
-- ============================================================
-- Perché gli importi sono memorizzati, contro DEC-02.
-- Una chiusura non è un saldo: è la dichiarazione di una persona su quanto
-- c'era nel cassetto a un certo minuto. Ricalcolarla dopo la falsificherebbe —
-- e in quest'app succederebbe davvero, perché un pagamento fatto offline alle
-- 12:50 può arrivare al server alle 13:20, dopo la chiusura delle 13:00. Il
-- contante era nel cassetto, l'app non lo sapeva ancora, e la differenza
-- rilevata è un fatto vero di quel momento. Ricalcolando, sparirebbe.

create table if not exists chiusure_turno (
  id                       uuid primary key default gen_random_uuid(),

  iniziato_il              timestamptz not null,
  chiuso_il                timestamptz not null default now(),

  -- Fotografia del momento
  fondo_cassa_cent         integer not null check (fondo_cassa_cent >= 0),
  contato_cent             integer not null check (contato_cent >= 0),
  incassato_contanti_cent  integer not null,
  incassato_carta_cent     integer not null default 0,
  incassato_altro_cent     integer not null default 0,
  variazione_credito_cent  integer not null default 0,

  -- Calcolate: la sottrazione non si può sbagliare
  atteso_cent     integer generated always as
                    (fondo_cassa_cent + incassato_contanti_cent) stored,
  differenza_cent integer generated always as
                    (contato_cent - fondo_cassa_cent - incassato_contanti_cent) stored,
  ritirato_cent   integer generated always as
                    (contato_cent - fondo_cassa_cent) stored,

  causale   text,
  chiuso_da uuid not null references profili(id),
  op_id     uuid not null unique,

  constraint turno_ha_durata check (chiuso_il > iniziato_il)
);

create index if not exists idx_turni_chiuso_il on chiusure_turno (chiuso_il desc);
-- Niente indice su `chiuso_il::date`: quel cast dipende dal fuso della
-- sessione, quindi non è immutabile e Postgres rifiuta l'indice. Con qualche
-- migliaio di righe l'ordinamento qui sopra basta e avanza.

alter table chiusure_turno enable row level security;

drop policy if exists "lettura turni"      on chiusure_turno;
drop policy if exists "chiusura turni"     on chiusure_turno;
drop policy if exists "annullo turni"      on chiusure_turno;

create policy "lettura turni" on chiusure_turno
  for select to authenticated using (true);

create policy "chiusura turni" on chiusure_turno
  for insert to authenticated
  with check (chiuso_da = (select auth.uid()));

create policy "annullo turni" on chiusure_turno
  for delete to authenticated using (true);
  -- Ristretta davvero dal trigger qui sotto: le policy sanno dire *chi*, non
  -- *quando*, e qui la finestra temporale è metà della regola.


-- ============================================================
-- 3. Una chiusura non si modifica, e si annulla solo subito
-- ============================================================
-- Stessa lezione della migrazione 0015, applicata prima di sbagliare invece
-- che dopo: se una dichiarazione si può riscrivere, non dichiara niente.
-- La finestra dei 5 minuti esiste per un motivo solo, quello vero: si sbaglia
-- a digitare il conteggio e ce se ne accorge subito. Chi l'ha scritta la
-- rifà; chiunque altro, no.

create or replace function blocca_modifica_turno()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'Una chiusura di turno non si modifica. Se è sbagliata, annullala entro 5 minuti e rifalla.';
end;
$$;

drop trigger if exists trg_blocca_modifica_turno on chiusure_turno;
create trigger trg_blocca_modifica_turno
  before update on chiusure_turno
  for each row execute function blocca_modifica_turno();

create or replace function blocca_annullo_turno()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.chiuso_da <> (select auth.uid()) then
    raise exception 'Puoi annullare solo una chiusura fatta da te.';
  end if;

  if now() - old.chiuso_il > interval '5 minutes' then
    raise exception
      'Sono passati più di 5 minuti: questa chiusura resta. Spiega la differenza nella prossima.';
  end if;

  -- Non si annulla una chiusura se dopo ne è già stata fatta un'altra:
  -- il turno successivo è già partito da lì e i conti si sposterebbero
  -- sotto i piedi a qualcun altro.
  if exists (
    select 1 from public.chiusure_turno t where t.chiuso_il > old.chiuso_il
  ) then
    raise exception 'C''è già una chiusura più recente: questa non si annulla più.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_blocca_annullo_turno on chiusure_turno;
create trigger trg_blocca_annullo_turno
  before delete on chiusure_turno
  for each row execute function blocca_annullo_turno();


-- ============================================================
-- 4. Da quando è aperto il turno
-- ============================================================
-- Un turno non si apre: comincia dove è finito il precedente. Un pulsante
-- "apri turno" è un pulsante che qualcuno dimentica, e da lì in poi i conti
-- sono sbagliati per tutti quelli dopo.
-- Al primissimo giro non c'è un precedente, e il confine è `-infinity`: il
-- turno aperto è "tutto quello che non è ancora stato chiuso".
--
-- La prima versione partiva invece dal primo movimento registrato, e sbagliava:
-- il filtro del periodo è `creato_il > confine`, quindi quel primo movimento
-- cadeva fuori dal suo stesso turno. Un caffè perso una volta sola, alla prima
-- chiusura della vita dell'app — cioè nel momento in cui nessuno ha ancora
-- l'occhio per accorgersene. Trovato provando la migrazione su un Postgres
-- vero prima di eseguirla, non leggendola.

create or replace function inizio_turno_corrente()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select max(chiuso_il) from public.chiusure_turno),
    '-infinity'::timestamptz
  );
$$;

revoke all on function inizio_turno_corrente() from public, anon;
grant execute on function inizio_turno_corrente() to authenticated;


-- ============================================================
-- 5. Il turno aperto adesso
-- ============================================================
-- È la schermata di chiusura prima che qualcuno scriva il conteggio.
--
-- Sulla "variazione del credito": è quanto è cresciuto il debito complessivo
-- dei clienti durante il turno — consumato a credito meno vecchi debiti
-- rientrati. Ne esisteva anche una lettura diversa, il solo credito concesso
-- al lordo dei rientri, e sono due numeri che non coincidono mai in un locale
-- che segna. Se ne è scelto uno solo e lo si chiama col suo nome: due
-- definizioni plausibili per la stessa parola sono il modo più rapido di
-- avere un numero di cui nessuno si fida.
--
-- Non entra nella riconciliazione del cassetto: è lì per spiegare perché il
-- venduto e il contante non tornano, non per essere sommato o sottratto.

create or replace view v_turno_corrente
with (security_invoker = on) as
with periodo as (
  select inizio_turno_corrente() as da, now() as a
)
select
  -- Il confine vero è `-infinity` alla prima chiusura, ma a schermo non si può
  -- scrivere "dalle -infinity": si mostra il primo movimento che c'è dentro.
  case when p.da = '-infinity'::timestamptz then coalesce(
         (select min(creato_il) from pagamenti),
         (select min(creato_il) from righe_conto),
         now())
       else p.da end as iniziato_il,

  (select (valore)::integer from impostazioni where chiave = 'fondo_cassa_cent')
    as fondo_cassa_cent,

  coalesce((
    select sum(pa.importo_cent) from pagamenti pa
    where pa.creato_il > p.da and pa.metodo = 'contanti'
  ), 0) as incassato_contanti_cent,

  coalesce((
    select sum(pa.importo_cent) from pagamenti pa
    where pa.creato_il > p.da and pa.metodo = 'carta'
  ), 0) as incassato_carta_cent,

  coalesce((
    select sum(pa.importo_cent) from pagamenti pa
    where pa.creato_il > p.da and pa.metodo not in ('contanti', 'carta')
  ), 0) as incassato_altro_cent,

  -- Consumato a credito meno rientri: la variazione netta del debito in giro
  coalesce((
    select sum(r.importo_cent) from righe_conto r
    join conti co on co.id = r.conto_id
    where r.creato_il > p.da and co.cliente_id is not null
  ), 0)
  - coalesce((
    select sum(pa.importo_cent) from pagamenti pa
    where pa.creato_il > p.da and pa.cliente_id is not null
  ), 0) as variazione_credito_cent,

  (select count(*) from pagamenti pa where pa.creato_il > p.da) as n_pagamenti
from periodo p;


-- ============================================================
-- 6. La giornata è la somma dei turni
-- ============================================================
-- Non esiste una "chiusura giornaliera" da premere: l'ultima chiusura di
-- turno della sera è già quella del giorno. Il totale non si memorizza da
-- nessuna parte — quello sì che sarebbe DEC-02 violata: un totale scritto
-- diverge il giorno in cui un turno viene annullato e rifatto.

-- Il vecchio 0005 definiva una vista con lo stesso nome e altre colonne.
-- Non è mai stato eseguito, ma `create or replace` fallirebbe se lo fosse
-- stato: meglio non dipendere da come è andata.
drop view if exists v_riepilogo_giornata;

create or replace view v_riepilogo_giornata
with (security_invoker = on) as
select
  -- Il fuso è scritto, non ereditato dalla sessione: la giornata di un bar
  -- deve essere la stessa vista dal telefono del titolare e da uno script.
  (chiuso_il at time zone 'Europe/Rome')::date as giornata,
  count(*)                            as n_turni,
  min(iniziato_il)                    as dalle,
  max(chiuso_il)                      as alle,
  sum(incassato_contanti_cent)        as incassato_contanti_cent,
  sum(incassato_carta_cent)           as incassato_carta_cent,
  sum(incassato_altro_cent)           as incassato_altro_cent,
  sum(variazione_credito_cent)        as variazione_credito_cent,
  sum(ritirato_cent)                  as ritirato_cent,
  sum(differenza_cent)                as differenza_cent
from chiusure_turno
group by (chiuso_il at time zone 'Europe/Rome')::date;
