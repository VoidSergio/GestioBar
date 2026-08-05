-- Gestionale Bar — migrazione 0006 — FASE 3
-- NON ESEGUIRE finché la Fase 2 non è stabile.

create table fornitori (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  telefono  text,
  email     text,
  note      text,
  attivo    boolean not null default true,
  creato_il timestamptz not null default now()
);

create table articoli (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  unita           text not null default 'pz'
                  check (unita in ('pz', 'kg', 'l', 'conf')),
  scorta_minima   numeric(10,3) not null default 0,
  fornitore_id    uuid references fornitori(id),
  costo_ultimo_cent integer,
  attivo          boolean not null default true,
  creato_il       timestamptz not null default now()
);

create table movimenti_magazzino (
  id           uuid primary key default gen_random_uuid(),
  articolo_id  uuid not null references articoli(id),
  tipo         text not null check (tipo in ('carico', 'scarico', 'rettifica', 'scarto')),
  quantita     numeric(10,3) not null check (quantita <> 0),
  costo_unitario_cent integer,
  causale      text,
  riga_conto_id uuid references righe_conto(id),
  creato_il    timestamptz not null default now(),
  creato_da    uuid references profili(id),
  op_id        uuid not null unique
);

create index idx_movimenti_articolo on movimenti_magazzino (articolo_id, creato_il desc);

-- distinta base: quanto articolo consuma un prodotto venduto
create table composizioni (
  prodotto_id uuid not null references prodotti(id) on delete cascade,
  articolo_id uuid not null references articoli(id) on delete cascade,
  quantita    numeric(10,3) not null check (quantita > 0),
  primary key (prodotto_id, articolo_id)
);

create or replace view v_giacenze
with (security_invoker = on) as
select
  a.id,
  a.nome,
  a.unita,
  a.scorta_minima,
  a.fornitore_id,
  coalesce(sum(m.quantita), 0) as giacenza,
  coalesce(sum(m.quantita), 0) <= a.scorta_minima as sotto_scorta
from articoli a
left join movimenti_magazzino m on m.articolo_id = a.id
where a.attivo
group by a.id, a.nome, a.unita, a.scorta_minima, a.fornitore_id;

-- RLS e policy: le tabelle nascono protette
alter table fornitori enable row level security;
alter table articoli enable row level security;
alter table movimenti_magazzino enable row level security;
alter table composizioni enable row level security;

create policy "accesso autenticati" on fornitori
  for all to authenticated using (true) with check (true);
create policy "accesso autenticati" on articoli
  for all to authenticated using (true) with check (true);
create policy "accesso autenticati" on movimenti_magazzino
  for all to authenticated using (true) with check (true);
create policy "accesso autenticati" on composizioni
  for all to authenticated using (true) with check (true);
