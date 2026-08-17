-- Gestionale Bar — migrazione 0018
-- Le viste dei report (T-23, T-25, T-26)
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select * from v_giornata order by giornata desc limit 7;
--   select * from v_venduto_prodotto order by giornata desc, quantita desc limit 20;
--   select * from v_classifica_clienti order by consumato_sempre_cent desc limit 10;
--   select * from v_ore_di_punta order by pezzi desc limit 10;
--
-- NON CREA NESSUNA TABELLA. Sono quattro letture su `righe_conto` e
-- `pagamenti`, che registrano già tutto quello che serve: la descrizione e il
-- prezzo congelati sulla riga (DEC-05) e `creato_il` al secondo. Se una vista
-- risultasse sbagliata si riscrive e si rilegge, senza migrare niente.
--
-- `security_invoker = on` su tutte, come in 0002: senza, la vista girerebbe
-- con i permessi di chi l'ha creata e scavalcherebbe la RLS delle tabelle
-- sotto — cioè i report sarebbero l'unico posto da cui leggere i dati di
-- tutti senza esserne autorizzati.


-- ============================================================
-- La giornata, e il fuso
-- ============================================================
-- Il fuso è scritto, non ereditato dalla sessione (come in 0016): la giornata
-- di un bar dev'essere la stessa vista dal telefono del titolare, dal browser
-- e da uno script. Con il fuso della sessione, un caffè battuto alle 00:30
-- finirebbe nella giornata di ieri o di oggi a seconda di chi guarda.
--
-- Resta il fatto che per un bar la giornata finisce a mezzanotte, mentre il
-- turno può andare oltre. Sono due tagli diversi e servono a due cose diverse:
-- la cassa si quadra per turno (`v_riepilogo_giornata`, che somma le
-- chiusure), il venduto si legge per giornata di calendario. Non vanno
-- confrontati riga per riga.


-- ============================================================
-- 1. v_giornata — i soldi di ogni giornata
-- ============================================================
-- QUATTRO NUMERI CHE NON VANNO SOMMATI FRA LORO.
--
--   venduto        = merce uscita dal bar, pagata o no
--   incassato      = soldi entrati, per qualunque motivo
--   credito_concesso = venduto che è rimasto da pagare
--   credito_rientrato = soldi entrati per saldare debiti vecchi
--
-- Le identità che li legano, e che i controlli automatici verificano:
--
--   incassato = incassato_su_conti + credito_rientrato
--   venduto   = incassato_su_conti + credito_concesso
--
-- Da cui: venduto − incassato = credito_concesso − credito_rientrato. Cioè
-- la differenza fra quello che è uscito e quello che è entrato **non è un
-- ammanco**: è di quanto è cresciuto (o calato) il credito in giro. È il
-- numero che spiega perché una giornata da 400 € di consumazioni può avere
-- 250 € in cassa senza che manchi niente.
--
-- Gli storni non hanno bisogno di nessun filtro: una riga stornata ha
-- `quantita < 0` per vincolo di schema e uno storno di pagamento ha
-- `importo_cent < 0`. Le somme sono già nette. **Non scrivere
-- `where storno_di is null`**: toglierebbe lo storno lasciando dentro la
-- riga sbagliata, cioè il contrario di quello che serve.

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
    -- Un pagamento legato a un conto sta pagando quella consumazione.
    -- Uno senza conto sta rientrando da un debito vecchio.
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
full outer join incassi i on i.giornata = r.giornata;


-- ============================================================
-- 2. v_venduto_prodotto — che cosa esce (T-26)
-- ============================================================
-- Raggruppa per **descrizione**, non per `prodotto_id`, e non è una svista.
-- La descrizione è congelata sulla riga al momento della battuta (DEC-05):
-- se domani "Caffè" diventa "Espresso", le righe vecchie restano "Caffè" e
-- le nuove sono "Espresso". Raggruppando per id verrebbe una riga sola con
-- un nome che non è mai stato usato per metà di quelle vendite.
--
-- Comprende **tutto**, banco compreso: quello che esce esce, che sia segnato
-- o pagato subito. È la differenza con la classifica clienti qui sotto, che
-- per costruzione vede solo i conti intestati.

create or replace view v_venduto_prodotto
with (security_invoker = on) as
select
  (r.creato_il at time zone 'Europe/Rome')::date as giornata,
  r.descrizione,
  sum(r.quantita)      as quantita,
  sum(r.importo_cent)  as importo_cent
from righe_conto r
group by 1, 2;


-- ============================================================
-- 3. v_classifica_clienti — chi consuma e chi paga (T-25)
-- ============================================================
-- Due finestre fisse: il mese corrente e sempre. Non un intervallo a scelta,
-- perché un intervallo in una vista vorrebbe dire una funzione con parametri,
-- e queste due sono le finestre che si guardano davvero — "come sta andando
-- il mese" e "chi è un cliente da anni".
--
-- IL BANCO NON C'È, ED È PER COSTRUZIONE. I conti anonimi non hanno un
-- cliente, e in un bar sono spesso la maggioranza del giro. Questa vista
-- risponde a "chi fra i clienti che conosco consuma di più", **non** a "da
-- dove vengono i miei soldi". La schermata lo deve scrivere, altrimenti il
-- totale della classifica sembra un errore di conto.

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
left join versamenti  vs on vs.cliente_id = c.id;


-- ============================================================
-- 4. v_ore_di_punta — a che ora si lavora
-- ============================================================
-- Probabilmente l'analisi più utile di tutte, perché è l'unica che cambia
-- una decisione vera: quando stare dietro al banco, quando preparare, quando
-- tenere qualcuno in più. E non costa niente: `creato_il` c'è già su ogni
-- riga.
--
-- Novanta giorni, non sempre: le abitudini di un bar cambiano con la
-- stagione, e una media su due anni descrive un locale che non esiste più.
--
-- `isodow`: 1 = lunedì … 7 = domenica. L'ora è quella locale, per lo stesso
-- motivo per cui lo è la giornata.

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
group by 1, 2;


-- ============================================================
-- Indici
-- ============================================================
-- Le viste filtrano e raggruppano per data. `idx_pagamenti_giorno` esiste
-- già da 0001; alle righe di conto serviva un indice sulla sola data —
-- quello che c'è è su `(conto_id, creato_il)`, che non aiuta chi legge un
-- mese intero senza sapere di quali conti.

create index if not exists idx_righe_conto_giorno on righe_conto (creato_il desc);
