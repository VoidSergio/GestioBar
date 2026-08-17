-- Gestionale Bar — migrazione 0019
-- Ruoli: che cosa può fare un barista, e che cosa solo il titolare (T-40, T-42, T-43)
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- ⚠️  LE POLICY VANNO PROVATE QUI, NON SUL COMPUTER.
-- `npm run verifica:migrazioni` gira su un Postgres in memoria dove i ruoli e
-- `auth.uid()` sono finti: verifica schema, vincoli, trigger e viste, ma **non**
-- la Row Level Security. Le query di controllo stanno in `06-SETUP-SUPABASE.md`
-- §5.2 e vanno eseguite dopo questa migrazione, prima di dare un accesso a
-- qualcuno.
--
-- Per tornare indietro in fretta, se qualcosa si blocca:
--   drop policy if exists "listino solo titolare" on prodotti;
--   create policy "scrittura prodotti" on prodotti for all to authenticated
--     using (true) with check (true);
-- e uguale per `categorie`. Il resto di questo file non toglie permessi a
-- nessuno.


-- ============================================================
-- 1. Chi ha fatto cosa (T-42, T-43)
-- ============================================================
-- Le colonne `creato_da` esistono da 0001 e sono sempre rimaste vuote: nessuno
-- le riempiva, perché l'app non le mandava. Invece di cambiare tutte le
-- scritture — e ricordarsene per sempre a ogni nuova — lo fa il database.
--
-- Un valore predefinito e non un trigger: un trigger sovrascriverebbe anche
-- quello che il client manda apposta (per esempio rigiocando la coda offline
-- di un altro dispositivo), mentre un default interviene solo quando la
-- colonna non è stata scritta.
--
-- Vale da adesso in avanti. Lo storico resta senza autore, e la schermata lo
-- dice invece di attribuirlo a qualcuno a caso.

alter table conti       alter column creato_da set default auth.uid();
alter table righe_conto alter column creato_da set default auth.uid();
alter table pagamenti   alter column creato_da set default auth.uid();
alter table clienti     alter column creato_da set default auth.uid();


-- ============================================================
-- 2. Il listino lo cambia il titolare
-- ============================================================
-- È l'unica restrizione che si può far rispettare davvero a livello di
-- database, e anche l'unica che serve davvero: un prezzo sbagliato si porta
-- dietro tutti i conti battuti dopo.
--
-- Un barista **legge** il listino: senza, la griglia sarebbe vuota e non
-- potrebbe lavorare.

drop policy if exists "scrittura prodotti"     on prodotti;
drop policy if exists "scrittura categorie"    on categorie;
drop policy if exists "lettura listino"        on prodotti;
drop policy if exists "listino solo titolare"  on prodotti;
drop policy if exists "lettura categorie"      on categorie;
drop policy if exists "categorie solo titolare" on categorie;

create policy "lettura listino" on prodotti
  for select to authenticated using (true);

create policy "listino solo titolare" on prodotti
  for all to authenticated
  using (ruolo_corrente() = 'titolare')
  with check (ruolo_corrente() = 'titolare');

create policy "lettura categorie" on categorie
  for select to authenticated using (true);

create policy "categorie solo titolare" on categorie
  for all to authenticated
  using (ruolo_corrente() = 'titolare')
  with check (ruolo_corrente() = 'titolare');


-- ============================================================
-- 3. Nessuno si promuove da solo
-- ============================================================
-- QUESTO ERA UN BUCO APERTO, non una funzione nuova.
--
-- La policy `modifica profilo proprio` di 0003 permette a chiunque di
-- aggiornare la propria riga in `profili`. Quella riga contiene `ruolo`.
-- Quindi fino a oggi un barista poteva scrivere `update profili set ruolo =
-- 'titolare' where id = auth.uid()` e diventare titolare. Non serviva
-- nemmeno un errore dell'app: bastava la chiave anon, che è pubblica per
-- disegno.
--
-- Il divieto sta in un trigger e non in una policy perché una `with check`
-- vede solo la riga nuova, e qui serve confrontarla con quella vecchia: il
-- problema non è *quale* ruolo si scrive, è che sia **cambiato**.

create or replace function proteggi_profilo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ruolo is distinct from old.ruolo or new.attivo is distinct from old.attivo then
    if public.ruolo_corrente() is distinct from 'titolare' then
      raise exception 'Ruoli e attivazioni li cambia solo il titolare';
    end if;
  end if;

  if new.ruolo is distinct from old.ruolo and new.id = (select auth.uid()) then
    raise exception 'Il proprio ruolo non si cambia da soli';
  end if;

  -- Se l'ultimo titolare attivo si retrocede o si disattiva, il locale resta
  -- senza nessuno che possa cambiare i prezzi, i ruoli e il fondo cassa — e
  -- senza nessuno che possa rimediare dall'app.
  if old.ruolo = 'titolare' and old.attivo
     and (new.ruolo is distinct from 'titolare' or not new.attivo)
     and (
       select count(*) from public.profili
       where ruolo = 'titolare' and attivo and id <> old.id
     ) = 0
  then
    raise exception 'Deve restare almeno un titolare attivo';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteggi_profilo on profili;
create trigger trg_proteggi_profilo
  before update on profili
  for each row execute function proteggi_profilo();

-- Il titolare può modificare anche i profili degli altri: senza, la schermata
-- di gestione non potrebbe fare niente.
drop policy if exists "gestione profili" on profili;
create policy "gestione profili" on profili
  for update to authenticated
  using (ruolo_corrente() = 'titolare')
  with check (ruolo_corrente() = 'titolare');

-- Un profilo non si cancella: si disattiva. Cancellarlo lascerebbe orfane
-- tutte le righe che ha battuto — stessa ragione dei clienti (0010).
drop policy if exists "profili non si cancellano" on profili;
create or replace function blocca_cancellazione_profilo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Un profilo non si cancella: si disattiva, altrimenti si perde chi ha battuto cosa';
end;
$$;

drop trigger if exists trg_blocca_cancellazione_profilo on profili;
create trigger trg_blocca_cancellazione_profilo
  before delete on profili
  for each row execute function blocca_cancellazione_profilo();


-- ============================================================
-- 4. I report li legge il titolare
-- ============================================================
-- CHE COSA QUESTO FA, E CHE COSA NON FA.
--
-- Fa: le quattro viste dei report non restituiscono niente a chi non è
-- titolare, quindi la schermata Report è vuota per un barista e l'app gliela
-- nasconde del tutto.
--
-- Non fa: **non impedisce a un barista di calcolarsi gli stessi numeri.** Un
-- barista deve poter leggere `righe_conto` e `pagamenti`, perché da lì
-- vengono i saldi dei clienti, e senza saldi non può decidere se dare
-- credito. Chi legge quelle due tabelle le può anche sommare.
--
-- Chiudere davvero quel buco vuol dire far passare ogni lettura da funzioni
-- `security definer`, cioè rifare l'impianto della sicurezza. È una cosa da
-- decidere il giorno in cui il ricavo della giornata diventa un segreto da
-- proteggere e non un'informazione da non sbandierare. Oggi non lo è, e
-- scriverlo qui è meglio che lasciarlo credere.

create or replace view v_giornata
with (security_invoker = on) as
with righe as (
  select
    (r.creato_il at time zone 'Europe/Rome')::date as giornata,
    sum(r.importo_cent)                            as venduto_cent,
    sum(r.quantita)                                as pezzi,
    count(distinct r.conto_id)                     as n_conti
  from righe_conto r
  group by 1
),
incassi as (
  select
    (p.creato_il at time zone 'Europe/Rome')::date as giornata,
    sum(p.importo_cent)                                             as incassato_cent,
    sum(p.importo_cent) filter (where p.metodo = 'contanti')        as contanti_cent,
    sum(p.importo_cent) filter (where p.metodo = 'carta')           as carta_cent,
    sum(p.importo_cent) filter (where p.metodo not in ('contanti', 'carta')) as altro_cent,
    sum(p.importo_cent) filter (where p.conto_id is not null)       as su_conti_cent,
    sum(p.importo_cent) filter (where p.conto_id is null)           as rientrato_cent,
    count(*) filter (where p.scontrino_battuto and p.storno_di is null) as n_scontrini,
    count(*) filter (where not p.scontrino_battuto and p.storno_di is null) as n_senza_scontrino
  from pagamenti p
  group by 1
)
select
  coalesce(r.giornata, i.giornata)          as giornata,
  coalesce(r.venduto_cent, 0)               as venduto_cent,
  coalesce(r.pezzi, 0)                      as pezzi,
  coalesce(r.n_conti, 0)                    as n_conti,
  coalesce(i.incassato_cent, 0)             as incassato_cent,
  coalesce(i.contanti_cent, 0)              as contanti_cent,
  coalesce(i.carta_cent, 0)                 as carta_cent,
  coalesce(i.altro_cent, 0)                 as altro_cent,
  coalesce(i.su_conti_cent, 0)              as incassato_su_conti_cent,
  coalesce(i.rientrato_cent, 0)             as credito_rientrato_cent,
  coalesce(r.venduto_cent, 0) - coalesce(i.su_conti_cent, 0) as credito_concesso_cent,
  coalesce(i.n_scontrini, 0)                as n_scontrini,
  coalesce(i.n_senza_scontrino, 0)          as n_senza_scontrino
from righe r
full outer join incassi i on i.giornata = r.giornata
where ruolo_corrente() = 'titolare';

create or replace view v_venduto_prodotto
with (security_invoker = on) as
select
  (r.creato_il at time zone 'Europe/Rome')::date as giornata,
  r.descrizione,
  sum(r.quantita)      as quantita,
  sum(r.importo_cent)  as importo_cent
from righe_conto r
where ruolo_corrente() = 'titolare'
group by 1, 2;

create or replace view v_ore_di_punta
with (security_invoker = on) as
select
  extract(isodow from (r.creato_il at time zone 'Europe/Rome'))::int as giorno_settimana,
  extract(hour  from (r.creato_il at time zone 'Europe/Rome'))::int  as ora,
  sum(r.quantita)            as pezzi,
  sum(r.importo_cent)        as importo_cent,
  count(distinct r.conto_id) as n_conti
from righe_conto r
where r.creato_il >= now() - interval '90 days'
  and ruolo_corrente() = 'titolare'
group by 1, 2;

create or replace view v_classifica_clienti
with (security_invoker = on) as
with inizio_mese as (
  select date_trunc('month', (now() at time zone 'Europe/Rome'))::date as g
),
consumi as (
  select
    co.cliente_id,
    sum(r.importo_cent)                                                as sempre_cent,
    sum(r.quantita)                                                    as pezzi_sempre,
    sum(r.importo_cent) filter (
      where (r.creato_il at time zone 'Europe/Rome')::date >= (select g from inizio_mese)
    )                                                                  as mese_cent,
    max(r.creato_il)                                                   as ultima_consumazione_il
  from conti co
  join righe_conto r on r.conto_id = co.id
  where co.cliente_id is not null
  group by co.cliente_id
),
versamenti as (
  select
    p.cliente_id,
    sum(p.importo_cent)                                                as sempre_cent,
    sum(p.importo_cent) filter (
      where (p.creato_il at time zone 'Europe/Rome')::date >= (select g from inizio_mese)
    )                                                                  as mese_cent
  from pagamenti p
  where p.cliente_id is not null
  group by p.cliente_id
)
select
  c.id            as cliente_id,
  c.nome,
  c.soprannome,
  c.attivo,
  coalesce(cs.mese_cent, 0)    as consumato_mese_cent,
  coalesce(cs.sempre_cent, 0)  as consumato_sempre_cent,
  coalesce(cs.pezzi_sempre, 0) as pezzi_sempre,
  coalesce(vs.mese_cent, 0)    as pagato_mese_cent,
  coalesce(vs.sempre_cent, 0)  as pagato_sempre_cent,
  cs.ultima_consumazione_il
from clienti c
left join consumi     cs on cs.cliente_id = c.id
left join versamenti  vs on vs.cliente_id = c.id
where ruolo_corrente() = 'titolare';


-- ============================================================
-- 5. Chi ha lavorato, e quanto (T-43)
-- ============================================================
-- Serve a rispondere a "quanto ha incassato Marco martedì", che è una domanda
-- legittima e sgradevole insieme. La schermata la presenta per quello che è —
-- un conteggio, non un giudizio — e mostra sempre accanto quanti conti ha
-- battuto: chi lavora nelle ore morte incassa meno di chi sta al banco alle
-- otto, e il numero da solo non lo dice.
--
-- Chi ha battuto prima di questa migrazione non compare: `creato_da` era
-- vuoto. È una riga "senza nome" nella schermata, non un buco.

create or replace view v_operatore_giornata
with (security_invoker = on) as
with righe as (
  select
    (r.creato_il at time zone 'Europe/Rome')::date as giornata,
    r.creato_da                                    as operatore_id,
    sum(r.importo_cent)                            as venduto_cent,
    count(distinct r.conto_id)                     as n_conti
  from righe_conto r
  group by 1, 2
),
incassi as (
  select
    (p.creato_il at time zone 'Europe/Rome')::date as giornata,
    p.creato_da                                    as operatore_id,
    sum(p.importo_cent)                            as incassato_cent
  from pagamenti p
  group by 1, 2
),
unite as (
  select
    coalesce(r.giornata, i.giornata)                  as giornata,
    coalesce(r.operatore_id, i.operatore_id)          as operatore_id,
    coalesce(r.venduto_cent, 0)                       as venduto_cent,
    coalesce(r.n_conti, 0)                            as n_conti,
    coalesce(i.incassato_cent, 0)                     as incassato_cent
  from righe r
  full outer join incassi i
    on i.giornata = r.giornata
   and i.operatore_id is not distinct from r.operatore_id
)
select
  u.giornata,
  u.operatore_id,
  p.nome as operatore,
  u.venduto_cent,
  u.n_conti,
  u.incassato_cent
from unite u
left join profili p on p.id = u.operatore_id
where ruolo_corrente() = 'titolare';
