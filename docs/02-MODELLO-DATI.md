# Modello dati

> Specifica esecutiva. Lo SQL di questo documento è eseguibile così com'è nell'editor SQL di Supabase, nell'ordine in cui compare.
> Regole di fondo: importi in **centesimi interi**, movimenti **immutabili**, saldo **calcolato** (vedi DEC-02, DEC-03, DEC-04 in `01-VISIONE-E-DECISIONI.md`).

---

## 1. Mappa concettuale

```
profili (chi usa l'app)
   │
clienti ──┬── conti ── righe_conto ──> prodotti ── categorie
          │
          └── pagamenti

movimenti_cassa ── chiusure_giornaliere          [Fase 2]

fornitori ── articoli ── movimenti_magazzino     [Fase 3]
```

Il **saldo di un cliente** non è una colonna. È:

```
saldo = Σ(righe dei suoi conti) − Σ(suoi pagamenti)
```

Positivo = il cliente deve soldi. Zero = in pari. Negativo = ha un credito verso il bar (acconto).

## 2. Convenzioni valide per tutte le tabelle

| Convenzione | Regola |
|---|---|
| Nomi | italiano, minuscolo, plurale per le tabelle (`clienti`, `righe_conto`) |
| Chiave primaria | `id uuid` generato dal client, mai `serial` — serve per l'offline |
| Importi | `integer`, in centesimi, mai `numeric` o `float` |
| Date | `timestamptz`, sempre con fuso |
| Cancellazione | non si cancella: `attivo boolean` per l'anagrafica, storni per i movimenti |
| Idempotenza | ogni tabella di movimento ha `op_id uuid unique` generato dal dispositivo |
| Tracciabilità | `creato_da uuid` → `profili.id`, `creato_il timestamptz` |

### Perché l'id lo genera il client

Se l'identificativo lo assegnasse il database, un'operazione fatta offline non avrebbe un id finché non arriva al server — e l'interfaccia non potrebbe mostrarla, né collegarci altre righe. Con `uuid` generato sul telefono, la riga esiste subito in locale con il suo id definitivo, e la sincronizzazione è solo un invio.

### Perché `op_id`

Il barista tocca "aggiungi caffè", la rete è lenta, tocca di nuovo. Senza protezione arrivano due caffè. `op_id` è un identificativo unico dell'operazione: il secondo invio con lo stesso `op_id` viene rifiutato dal vincolo di unicità e l'app lo tratta come "già registrato". È la differenza tra un sistema di cui ci si fida e uno di cui non ci si fida.

---

## 3. SQL — Fase 1

### 3.1 Estensioni e funzioni di supporto

```sql
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
```

### 3.2 Profili utente

```sql
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
```

Il primo utente registrato diventa titolare, i successivi baristi. Evita di dover assegnare i ruoli a mano il primo giorno.

### 3.3 Clienti

```sql
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
```

`limite_credito_cent` è nullo per default: nessun limite. Quando valorizzato, l'app avvisa al superamento ma **non blocca** — bloccare un cliente storico davanti agli altri è socialmente inaccettabile in un bar, l'avviso serve al barista, non al cliente.

### 3.4 Categorie e prodotti

```sql
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
```

`preferito` alimenta la fascia in cima alla griglia. In un bar l'80% degli scontrini è fatto da 5 prodotti: quelli devono essere raggiungibili senza scorrere.

Un prodotto non si elimina mai: si mette `attivo = false`. Sparisce dalla griglia ma resta leggibile nello storico.

### Il modello a varianti

In un bar reale quasi ogni bevanda calda esiste in più versioni con prezzi diversi: normale, decaffeinato, alta digeribilità, alta digeribilità decaffeinato. Ci sono due modi di modellarlo, e la scelta ha conseguenze pesanti.

**Scartato: varianti come modificatori con sovrapprezzo.** Una tabella `modificatori` con "decaffeinato +0,10" applicato a runtime. Sembra elegante e non lo è: i sovrapprezzi non sono uniformi (l'alta digeribilità costa +0,30 sul cappuccino ma il caffè corretto non è un modificatore del caffè, è un altro prodotto a +0,50), e soprattutto il prezzo finale diventa il risultato di un calcolo. Un prezzo calcolato è un prezzo che può cambiare retroattivamente, contro DEC-05.

**Adottato: ogni combinazione vendibile è una riga con il suo prezzo.** `nome_base` + `variante` servono solo a **raggruppare nell'interfaccia**: la griglia mostra un riquadro per `nome_base`, e l'interruttore delle varianti sceglie quale riga viene effettivamente addebitata. Il database resta piatto e ogni prezzo è scritto, non calcolato.

Conseguenze pratiche:

- Ritoccare il prezzo del decaffeinato non tocca il normale, ed è giusto così.
- Le statistiche di vendita funzionano senza gestire casi particolari.
- La griglia resta piccola (un riquadro per bevanda) anche con 40 righe a catalogo.

`variante` è testo libero con valori convenzionali: `normale`, `decaffeinato`, `alta digeribilità`, `alta digeribilità decaffeinato`, `ginseng`. Non è un `check` vincolato, perché ogni bar ne inventa di nuove e un vincolo qui costerebbe una migrazione ogni volta.

```sql
-- Prodotti raggruppati per la griglia: una riga per bevanda, varianti in array
create or replace view v_griglia_prodotti
with (security_invoker = on) as
select
  p.nome_base,
  c.nome    as categoria,
  c.colore  as categoria_colore,
  c.ordine  as categoria_ordine,
  min(p.ordine)                                as ordine,
  bool_or(p.preferito)                         as preferito,
  min(p.prezzo_cent)                           as prezzo_da_cent,
  count(*) > 1                                 as ha_varianti,
  jsonb_agg(
    jsonb_build_object('id', p.id, 'variante', p.variante, 'prezzo_cent', p.prezzo_cent)
    order by p.prezzo_cent
  ) as varianti
from prodotti p
left join categorie c on c.id = p.categoria_id
where p.attivo
group by p.nome_base, c.nome, c.colore, c.ordine;
```

### 3.5 Conti

```sql
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
```

**`cliente_id` può essere nullo:** è la consumazione al banco pagata subito, senza anagrafica.

**Un solo conto aperto per cliente:** garantito dal database, non dall'applicazione. Se due dispositivi provano a creare un conto per Mario nello stesso momento, uno dei due fallisce e l'app usa quello esistente. Senza questo vincolo il credito di un cliente si spezzerebbe su conti paralleli.

`tavolo` esiste ma non è usato in Fase 1 (vedi §4 di `01-VISIONE-E-DECISIONI.md`).

### 3.6 Righe di conto

```sql
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

-- una riga può essere stornata una volta sola
create unique index idx_storno_unico on righe_conto (storno_di)
  where storno_di is not null;
```

Tre punti che meritano attenzione:

**`descrizione` e `prezzo_unitario_cent` sono copiati, non letti dal prodotto.** È DEC-05: il prezzo si congela. `prodotto_id` resta solo come collegamento per le statistiche, e può diventare nullo se il prodotto viene eliminato davvero dal database — la riga resta comunque leggibile.

**`importo_cent` è una colonna calcolata.** Il database la ricava da quantità × prezzo. Non può essere sbagliata perché nessuno la scrive.

**Lo storno è una riga con quantità negativa** che punta all'originale. Sommando tutte le righe il risultato è corretto senza casi particolari, e lo storico mostra sia l'errore che la correzione.

### 3.7 Pagamenti

```sql
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

create unique index idx_storno_pagamento_unico on pagamenti (storno_di)
  where storno_di is not null;
```

`conto_id` nullo significa **acconto generico**: il cliente dà 20 € senza specificare quale conto sta saldando. È il caso normale del cliente a credito, ed è il motivo per cui il saldo si calcola sul cliente e non sul singolo conto.

Non esiste una logica di "imputazione" automatica degli acconti ai conti più vecchi: complicherebbe il modello per nessun beneficio pratico. Il saldo complessivo è l'unico numero che conta; l'ordine cronologico dei conti serve solo a mostrare da quanto tempo pende il debito.

### 3.8 Viste di lettura

```sql
-- Saldo e stato di ogni cliente
create or replace view v_saldo_clienti
with (security_invoker = on) as
select
  c.id,
  c.nome,
  c.soprannome,
  c.telefono,
  c.limite_credito_cent,
  c.attivo,
  coalesce(a.addebitato_cent, 0)                        as addebitato_cent,
  coalesce(p.pagato_cent, 0)                            as pagato_cent,
  coalesce(a.addebitato_cent, 0) - coalesce(p.pagato_cent, 0) as saldo_cent,
  a.primo_movimento_il,
  p.ultimo_pagamento_il,
  greatest(a.ultimo_movimento_il, p.ultimo_pagamento_il) as ultimo_movimento_il,
  case
    when coalesce(a.addebitato_cent, 0) - coalesce(p.pagato_cent, 0) <= 0
      then null
    else extract(day from
           now() - coalesce(p.ultimo_pagamento_il, a.primo_movimento_il)
         )::int
  end as giorni_debito
from clienti c
left join (
  select
    co.cliente_id,
    sum(r.importo_cent)  as addebitato_cent,
    min(r.creato_il)     as primo_movimento_il,
    max(r.creato_il)     as ultimo_movimento_il
  from conti co
  join righe_conto r on r.conto_id = co.id
  where co.cliente_id is not null
  group by co.cliente_id
) a on a.cliente_id = c.id
left join (
  select
    cliente_id,
    sum(importo_cent) as pagato_cent,
    max(creato_il)    as ultimo_pagamento_il
  from pagamenti
  where cliente_id is not null
  group by cliente_id
) p on p.cliente_id = c.id;
```

**Come si conta l'anzianità di un debito.** La definizione ovvia — "giorni dal primo addebito" — è sbagliata per il cliente storico: chi viene tutti i giorni da tre anni e paga puntualmente ogni mese risulterebbe con 1.100 giorni di debito.

La definizione corretta sarebbe "giorni dal più vecchio addebito non ancora coperto dai pagamenti", ma calcolarla richiede un saldo progressivo riga per riga, costoso e difficile da spiegare.

`giorni_debito` è quindi definito come **giorni trascorsi dall'ultimo pagamento** (o dal primo movimento, se il cliente non ha mai pagato). È leggermente ottimistico — un acconto di 5 € azzera il contatore — ma corrisponde alla domanda che il titolare si pone davvero: *da quanto tempo questa persona non mette mano al portafoglio?*

```sql
-- Conti attualmente aperti, con totale corrente
create or replace view v_conti_aperti
with (security_invoker = on) as
select
  co.id,
  co.numero,
  co.cliente_id,
  cl.nome         as cliente_nome,
  cl.soprannome   as cliente_soprannome,
  co.tavolo,
  co.aperto_il,
  coalesce(sum(r.importo_cent), 0) as totale_cent,
  count(r.id)                      as n_righe
from conti co
left join clienti cl     on cl.id = co.cliente_id
left join righe_conto r  on r.conto_id = co.id
where co.stato = 'aperto'
group by co.id, co.numero, co.cliente_id, cl.nome, cl.soprannome, co.tavolo, co.aperto_il;
```

```sql
-- Estratto conto: tutti i movimenti di un cliente in ordine cronologico
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
  (r.storno_di is not null)       as e_storno
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
  (p.storno_di is not null)
from pagamenti p
where p.cliente_id is not null;
```

Nota sull'estratto conto: i pagamenti compaiono con **importo negativo**, così che la somma progressiva della colonna dia il saldo a ogni riga. È la stessa convenzione di un estratto conto bancario.

### `security_invoker = on` non è un dettaglio

Ogni vista di questo progetto va creata con quell'opzione. Senza, una vista gira con i permessi di **chi l'ha creata** — l'amministratore — e non di chi la interroga. Conseguenza pratica: le viste scavalcano la Row Level Security delle tabelle sottostanti, e chiunque abbia la chiave `anon` può leggere `v_saldo_clienti` e vedere i debiti di tutti i clienti, RLS o no.

È il difetto che il Security Advisor di Supabase segnala come **"Security Definer View — CRITICAL"**, ed è particolarmente insidioso perché il database *sembra* protetto: le tabelle hanno RLS attiva e le policy sono a posto. La falla sta nel passaggio intermedio.

Con `security_invoker = on` la vista eredita i permessi di chi la interroga, quindi le regole delle tabelle valgono anche attraverso di lei.

### 3.9 Sicurezza (RLS)

```sql
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

-- FASE 1: chiunque sia autenticato e attivo può operare
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
```

**Una sola policy per tabella, non due.** La prima stesura aveva una policy `for select` accanto a una `for all`: ma `for all` include già la lettura, quindi Postgres si trovava due policy permissive sovrapposte da valutare a ogni riga. Il Security Advisor lo segnala come *Multiple Permissive Policies*. Una sola fa esattamente la stessa cosa.

**`set search_path = ''` su tutte le funzioni.** Una funzione che non fissa il percorso di ricerca risolve i nomi delle tabelle consultando la configurazione di chi la chiama; chi riesce a manipolare quel percorso può dirottare la funzione su tabelle diverse da quelle previste. Fissandolo a stringa vuota e scrivendo `public.conti` invece di `conti`, il problema non si pone. È il *Function Search Path Mutable* dell'advisor.

**`(select auth.uid())` invece di `auth.uid()`.** Scritta nuda, la funzione viene rieseguita per ogni riga esaminata; racchiusa in una sottoquery viene calcolata una volta sola. Su `profili` non cambia niente, ma è l'abitudine giusta da prendere prima che le tabelle crescano.

> **Fase 4** sostituirà queste policy con regole per ruolo: il barista non vede i report economici, non modifica il listino, non cancella righe altrui. Le policy sono scritte ora in forma permissiva ma **RLS è già attiva**: attivarla dopo, su un database con dati veri, è molto più rischioso.

### 3.10 Regola anti-cancellazione

```sql
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
```

Questa regola vive nel database, non nell'applicazione. Un vincolo che sta solo nel codice dell'app è un vincolo che prima o poi qualcuno aggira.

### 3.11 Dati iniziali

Il listino reale del locale, con lo SQL di caricamento pronto, sta in **`07-LISTINO.md`**. Va eseguito dopo lo schema.

---

## 4. SQL — Fase 2 (cassa)

> Da eseguire solo quando la Fase 1 è in uso da almeno due settimane.

```sql
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
```

```sql
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
```

La differenza di cassa è una colonna calcolata: non si può sbagliare la sottrazione.

---

## 5. SQL — Fase 3 (magazzino)

> Da eseguire solo dopo che la Fase 2 è stabile.

```sql
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
```

```sql
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
```

**Convenzione dei segni:** i carichi hanno quantità positiva, gli scarichi negativa. La giacenza è la somma. Come per il saldo dei clienti, non esiste un contatore da aggiornare — quindi non esiste il modo di sbagliarlo (DEC-02).

Lo **scarico automatico** alla vendita è opzionale e va attivato consapevolmente: in un bar il consumo reale diverge sempre da quello teorico (sfridi, omaggi, errori), quindi le giacenze automatiche vanno riconciliate con inventari periodici tramite movimenti di tipo `rettifica`. Un magazzino automatico mai riconciliato produce numeri falsi che sembrano veri, che è peggio di non avere il magazzino.

---

## 6. Query di riferimento per l'applicazione

Queste sono le interrogazioni che l'app usa più spesso. Vanno implementate esattamente così.

```sql
-- Chi mi deve soldi, dal debito più vecchio
select * from v_saldo_clienti
where saldo_cent > 0
order by giorni_debito desc nulls last, saldo_cent desc;

-- Totale credito in giro
select sum(saldo_cent) as credito_totale_cent
from v_saldo_clienti where saldo_cent > 0;

-- Estratto conto di un cliente con saldo progressivo
select
  data, tipo, descrizione, quantita, importo_cent, e_storno,
  sum(importo_cent) over (order by data, movimento_id) as saldo_progressivo_cent
from v_estratto_conto
where cliente_id = $1
order by data desc;

-- Griglia prodotti raggruppata per bevanda (preferiti in cima)
select * from v_griglia_prodotti
order by preferito desc, categoria_ordine nulls last, ordine;

-- Ricerca cliente digitando
select id, nome, soprannome, telefono
from clienti
where attivo
  and (nome ilike $1 || '%' or soprannome ilike $1 || '%')
order by nome
limit 10;
```

---

## 7. Checklist prima di considerare lo schema pronto

- [ ] Lo SQL della Fase 1 gira su Supabase senza errori, nell'ordine del documento
- [ ] `insert` di una riga con `op_id` già esistente viene rifiutato
- [ ] Un secondo conto aperto per lo stesso cliente viene rifiutato
- [ ] La cancellazione di una riga di 5 minuti fa viene rifiutata
- [ ] La cancellazione di un pagamento viene sempre rifiutata
- [ ] `v_saldo_clienti` restituisce 0 per un cliente che ha pagato tutto
- [ ] Uno storno riporta il saldo al valore corretto
- [ ] Cambiare il prezzo di un prodotto non altera le righe già inserite

---

**Prossimo documento:** `03-ARCHITETTURA.md`
