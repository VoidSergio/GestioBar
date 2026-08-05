-- Gestionale Bar — migrazione 0003
-- Row Level Security e regole anti-cancellazione
-- Generato da docs/02-MODELLO-DATI.md — non modificare qui senza aggiornare il documento.
--
-- Esecuzione: incolla nel SQL Editor di Supabase e premi Run.
-- L'ordine dei file conta: 0001, 0002, 0003, 0004.

alter table profili      enable row level security;
alter table clienti      enable row level security;
alter table categorie    enable row level security;
alter table prodotti     enable row level security;
alter table conti        enable row level security;
alter table righe_conto  enable row level security;
alter table pagamenti    enable row level security;

-- funzione di comodo: ruolo dell'utente corrente
create or replace function ruolo_corrente()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ruolo from public.profili where id = (select auth.uid());
$$;

-- Serve alle policy per ruolo della Fase 4: un anonimo non ha un ruolo.
revoke all on function ruolo_corrente() from public, anon;
grant execute on function ruolo_corrente() to authenticated;

-- FASE 1: chiunque sia autenticato può operare.
-- Una sola policy "for all" per tabella: include già la lettura, e due policy
-- permissive sovrapposte costringono Postgres a valutarle entrambe a ogni riga.
create policy "scrittura autenticati" on clienti
  for all to authenticated using (true) with check (true);

create policy "scrittura prodotti" on prodotti
  for all to authenticated using (true) with check (true);

create policy "scrittura categorie" on categorie
  for all to authenticated using (true) with check (true);

create policy "scrittura conti" on conti
  for all to authenticated using (true) with check (true);

create policy "scrittura righe" on righe_conto
  for all to authenticated using (true) with check (true);

create policy "scrittura pagamenti" on pagamenti
  for all to authenticated using (true) with check (true);

create policy "profilo proprio" on profili
  for select to authenticated using (true);
create policy "modifica profilo proprio" on profili
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Le righe si possono cancellare solo entro 60 secondi e a conto aperto (DEC-03)
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

create trigger trg_blocca_cancellazione_riga
  before delete on righe_conto
  for each row execute function blocca_cancellazione_riga();

-- I pagamenti non si cancellano mai
create or replace function blocca_cancellazione_pagamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'I pagamenti non si cancellano: registra uno storno';
end;
$$;

create trigger trg_blocca_cancellazione_pagamento
  before delete on pagamenti
  for each row execute function blocca_cancellazione_pagamento();
