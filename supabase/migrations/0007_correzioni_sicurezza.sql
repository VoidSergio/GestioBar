-- Gestionale Bar — migrazione 0007
-- Correzioni di sicurezza segnalate dal Security Advisor di Supabase
--
-- Esecuzione: incolla nel SQL Editor di Supabase e premi Run. Una volta sola.
-- È idempotente: rieseguirla non fa danni.
--
-- Cosa sistema, in ordine di gravità:
--   1. le viste scavalcavano RLS  ← il problema serio
--   2. tabelle di Fase 2 e 3 create per errore, senza protezione
--   3. funzioni con search_path modificabile
--   4. policy duplicate e chiamate ad auth.uid() rivalutate riga per riga


-- ============================================================
-- 1. VISTE: security_invoker
-- ============================================================
-- Una vista, per impostazione predefinita, gira con i permessi di CHI L'HA
-- CREATA (l'amministratore), non di chi la interroga. Risultato: le viste
-- scavalcavano completamente la Row Level Security delle tabelle sottostanti.
-- Chiunque avesse la chiave anon poteva leggere v_saldo_clienti e vedere i
-- debiti di tutti i clienti, RLS o no.
--
-- Con security_invoker = on la vista gira con i permessi di chi la interroga,
-- quindi le regole delle tabelle valgono anche attraverso la vista.
-- È esattamente ciò che segnalava il "Security Definer View — CRITICAL".

alter view v_saldo_clienti     set (security_invoker = on);
alter view v_conti_aperti      set (security_invoker = on);
alter view v_estratto_conto    set (security_invoker = on);
alter view v_griglia_prodotti  set (security_invoker = on);


-- ============================================================
-- 2. Rimozione delle tabelle di Fase 2 e Fase 3
-- ============================================================
-- Le migrazioni 0005 e 0006 sono state eseguite per errore. Le loro tabelle
-- sono vuote e nessuna schermata le usa, ma esistono senza RLS: sono superficie
-- di attacco per funzioni che non esistono ancora.
--
-- Si eliminano. Quando servirà davvero la Fase 2 si rieseguirà 0005, che nel
-- frattempo è stato corretto e crea le tabelle già protette.
-- Nessun dato viene perso: sono vuote.

drop view  if exists v_giacenze;
drop view  if exists v_riepilogo_giornata;

drop table if exists composizioni          cascade;
drop table if exists movimenti_magazzino   cascade;
drop table if exists articoli              cascade;
drop table if exists fornitori             cascade;
drop table if exists chiusure_giornaliere  cascade;
drop table if exists movimenti_cassa       cascade;


-- ============================================================
-- 3. Funzioni: search_path fissato
-- ============================================================
-- Una funzione senza search_path esplicito risolve i nomi delle tabelle
-- consultando la configurazione di chi la chiama. Chi riesce a manipolare quel
-- percorso può far eseguire alla funzione codice su tabelle diverse da quelle
-- previste. Fissandolo a stringa vuota e qualificando i nomi con `public.`,
-- il problema sparisce.

create or replace function set_aggiornato_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornato_il = now();
  return new;
end;
$$;

create or replace function blocca_cancellazione_riga()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stato_conto text;
begin
  select stato into stato_conto from public.conti where id = old.conto_id;

  if stato_conto <> 'aperto' then
    raise exception 'Il conto è chiuso: usa uno storno invece della cancellazione';
  end if;

  if old.creato_il < now() - interval '60 seconds' then
    raise exception 'Riga troppo vecchia per essere cancellata: usa uno storno';
  end if;

  return old;
end;
$$;

create or replace function blocca_cancellazione_pagamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'I pagamenti non si cancellano: registra uno storno';
end;
$$;

create or replace function ruolo_corrente()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ruolo from public.profili where id = (select auth.uid());
$$;

create or replace function crea_profilo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profili (id, nome, ruolo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profili) = 0 then 'titolare' else 'barista' end
  );
  return new;
end;
$$;


-- ============================================================
-- 4. Policy: elimina i doppioni
-- ============================================================
-- C'erano due policy permissive per la lettura su ogni tabella: una "for select"
-- e una "for all", che include già select. Postgres deve valutarle entrambe a
-- ogni riga letta. Una sola basta e fa la stessa cosa.

drop policy if exists "lettura autenticati" on clienti;
drop policy if exists "lettura prodotti"    on prodotti;
drop policy if exists "lettura categorie"   on categorie;
drop policy if exists "lettura conti"       on conti;
drop policy if exists "lettura righe"       on righe_conto;
drop policy if exists "lettura pagamenti"   on pagamenti;


-- ============================================================
-- 5. Policy su profili: auth.uid() valutata una volta sola
-- ============================================================
-- Scritta come `id = auth.uid()`, la funzione viene rieseguita per ogni riga
-- esaminata. Racchiusa in `(select auth.uid())` viene calcolata una volta e
-- riusata. Su tabelle piccole non cambia nulla; su tabelle grandi sì, e costa
-- due parentesi.

drop policy if exists "modifica profilo proprio" on profili;

create policy "modifica profilo proprio" on profili
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ============================================================
-- Verifica
-- ============================================================
-- Le quattro viste devono risultare con security_invoker attivo:
--
--   select c.relname, c.reloptions
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'v';
--
-- Le tabelle rimaste devono essere sette:
--
--   select tablename, rowsecurity
--   from pg_tables where schemaname = 'public' order by tablename;
