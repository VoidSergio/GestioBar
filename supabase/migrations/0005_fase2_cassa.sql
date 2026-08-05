-- Gestionale Bar — migrazione 0005 — FASE 2
-- NON ESEGUIRE finché la Fase 1 non è in uso da almeno due settimane
-- (vedi docs/05-ROADMAP.md, criterio di uscita T-19).

create table movimenti_cassa (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('entrata', 'uscita', 'fondo_cassa', 'prelievo')),
  importo_cent integer not null check (importo_cent > 0),
  metodo       text not null default 'contanti'
               check (metodo in ('contanti', 'carta', 'bonifico', 'altro')),
  causale      text not null,
  pagamento_id uuid references pagamenti(id),
  giornata     date not null default current_date,
  creato_il    timestamptz not null default now(),
  creato_da    uuid references profili(id),
  op_id        uuid not null unique
);

create index idx_cassa_giornata on movimenti_cassa (giornata, tipo);

create table chiusure_giornaliere (
  id                      uuid primary key default gen_random_uuid(),
  giornata                date not null unique,
  contanti_attesi_cent    integer not null,
  contanti_contati_cent   integer not null,
  differenza_cent         integer generated always as
                            (contanti_contati_cent - contanti_attesi_cent) stored,
  incassato_carta_cent    integer not null default 0,
  credito_concesso_cent   integer not null default 0,
  credito_rientrato_cent  integer not null default 0,
  note                    text,
  chiusa_il               timestamptz not null default now(),
  chiusa_da               uuid references profili(id)
);

-- Riepilogo della giornata, pronto per la chiusura
create or replace view v_riepilogo_giornata
with (security_invoker = on) as
select
  d.giornata,
  coalesce(sum(p.importo_cent) filter (where p.metodo = 'contanti'), 0) as incassato_contanti_cent,
  coalesce(sum(p.importo_cent) filter (where p.metodo = 'carta'), 0)    as incassato_carta_cent,
  coalesce(sum(p.importo_cent) filter (where p.metodo not in ('contanti','carta')), 0) as incassato_altro_cent,
  coalesce(sum(p.importo_cent), 0) as incassato_totale_cent,
  count(distinct p.id)             as n_pagamenti
from (select distinct creato_il::date as giornata from pagamenti) d
left join pagamenti p on p.creato_il::date = d.giornata
group by d.giornata;

-- RLS e policy: le tabelle nascono protette
alter table movimenti_cassa enable row level security;
alter table chiusure_giornaliere enable row level security;

create policy "accesso autenticati" on movimenti_cassa
  for all to authenticated using (true) with check (true);
create policy "accesso autenticati" on chiusure_giornaliere
  for all to authenticated using (true) with check (true);
