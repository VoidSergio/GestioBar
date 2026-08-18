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

**Un cliente si cancella solo se non ha lasciato tracce.** `conti.cliente_id` non ha `on delete cascade`: Postgres rifiuta di cancellare un cliente che ha anche un solo conto, e questa è la protezione che conta, perché vale anche se un domani qualcuno tocca le policy. L'app decide prima quale delle due strade prendere (`comeRimuovereCliente` in `lib/dominio/clienti.ts`), così può spiegarlo invece di mostrare un errore di chiave esterna:

- **nessun movimento** — un doppione, un nome scritto male, una prova: si cancella davvero;
- **con movimenti** — si mette `attivo = false`. Sparisce dagli elenchi, l'estratto conto resta (DEC-03).

Il permesso di `delete` su `clienti` è riservato al titolare da `0010_cancellazione_cliente.sql`. RLS non dà errore quando vieta: restituisce zero righe toccate, quindi chi cancella deve controllare `count` e non solo `error`.

**Una riga si storna anche in parte.** Fino alla 0013 `idx_storno_unico` imponeva un solo storno per riga: con lo storno "tutto o niente" era la regola giusta. Serve però spostare una consumazione da un cliente a un altro — Luca offre a Michele uno dei tre caffè — e di storni parziali sulla stessa riga ce ne possono essere più d'uno. L'invariante che conta non era "una volta sola", era **non si storna più di quanto è stato venduto**: adesso la garantisce il trigger `trg_storni_non_eccedono`, che somma gli storni già fatti e rifiuta quello di troppo. Uno storno di uno storno resta vietato.

**Spostare una consumazione non modifica niente.** È uno storno parziale sul conto di chi cede più un conto nuovo intestato a chi offre, con descrizione e prezzo **copiati dalla riga originale** (DEC-05): se il listino è cambiato nel frattempo, spostare un caffè non ne cambia il prezzo. Entrambi i movimenti restano visibili sui rispettivi estratti conto, ed è per questo che l'operazione si disfa spostando indietro invece che con un `delete`.

**`cliente_id` può essere nullo:** è la consumazione al banco pagata subito, senza anagrafica.

**Un solo conto aperto per cliente:** garantito dal database, non dall'applicazione. Se due dispositivi provano a creare un conto per Mario nello stesso momento, uno dei due fallisce e l'app usa quello esistente. Senza questo vincolo il credito di un cliente si spezzerebbe su conti paralleli.

**`stato` dice se il conto si sta ancora battendo, non se è stato pagato.** Con DEC-08 la composizione avviene in una bozza locale, quindi un conto che arriva al database è già finito: `salva_conto` lo scrive sempre con `stato = 'chiuso'`, anche quando è lasciato a credito. Il debito si legge da `v_saldo_clienti` (righe meno pagamenti), mai dallo stato del conto.

Di conseguenza, in Fase 1 `idx_un_conto_aperto_per_cliente` e la vista `v_conti_aperti` non entrano mai in gioco: restano per la Fase 4, quando le bozze si sposteranno sul server e torneranno `apri_conto` e `aggiungi_riga`. Scrivere i conti a credito come `'aperto'` faceva fallire il secondo conto dello stesso cliente contro quell'indice.

**Gli orari li fissa il dispositivo, non il server.** `conti.aperto_il`, `conti.chiuso_il`, `righe_conto.creato_il` e `pagamenti.creato_il` viaggiano dentro l'operazione `salva_conto` con il valore preso al banco. Il default `now()` resta come rete di sicurezza, ma non è quello che si usa: offline segnerebbe il momento in cui la coda si svuota, e i caffè delle sette risulterebbero venduti a mezzogiorno. Per le righe l'orario è quello del **primo** pezzo della voce: due caffè sono una riga ×2, e conta quando è cominciata l'ordinazione.

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

### 4.1 Correzione richiesta dal titolare — l'unità è il turno, non la giornata

Lo schema qui sopra è **da rifare prima di eseguirlo**. Dà per scontato che si chiuda una volta
al giorno: `chiusure_giornaliere` ha `giornata date not null unique`. Nel locale vero i turni
sono più d'uno, ogni barista fa la sua lettura quando smonta, lascia il fondo cassa al collega e
ritira il resto. Con un `unique` sulla giornata, il secondo turno non può chiudere.

**Il modello giusto è `chiusure_turno`**, senza vincolo di unicità sulla data, con l'ora di
inizio e di fine. La giornata **non si memorizza**: è la somma dei turni che ricadono in quel
giorno, ed è la stessa ragione per cui il saldo non si memorizza (DEC-02). Un totale giornaliero
scritto da qualche parte diverge il giorno in cui un turno viene corretto.

**Un turno non si apre.** Comincia dove è finito il precedente. Un pulsante "apri turno" è un
pulsante che qualcuno dimentica di premere a fine servizio, e da lì in poi i conti sono sbagliati
per tutti quelli dopo. L'unico pulsante è **chiudi turno**.

**Il fondo cassa è un'impostazione, non un numero da ribattere ogni volta.** Se un turno ne
lascia uno diverso, quello è un fatto da registrare, non da assorbire in silenzio.

**Che cosa deve stare fuori dalla riconciliazione del cassetto.** È il punto in cui un gestionale
per bar sbaglia, e vale la pena scriverlo prima di avere il codice: il cassetto si riconcilia con
i **movimenti di contante**, non con il venduto. In un locale che segna, le due cose non
coincidono mai.

- Gli incassi con **carta** non sono mai entrati nel cassetto. Vanno mostrati, ma separati e
  detti tali, o chi conta li cerca fra le banconote.
- Il **credito concesso** nel turno non è denaro mancante: è merce uscita che si paga dopo. Se
  compare vicino al conteggio, chi chiude farà la sottrazione sbagliata.
- I **crediti rientrati in contanti** durante il turno **sono** nel cassetto e vanno contati,
  anche se non sono vendite di oggi. È l'errore speculare del precedente. Il titolare ha però
  chiesto di **non mostrarli su una riga a parte**: entrano dentro "incassato in contanti" e
  basta. Chi chiude deve confrontare due numeri, non leggerne quattro.

Da cui la regola della schermata: **atteso nel cassetto = fondo + incassato in contanti**, dove
"incassato in contanti" comprende i crediti rientrati e non comprende nulla di ciò che è uscito a
credito. La parola *venduto* non deve comparire in quella schermata.

**Dipendenza da non ignorare.** "Il collega che smonta" presuppone che i colleghi abbiano un
accesso ciascuno, e quello è T-41, Fase 4. Con un solo utente la chiusura di turno funziona lo
stesso, ma non sa dire *chi* ha chiuso — e senza quel nome la lettura di cassa serve a metà.
Si decide a T-22: o si anticipa T-41, o si mette un campo con il nome di chi chiude, che è brutto
ma non richiede la Fase 4.

### 4.2 Come si svolge un turno — esempio con fondo cassa 80 €

**Per cominciare un turno non si fa niente.** Zero tap. Il turno comincia da solo dove è finito
il precedente: si arriva, si trovano 80 € nel cassetto, si lavora. L'unica cosa da guardare è che
il fondo sia davvero 80 — ma quello è il lavoro di chi ha chiuso prima, non di chi apre.

**Per finire si fa una cosa sola:** Altro → *Chiudi turno*, si contano i soldi, si scrive quanto
c'è. Poi si ritira quello che l'app dice e si lasciano 80.

#### Turno del mattino, 6:00 → 13:00

Nel turno sono stati battuti 412,00 € di consumazioni: 231,50 pagati subito in contanti, 96,00
con la carta, 84,50 lasciati a credito. Più 45,00 di vecchi debiti saldati in contanti da due
clienti.

```
CHIUSURA TURNO                      6:00 → 13:00

Fondo cassa                             80,00
Incassato in contanti                  276,50
────────────────────────────────────────────────
Atteso nel cassetto                    356,50

Contato nel cassetto              [   355,00 ]
────────────────────────────────────────────────
Differenza                            − 1,50

RITIRA                                 275,00
LASCIA IN CASSA                         80,00

Non è nel cassetto: 96,00 con carta · 84,50 a credito
```

I 45,00 di crediti rientrati stanno dentro i 276,50 e non compaiono da nessuna parte, come
chiesto. I 412,00 di venduto non compaiono affatto: non servono a chi conta i soldi, e messi lì
farebbero fare la sottrazione sbagliata.

Mancano 1,50. Si annota la causale e si va a casa: la differenza si registra, non si aggiusta.

#### Turno della sera, 13:00 → 20:30

Comincia da solo alle 13:00, nel cassetto ci sono gli 80 lasciati dal collega. Incassato in
contanti 189,00, con la carta 54,00, a credito 60,00.

```
Fondo cassa                             80,00
Incassato in contanti                  189,00
────────────────────────────────────────────────
Atteso nel cassetto                    269,00
Contato nel cassetto              [   269,00 ]
────────────────────────────────────────────────
Differenza                               0,00

RITIRA                                 189,00
LASCIA IN CASSA                         80,00
```

#### La giornata

**Non c'è un pulsante "chiusura giornaliera".** L'ultima chiusura di turno della sera *è* la
chiusura della giornata: sotto il riepilogo del turno l'app aggiunge quello del giorno, che è la
somma dei turni e non viene scritto da nessuna parte.

```
GIORNATA — 8 agosto

Incassato in contanti                  465,50
Incassato con carta                    150,00
Lasciato a credito                     144,50
Differenza di cassa                    − 1,50
Ritirato in totale                     464,00
```

Gli 80 € restano nel cassetto per domattina. Se invece vanno in cassaforte, il fondo si registra
come prelievo e si rimette il mattino dopo — ma è una scelta del locale, non del sistema.

**Se qualcuno dimentica di chiudere**, il turno dopo si porta dietro il precedente e i conti di
due persone si mescolano. Non è impedibile, ma è rendibile evidente: la schermata mostra sempre
**da quando** è aperto il turno, e un turno che risulta cominciato ieri sera si vede al primo
sguardo.

---

## 4.3 Le viste dei report (T-23, T-25, T-26)

`0018_report.sql`. **Nessuna tabella nuova**: sono quattro letture su `righe_conto` e `pagamenti`,
che registrano già tutto quello che serve — la descrizione e il prezzo congelati sulla riga
(DEC-05) e `creato_il` al secondo. Se una vista risultasse sbagliata si riscrive e si rilegge,
senza migrare niente e senza rischiare un dato.

| Vista | Una riga per | A cosa serve |
|---|---|---|
| `v_giornata` | giornata di calendario | quanto è uscito, quanto è entrato, quanto credito si è mosso |
| `v_venduto_prodotto` | giornata × nome di prodotto | che cosa esce, e che cosa non esce |
| `v_classifica_clienti` | cliente | chi consuma e chi paga, mese corrente e sempre |
| `v_ore_di_punta` | giorno della settimana × ora | quando si lavora davvero, ultimi 90 giorni |

### I quattro numeri di `v_giornata` non si sommano fra loro

```
venduto           merce uscita dal bar, pagata o no
incassato         soldi entrati, per qualunque motivo
credito_concesso  venduto rimasto da pagare
credito_rientrato soldi entrati per saldare debiti vecchi
```

Le identità che li legano, verificate a ogni `npm run verifica:migrazioni`:

```
incassato = incassato_su_conti + credito_rientrato
venduto   = incassato_su_conti + credito_concesso
```

Da cui **venduto − incassato = credito_concesso − credito_rientrato**. Cioè la differenza fra
quello che è uscito e quello che è entrato non è un ammanco: è di quanto è cresciuto il credito in
giro. È il numero che spiega perché una giornata da 400 € di consumazioni può chiudere con 250 €
in cassa senza che manchi niente — e senza quella riga scritta a schermo, quella differenza si
cerca per mezz'ora.

### Gli storni non hanno bisogno di nessun filtro

Una riga stornata ha `quantita < 0` per vincolo di schema (§3.6) e uno storno di pagamento ha
`importo_cent < 0` (§3.7). Le somme sono già nette.

**Non scrivere `where storno_di is null`.** Toglierebbe lo storno lasciando dentro la riga
sbagliata: il contrario di quello che serve, e con un risultato che sembra plausibile.

### La giornata e il turno sono due tagli diversi

`v_giornata` legge i **movimenti** e taglia a mezzanotte. `v_riepilogo_giornata` (§4.1) somma le
**chiusure di turno**, cioè quanto è stato dichiarato contando il cassetto, e un turno può
scavalcare la mezzanotte. Servono a due cose diverse — la cassa si quadra per turno, il venduto si
legge per giornata — e **non vanno confrontati riga per riga**.

Il fuso è scritto nella vista (`at time zone 'Europe/Rome'`) e non ereditato dalla sessione: la
giornata di un bar dev'essere la stessa vista dal telefono, dal browser e da uno script.

### Il buco: il banco

`v_classifica_clienti` vede solo i conti intestati, perché quelli anonimi non hanno un cliente. In
un bar sono spesso la maggioranza del giro, e da quando la schermata di apertura è la griglia
(04-UX-MOBILE §3) lo sono ancora di più. La classifica risponde a *"chi fra i clienti che conosco
consuma di più"*, **non** a *"da dove vengono i miei soldi"*. La schermata lo scrive, altrimenti il
totale sembra un errore di conto.

`v_venduto_prodotto` invece li comprende tutti: quello che esce esce, che sia segnato o pagato
subito.

---

## 5. SQL — Fase 3 (magazzino)

Lo schema vero è `0020_magazzino.sql`. La bozza che stava qui — e in
`0006_fase3_magazzino.sql`, mai eseguito — teneva le quantità in
`numeric(10,3)`, ed è stata riscritta.

### Le quantità sono interi in millesimi

Dentro Postgres `numeric` sarebbe stato esatto. Il problema comincia quando quel numero **esce**:
PostgREST lo consegna a JavaScript, dove il decimale esatto non esiste — 0,1 + 0,2 non fa 0,3.

Un caffè scarica 7 g di grani. Duecento caffè al giorno per un mese sono seimila somme, e la
giacenza comincia a finire con `,00000000004`. Poi la si confronta con l'inventario contato a mano
e non torna mai, e nessuno capisce perché.

È la stessa ragione per cui il denaro sta in centesimi interi (DEC-04). L'unità è il **millesimo**:
un grammo, un millilitro, un millesimo di pezzo. `1250` vuol dire 1,250 kg. Tre decimali bastano —
sotto il grammo, in un bar, non c'è niente da pesare.

Le funzioni stanno in `lib/dominio/magazzino.ts` e **non dividono mai**: la virgola si mette
tagliando le ultime tre cifre dell'intero, come fa `centesimiInCampo` con i centesimi.

### Le tabelle

| Tabella | Che cos'è |
|---|---|
| `fornitori` | da chi si compra |
| `articoli` | **quello che si compra**: il caffè in grani, il latte, i bicchieri |
| `movimenti_magazzino` | carichi, scarichi, scarti, rettifiche |
| `composizioni` | la distinta base: quanto articolo consuma un prodotto venduto |

Un articolo non è un prodotto: il prodotto è quello che si vende, l'articolo quello che si compra.
Il legame è `composizioni` — un cappuccino: 7 g di grani e 120 ml di latte.

### La giacenza è la somma dei movimenti

Come il saldo dei clienti: **non esiste un contatore** (DEC-02), quindi non esiste il modo di
sbagliarlo, di disallinearlo o di doverlo ricostruire. `v_giacenze` somma e basta.

I segni sono vincolati al tipo (`segno_coerente_col_tipo`): un carico è positivo, uno scarico e uno
scarto sono negativi, e solo la rettifica può andare in tutte e due le direzioni — perché
l'inventario trova più o meno di quello che risultava. Un "carico" con quantità negativa scritto per
errore sparirebbe dentro una somma e non si troverebbe più.

I movimenti sono **immutabili** come tutti gli altri (DEC-03): un carico sbagliato si corregge con
una rettifica, non riscrivendolo. La storia è l'unica cosa che permette di capire perché
l'inventario non torna.

### Lo scarico automatico non può bloccare la cassa

Il trigger `scarica_magazzino()` sta su `righe_conto`, cioè sulla strada di ogni caffè battuto. Se
sollevasse un'eccezione — una distinta base scritta male, un articolo cancellato — farebbe fallire
l'inserimento della riga e con essa **l'intera conferma del conto**: la vendita andrebbe persa con
la fila davanti.

Quindi qualunque cosa vada storta lì dentro viene ingoiata. È scomodo e va detto: un errore
silenzioso nel magazzino si scopre solo all'inventario. Ma fra un numero di magazzino sbagliato e
un caffè non registrato non c'è partita.

È anche il motivo per cui **l'inventario non è una funzione in più**: è la sola cosa che rimette in
pari quello che lì può essere sfuggito.

### Perché nasce spento

`impostazioni.scarico_automatico` vale `'no'` di partenza. In un bar il consumo reale diverge sempre
da quello teorico: sfridi, omaggi, il caffè venuto male, la dose a occhio. Un magazzino automatico
mai riconciliato produce numeri falsi **che sembrano veri**, ed è peggio che non avere il magazzino
— perché sui numeri falsi si fanno gli ordini.

### L'inventario registra la differenza, non il contato

I movimenti si sommano. Un "contato 1 kg" scritto come movimento aggiungerebbe un chilo a quello che
risultava già. La differenza la calcola `differenzaInventario` in `lib/dominio/magazzino.ts`, che ha
i test intorno proprio perché è l'errore facile da fare.

### Chi può fare cosa

Anagrafiche e distinta base le cambia il **titolare**: sono decisioni di acquisto e di costo. I
movimenti invece li inserisce **anche un barista** — la bottiglia rotta la rompe chi sta al banco, e
se registrarla richiedesse il titolare non la registrerebbe nessuno. Nessuno li modifica o li
cancella, titolare compreso.

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
