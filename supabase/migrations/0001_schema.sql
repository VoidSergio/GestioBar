-- Gestionale Bar — migrazione 0001
-- Tabelle, indici e trigger — Fase 1
-- Generato da docs/02-MODELLO-DATI.md — non modificare qui senza aggiornare il documento.
--
-- Esecuzione: incolla nel SQL Editor di Supabase e premi Run.
-- L'ordine dei file conta: 0001, 0002, 0003, 0004.

create extension if not exists "pgcrypto";

-- aggiorna automaticamente aggiornato_il
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

create table profili (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null,
  ruolo        text not null default 'titolare'
               check (ruolo in ('titolare', 'barista')),
  attivo       boolean not null default true,
  creato_il    timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger trg_profili_agg
  before update on profili
  for each row execute function set_aggiornato_il();

-- crea il profilo automaticamente alla registrazione
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

create trigger trg_nuovo_utente
  after insert on auth.users
  for each row execute function crea_profilo_utente();

create table clienti (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  soprannome     text,
  telefono       text,
  limite_credito_cent integer check (limite_credito_cent is null or limite_credito_cent >= 0),
  note           text,
  attivo         boolean not null default true,
  anonimizzato   boolean not null default false,
  creato_il      timestamptz not null default now(),
  creato_da      uuid references profili(id),
  aggiornato_il  timestamptz not null default now(),
  constraint nome_non_vuoto check (length(trim(nome)) > 0)
);

create trigger trg_clienti_agg
  before update on clienti
  for each row execute function set_aggiornato_il();

-- ricerca rapida per nome o soprannome
create index idx_clienti_ricerca on clienti
  using gin (to_tsvector('simple', nome || ' ' || coalesce(soprannome, '')));

create index idx_clienti_attivi on clienti (attivo) where attivo;
create index idx_clienti_creato_da on clienti (creato_da);

create table categorie (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  colore    text not null default '#64748b',
  ordine    integer not null default 0,
  attiva    boolean not null default true,
  creato_il timestamptz not null default now()
);

create table prodotti (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid references categorie(id),
  nome_base     text not null,
  variante      text not null default 'normale',
  nome          text generated always as (
                  case when variante = 'normale' then nome_base
                       else nome_base || ' ' || variante end
                ) stored,
  prezzo_cent   integer not null check (prezzo_cent >= 0),
  ordine        integer not null default 0,
  preferito     boolean not null default false,
  attivo        boolean not null default true,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint prodotto_nome_non_vuoto check (length(trim(nome_base)) > 0),
  constraint variante_unica unique (nome_base, variante)
);

create trigger trg_prodotti_agg
  before update on prodotti
  for each row execute function set_aggiornato_il();

create index idx_prodotti_griglia on prodotti (attivo, preferito desc, ordine)
  where attivo;
create index idx_prodotti_base on prodotti (nome_base, variante) where attivo;
create index idx_prodotti_categoria on prodotti (categoria_id);

create table conti (
  id          uuid primary key default gen_random_uuid(),
  numero      bigint generated always as identity,
  cliente_id  uuid references clienti(id),
  stato       text not null default 'aperto'
              check (stato in ('aperto', 'chiuso')),
  tavolo      text,
  note        text,
  aperto_il   timestamptz not null default now(),
  chiuso_il   timestamptz,
  creato_da   uuid references profili(id),
  op_id       uuid not null unique,

  constraint chiuso_ha_data check (
    (stato = 'chiuso' and chiuso_il is not null) or
    (stato = 'aperto'  and chiuso_il is null)
  )
);

-- un cliente non può avere due conti aperti insieme
create unique index idx_un_conto_aperto_per_cliente
  on conti (cliente_id) where stato = 'aperto' and cliente_id is not null;

create index idx_conti_aperti on conti (stato, aperto_il desc) where stato = 'aperto';
create index idx_conti_cliente on conti (cliente_id, aperto_il desc);
create index idx_conti_creato_da on conti (creato_da);

create table righe_conto (
  id                  uuid primary key default gen_random_uuid(),
  conto_id            uuid not null references conti(id) on delete restrict,
  prodotto_id         uuid references prodotti(id),
  descrizione         text not null,
  prezzo_unitario_cent integer not null,
  quantita            integer not null check (quantita <> 0),
  importo_cent        integer generated always as (quantita * prezzo_unitario_cent) stored,
  storno_di           uuid references righe_conto(id),
  creato_il           timestamptz not null default now(),
  creato_da           uuid references profili(id),
  op_id               uuid not null unique,

  constraint descrizione_non_vuota check (length(trim(descrizione)) > 0),
  constraint storno_ha_quantita_negativa check (
    storno_di is null or quantita < 0
  )
);

create index idx_righe_conto on righe_conto (conto_id, creato_il);
create index idx_righe_storno on righe_conto (storno_di) where storno_di is not null;
create index idx_righe_prodotto on righe_conto (prodotto_id);
create index idx_righe_creato_da on righe_conto (creato_da);

-- una riga può essere stornata una volta sola
create unique index idx_storno_unico on righe_conto (storno_di)
  where storno_di is not null;

create table pagamenti (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clienti(id),
  conto_id    uuid references conti(id),
  importo_cent integer not null check (importo_cent <> 0),
  metodo      text not null default 'contanti'
              check (metodo in ('contanti', 'carta', 'bonifico', 'altro')),
  scontrino_battuto boolean not null default false,
  note        text,
  storno_di   uuid references pagamenti(id),
  creato_il   timestamptz not null default now(),
  creato_da   uuid references profili(id),
  op_id       uuid not null unique,

  constraint pagamento_ha_riferimento check (
    cliente_id is not null or conto_id is not null
  ),
  constraint storno_pagamento_negativo check (
    storno_di is null or importo_cent < 0
  )
);

create index idx_pagamenti_cliente on pagamenti (cliente_id, creato_il desc);
create index idx_pagamenti_conto on pagamenti (conto_id);
create index idx_pagamenti_giorno on pagamenti (creato_il desc);
create index idx_pagamenti_creato_da on pagamenti (creato_da);

create unique index idx_storno_pagamento_unico on pagamenti (storno_di)
  where storno_di is not null;

-- Le funzioni SECURITY DEFINER non devono essere invocabili dall'esterno.
-- I trigger non controllano il permesso di esecuzione, quindi togliendolo
-- a tutti la creazione automatica del profilo continua a funzionare.
revoke all on function crea_profilo_utente() from public, anon, authenticated;
