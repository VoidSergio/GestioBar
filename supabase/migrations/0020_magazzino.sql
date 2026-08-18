-- Gestionale Bar — migrazione 0020
-- Magazzino (T-30 … T-36)
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select * from v_giacenze order by sotto_scorta desc, nome;
--   select valore from impostazioni where chiave = 'scarico_automatico';  -- 'no'
--
-- Sostituisce il vecchio `0006_fase3_magazzino.sql`, che non è mai stato
-- eseguito da nessuna parte. Stessa storia di 0005 → 0016: un file mai
-- applicato si riscrive, ma con un numero nuovo, perché il vecchio è citato
-- nei documenti e due file che dicono cose diverse sono peggio di uno
-- sbagliato.


-- ============================================================
-- LE QUANTITÀ SONO INTERI IN MILLESIMI
-- ============================================================
-- La bozza usava `numeric(10,3)`. Dentro Postgres sarebbe stato esatto: il
-- problema comincia quando quel numero esce.
--
-- PostgREST consegna i `numeric` a JavaScript, e in JavaScript non esiste il
-- decimale esatto: 0,1 + 0,2 non fa 0,3. Un caffè scarica 0,007 kg di grani;
-- duecento caffè al giorno per un mese sono seimila somme, e la giacenza
-- comincia a finire con ,00000000004. Poi qualcuno la confronta con
-- l'inventario contato a mano e non torna mai, e nessuno capisce perché.
--
-- È la stessa ragione per cui il denaro sta in centesimi interi (DEC-04).
-- Qui l'unità è il **millesimo**: un grammo, un millilitro, un millesimo di
-- pezzo. `1250` vuol dire 1,250 kg. La divisione per mille compare in un
-- posto solo dell'app, dentro `formatQuantita`.
--
-- Tre decimali bastano: sotto il grammo, in un bar, non c'è niente da pesare.


-- ============================================================
-- 1. Fornitori
-- ============================================================

create table if not exists fornitori (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  telefono  text,
  email     text,
  note      text,
  attivo    boolean not null default true,
  creato_il timestamptz not null default now(),
  creato_da uuid references profili(id) default auth.uid(),

  constraint nome_fornitore_non_vuoto check (length(trim(nome)) > 0)
);


-- ============================================================
-- 2. Articoli
-- ============================================================
-- Un articolo è **quello che si compra**, non quello che si vende: il caffè
-- in grani, il latte, i bicchieri. Il legame con quello che si vende è la
-- distinta base qui sotto.

create table if not exists articoli (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  unita               text not null default 'pz'
                      check (unita in ('pz', 'kg', 'l', 'conf')),
  -- Sotto questa quantità l'articolo compare in evidenza. Zero vuol dire
  -- "non avvisarmi", ed è il valore predefinito: un magazzino che avvisa su
  -- tutto non avvisa su niente.
  scorta_minima_milli integer not null default 0 check (scorta_minima_milli >= 0),
  fornitore_id        uuid references fornitori(id),
  costo_ultimo_cent   integer check (costo_ultimo_cent is null or costo_ultimo_cent >= 0),
  attivo              boolean not null default true,
  creato_il           timestamptz not null default now(),
  creato_da           uuid references profili(id) default auth.uid(),

  constraint nome_articolo_non_vuoto check (length(trim(nome)) > 0)
);

create index if not exists idx_articoli_attivi on articoli (attivo, nome);


-- ============================================================
-- 3. I movimenti
-- ============================================================
-- Come per i conti e i pagamenti: **non esiste un contatore della giacenza**.
-- La giacenza è la somma dei movimenti (DEC-02), quindi non esiste il modo di
-- sbagliarla, di disallinearla o di doverla ricostruire.
--
-- I segni sono vincolati dal tipo, e non è pedanteria: un "carico" con
-- quantità negativa è un errore di battitura che sparisce dentro una somma e
-- non si trova più.

create table if not exists movimenti_magazzino (
  id                  uuid primary key default gen_random_uuid(),
  articolo_id         uuid not null references articoli(id),
  tipo                text not null
                      check (tipo in ('carico', 'scarico', 'rettifica', 'scarto')),
  quantita_milli      integer not null check (quantita_milli <> 0),
  costo_unitario_cent integer check (costo_unitario_cent is null or costo_unitario_cent >= 0),
  causale             text,
  -- Presente solo sugli scarichi automatici: dice quale riga di conto li ha
  -- provocati, e permette di risalire dalla giacenza al caffè che l'ha mossa.
  riga_conto_id       uuid references righe_conto(id),
  creato_il           timestamptz not null default now(),
  creato_da           uuid references profili(id) default auth.uid(),
  op_id               uuid not null unique default gen_random_uuid(),

  constraint segno_coerente_col_tipo check (
    (tipo = 'carico'                   and quantita_milli > 0) or
    (tipo in ('scarico', 'scarto')     and quantita_milli < 0) or
    -- La rettifica è l'unica che può andare in tutte e due le direzioni:
    -- l'inventario trova più o meno di quello che risultava.
    (tipo = 'rettifica')
  )
);

create index if not exists idx_movimenti_articolo
  on movimenti_magazzino (articolo_id, creato_il desc);
create index if not exists idx_movimenti_riga
  on movimenti_magazzino (riga_conto_id) where riga_conto_id is not null;

-- I movimenti sono immutabili, come tutti gli altri (DEC-03). Si sbaglia un
-- carico? Si aggiunge una rettifica. Correggere il movimento vecchio vorrebbe
-- dire cambiare la storia, e la storia è l'unica cosa che permette di capire
-- perché l'inventario non torna.
create or replace function blocca_modifica_movimento_magazzino()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Un movimento di magazzino non si modifica né si cancella: aggiungi una rettifica';
end;
$$;

drop trigger if exists trg_movimenti_magazzino_immutabili on movimenti_magazzino;
create trigger trg_movimenti_magazzino_immutabili
  before update or delete on movimenti_magazzino
  for each row execute function blocca_modifica_movimento_magazzino();


-- ============================================================
-- 4. La distinta base (T-33)
-- ============================================================
-- Quanto articolo consuma un prodotto venduto. Un cappuccino: 7 g di caffè
-- e 120 ml di latte, cioè `quantita_milli` 7 e 120.

create table if not exists composizioni (
  prodotto_id    uuid not null references prodotti(id) on delete cascade,
  articolo_id    uuid not null references articoli(id) on delete cascade,
  quantita_milli integer not null check (quantita_milli > 0),
  primary key (prodotto_id, articolo_id)
);


-- ============================================================
-- 5. v_giacenze (T-30, T-35)
-- ============================================================

create or replace view v_giacenze
with (security_invoker = on) as
select
  a.id,
  a.nome,
  a.unita,
  a.scorta_minima_milli,
  a.fornitore_id,
  f.nome                                     as fornitore,
  a.costo_ultimo_cent,
  coalesce(sum(m.quantita_milli), 0)         as giacenza_milli,
  coalesce(sum(m.quantita_milli), 0) <= a.scorta_minima_milli as sotto_scorta,
  -- Un articolo creato e mai caricato risulterebbe "sotto scorta" come uno
  -- appena finito. Sono due cose diverse: uno è da comprare, l'altro non è
  -- mai stato usato.
  count(m.id) = 0                            as mai_movimentato,
  max(m.creato_il) filter (where m.tipo = 'carico') as ultimo_carico_il
from articoli a
left join fornitori f            on f.id = a.fornitore_id
left join movimenti_magazzino m  on m.articolo_id = a.id
where a.attivo
group by a.id, a.nome, a.unita, a.scorta_minima_milli, a.fornitore_id, f.nome,
         a.costo_ultimo_cent;


-- ============================================================
-- 6. Lo scarico automatico (T-34)
-- ============================================================
-- Spento di partenza, e si accende consapevolmente.
--
-- PERCHÉ NON È ACCESO DI DEFAULT. In un bar il consumo reale diverge sempre
-- da quello teorico: sfridi, omaggi, il caffè venuto male, la dose a occhio.
-- Un magazzino automatico mai riconciliato produce numeri falsi **che sembrano
-- veri**, ed è peggio che non avere il magazzino — perché sui numeri falsi si
-- fanno gli ordini.

insert into impostazioni (chiave, valore, descrizione) values
  ('scarico_automatico', 'no',
   'Se le vendite scaricano il magazzino da sole. Va riconciliato con inventari periodici.')
on conflict (chiave) do nothing;

-- ------------------------------------------------------------
-- IL MAGAZZINO NON PUÒ BLOCCARE LA CASSA
-- ------------------------------------------------------------
-- Questo trigger sta su `righe_conto`, cioè sulla strada di ogni caffè
-- battuto. Se sollevasse un'eccezione — una distinta base scritta male, un
-- articolo cancellato, un vincolo violato — farebbe fallire l'inserimento
-- della riga, e con essa **l'intera conferma del conto**: la vendita andrebbe
-- persa con la fila davanti.
--
-- Quindi qualunque cosa vada storta qui dentro viene ingoiata. È una scelta
-- scomoda e va detta: un errore silenzioso nel magazzino si scopre solo
-- all'inventario. Ma l'alternativa è perdere una vendita, e fra un numero di
-- magazzino sbagliato e un caffè non registrato non c'è partita.
--
-- È anche il motivo per cui l'inventario (T-36) non è una funzione in più:
-- è la sola cosa che rimette in pari quello che qui può essere sfuggito.

create or replace function scarica_magazzino()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
       (select valore from public.impostazioni where chiave = 'scarico_automatico'),
       'no'
     ) <> 'si'
  then
    return null;
  end if;

  if new.prodotto_id is null then
    return null;
  end if;

  insert into public.movimenti_magazzino
    (articolo_id, tipo, quantita_milli, causale, riga_conto_id, creato_da)
  select
    c.articolo_id,
    -- Una riga stornata ha quantità negativa: la merce torna dentro. Non è
    -- un carico — non è stata comprata — è una rettifica, ed è quello che
    -- dice la causale.
    case when new.quantita > 0 then 'scarico' else 'rettifica' end,
    -(c.quantita_milli * new.quantita),
    case when new.quantita > 0
         then 'Venduto: ' || new.descrizione
         else 'Storno: ' || new.descrizione
    end,
    new.id,
    new.creato_da
  from public.composizioni c
  where c.prodotto_id = new.prodotto_id;

  return null;
exception
  when others then
    -- Vedi sopra: meglio una giacenza da riconciliare che una vendita persa.
    return null;
end;
$$;

revoke all on function scarica_magazzino() from public, anon;

drop trigger if exists trg_scarica_magazzino on righe_conto;
create trigger trg_scarica_magazzino
  after insert on righe_conto
  for each row execute function scarica_magazzino();


-- ============================================================
-- 7. Permessi
-- ============================================================
-- Anagrafiche e distinta base: le legge chiunque lavori, le cambia il
-- titolare. Sono decisioni di acquisto e di costo.
--
-- I movimenti invece **li inserisce anche un barista**: la bottiglia rotta la
-- rompe chi sta al banco, e se registrarla richiedesse il titolare non la
-- registrerebbe nessuno. Nessuno però li modifica o li cancella, titolare
-- compreso: ci pensa il trigger qui sopra.

alter table fornitori           enable row level security;
alter table articoli            enable row level security;
alter table movimenti_magazzino enable row level security;
alter table composizioni        enable row level security;

drop policy if exists "lettura fornitori"    on fornitori;
drop policy if exists "gestione fornitori"   on fornitori;
drop policy if exists "lettura articoli"     on articoli;
drop policy if exists "gestione articoli"    on articoli;
drop policy if exists "lettura movimenti"    on movimenti_magazzino;
drop policy if exists "scrittura movimenti"  on movimenti_magazzino;
drop policy if exists "lettura composizioni" on composizioni;
drop policy if exists "gestione composizioni" on composizioni;

create policy "lettura fornitori" on fornitori
  for select to authenticated using (true);
create policy "gestione fornitori" on fornitori
  for all to authenticated
  using (ruolo_corrente() = 'titolare') with check (ruolo_corrente() = 'titolare');

create policy "lettura articoli" on articoli
  for select to authenticated using (true);
create policy "gestione articoli" on articoli
  for all to authenticated
  using (ruolo_corrente() = 'titolare') with check (ruolo_corrente() = 'titolare');

create policy "lettura composizioni" on composizioni
  for select to authenticated using (true);
create policy "gestione composizioni" on composizioni
  for all to authenticated
  using (ruolo_corrente() = 'titolare') with check (ruolo_corrente() = 'titolare');

create policy "lettura movimenti" on movimenti_magazzino
  for select to authenticated using (true);
create policy "scrittura movimenti" on movimenti_magazzino
  for insert to authenticated with check (true);
