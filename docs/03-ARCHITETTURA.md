# Architettura tecnica

> Specifica esecutiva. Stack, struttura del progetto, strategia offline, deploy.
> Le motivazioni delle scelte stanno in `01-VISIONE-E-DECISIONI.md`.

---

## 1. Stack

Versioni effettivamente installate e verificate (build, test e lint passano):

| Livello | Scelta | Versione | Perché |
|---|---|---|---|
| Framework | **Next.js** (App Router, Turbopack) | 16.3 | React con routing e build già risolti, ecosistema ampio |
| Linguaggio | **TypeScript** strict | 5.9 | Il compilatore intercetta gli errori sui centesimi e sugli id prima che diventino bug contabili |
| Database | **Supabase** (Postgres) | supabase-js 2.112, ssr 0.12 | Vedi DEC-01. Include auth e realtime |
| Stato server | **TanStack Query** | 5.101 | Cache, retry, invalidazione e aggiornamento ottimistico: è il pezzo che rende l'app veloce anche su rete lenta |
| Persistenza locale | **IndexedDB** via `idb` | 8.0 | Copia locale dei dati e coda di scrittura |
| Stile | **Tailwind CSS** | 4.3 | Velocità di sviluppo, controllo preciso dei bersagli di tocco |
| Validazione | **Zod** | 4.4 | Un solo punto di verità per le forme dei dati |
| Test | **Vitest** | 4.1 | Veloce, senza configurazione, gira sui moduli di dominio |
| Hosting | **Netlify** | plugin-nextjs 5.15 | Il repository era già collegato lì; vedi §11 per le conseguenze |

### Due scelte cambiate rispetto alla prima stesura

**Tailwind 4 non usa più `tailwind.config.ts`.** La configurazione sta nel CSS, dentro `@theme` in `app/globals.css`. Un file in meno e la palette vive accanto agli stili che la usano.

**Niente `@ducanh2912/next-pwa` per ora.** Il manifest e le icone ci sono già; il service worker arriva con T-17, quando si decide cosa mettere davvero in cache. Aggiungere un service worker prima di avere schermate da mettere in cache complica soltanto il debug.

**shadcn/ui non è ancora installato.** Si aggiunge quando serve il primo componente vero (dialog, sheet), non prima: `npx shadcn@latest init`.

### Alternative valutate

**SvelteKit** sarebbe più leggero all'esecuzione, che su telefoni datati conta. Scartato perché l'ecosistema React ha molto più materiale a cui un agente AI può attingere, e questo progetto verrà costruito in buona parte da un agente. La differenza di prestazioni è recuperabile con attenzione al bundle; la differenza di supporto no.

**React Native / Expo** darebbe accesso a stampanti bluetooth e notifiche native. Scartato per la Fase 1: la distribuzione degli aggiornamenti è molto più lenta e non serve hardware.

---

## 2. Struttura del progetto

Albero verificato sul codice al 6 agosto 2026. Le voci con 🔜 non esistono ancora e portano il task che le farà nascere.

```
gestionale-bar/
├── app/
│   ├── layout.tsx                  shell, metadata, PWA
│   ├── globals.css                 palette e regole di base (@theme Tailwind 4)
│   ├── page.tsx                    HOME: conti aperti, credito in giro
│   ├── login/
│   │   ├── page.tsx                schermata di accesso
│   │   ├── modulo-accesso.tsx      form (client)
│   │   └── azioni.ts               accedi() ed esci()
│   ├── conto/[id]/page.tsx         composizione del conto
│   ├── clienti/
│   │   ├── page.tsx                elenco, ricerca, creazione
│   │   └── [id]/page.tsx           scheda: saldo, estratto conto, incassa
│   ├── crediti/page.tsx            chi deve soldi, per anzianità
│   ├── scontrini/page.tsx          battuto e non battuto, per giornata
│   ├── altro/page.tsx              quarta scheda della tab bar
│   └── listino/page.tsx            🔜 T-16
│
├── components/
│   ├── conto/
│   │   ├── schermata-conto.tsx     griglia + righe + barra azioni
│   │   ├── griglia-prodotti.tsx    riquadri per categoria
│   │   ├── pannello-varianti.tsx   ▾ e pressione prolungata
│   │   ├── righe-conto.tsx         voci raggruppate con − e +
│   │   └── pannello-pagamento.tsx  chiusura conto (04-UX §6)
│   ├── clienti/
│   │   ├── elenco-clienti.tsx
│   │   ├── scheda-cliente.tsx      saldo, movimenti, azioni
│   │   ├── modulo-nuovo-cliente.tsx
│   │   ├── ricerca-cliente.tsx     selettore per aprire un conto
│   │   ├── pannello-incasso.tsx    incasso di un debito maturato
│   │   └── pannello-rimozione.tsx  cancella o disattiva (solo titolare)
│   ├── crediti/
│   │   ├── elenco-crediti.tsx
│   │   └── pannello-sollecito.tsx  messaggio modificabile prima dell'invio
│   ├── scontrini/
│   │   └── elenco-scontrini.tsx
│   └── shell/
│       ├── provider-dati.tsx       TanStack Query + ripristino cache
│       ├── barra-navigazione.tsx   tab bar: Conti, Clienti, Crediti, Altro
│       ├── menu-altro.tsx          contenuto della quarta scheda
│       ├── home-conti.tsx          la home
│       ├── indicatore-sync.tsx     pallino verde/ambra/rosso
│       ├── avviso-lettura.tsx      perché una lettura non è riuscita
│       └── pulsante-esci.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               client lato browser
│   │   ├── server.ts               client lato server (SSR)
│   │   ├── configurazione.ts       lettura .env con errori in italiano
│   │   ├── sessione.ts             rinnovo sessione (proxy)
│   │   ├── accesso.ts              richiediAccesso() per le pagine
│   │   └── tipi.ts                 scritti a mano, rigenerabili da Supabase CLI
│   ├── offline/
│   │   ├── db.ts                   schema IndexedDB (cache, coda, bozze)
│   │   ├── cache-query.ts          salva/ripristina la cache
│   │   ├── bozze.ts                deposito delle bozze (DEC-08)
│   │   ├── coda.ts                 deposito della coda
│   │   ├── invio.ts                traduce un'operazione in scrittura Supabase
│   │   └── sync.ts                 motore: invia, ritenta, si arrende
│   ├── dominio/                    funzioni pure — 187 test in tutto.
│   │   │                           Ogni file ha il suo .test.ts accanto;
│   │   │                           fra parentesi quanti test lo coprono.
│   │   ├── crediti.ts              anzianità, chiusura conto, sollecito (44)
│   │   ├── denaro.ts               centesimi, parsing, formattazione    (26)
│   │   ├── clienti.ts              validazione, ricerca, rimozione      (25)
│   │   ├── coda.ts                 ordine, attese, dipendenze, errori   (25)
│   │   ├── bozza.ts                il conto in composizione (DEC-08)    (18)
│   │   ├── conti.ts                raggruppamento, elimina-o-storna     (18)
│   │   ├── scontrini.ts            giornata, battuto e non battuto      (14)
│   │   ├── listino.ts              scelta variante, nome completo        (9)
│   │   └── errori.ts               perché una lettura è fallita          (8)
│   ├── hooks/
│   │   ├── use-prodotti.ts         griglia dal database
│   │   ├── use-clienti.ts          elenco con saldi, aggiornaSaldoInCache
│   │   ├── use-cliente.ts          scheda, estratto conto, incasso, rimozione
│   │   ├── use-bozze.ts            bozze locali e conferma conto
│   │   ├── use-scontrini.ts        movimenti di una giornata
│   │   ├── use-coda.ts             stato della coda per l'indicatore
│   │   └── use-stato-rete.ts       online/offline
│   └── utils.ts
│
├── supabase/migrations/
│   ├── 0001_schema.sql             tabelle, indici, trigger
│   ├── 0002_viste.sql              viste di lettura
│   ├── 0003_sicurezza.sql          RLS e regole anti-cancellazione
│   ├── 0004_listino.sql            listino iniziale
│   ├── 0005_fase2_cassa.sql        pronto, NON eseguire ancora
│   ├── 0006_fase3_magazzino.sql    pronto, NON eseguire ancora
│   ├── 0007_correzioni_sicurezza.sql
│   ├── 0008_permessi_e_indici.sql
│   ├── 0009_patatine.sql
│   ├── 0010_cancellazione_cliente.sql  delete su clienti solo al titolare
│   ├── 0011_scontrini.sql          vista v_scontrini
│   └── 0012_stella_artois.sql
│
├── scripts/verifica-denaro.mjs     controllo automatico DEC-04
├── public/manifest.json + icone/
├── docs/                           i sette documenti di progetto
├── proxy.ts                        rinnovo sessione e protezione rotte
└── next.config.ts  vitest.config.mts  eslint.config.mjs  tsconfig.json
```

**`middleware.ts` non esiste:** in Next 16 quel gancio si chiama `proxy.ts`.

Non esiste `tailwind.config.ts`: con Tailwind 4 la configurazione sta in `app/globals.css` dentro `@theme`.

### Regola di dipendenza

```
app/  →  components/  →  lib/hooks/  →  lib/supabase/ + lib/offline/
                                    ↘  lib/dominio/
```

Le frecce vanno in una direzione sola. In particolare: **`lib/dominio/` non importa nulla da React né da Supabase.** Contiene funzioni pure, testabili senza montare niente. È lì che vivono le regole che non devono mai sbagliare — calcolo dei totali, formattazione del denaro, validazione degli storni.

---

## 3. Il modulo denaro

Implementato in `lib/dominio/denaro.ts`, con 26 test in `denaro.test.ts`.
Questa sezione descrive le scelte; il codice vero è nel file, ed è quello che conta.

### Funzioni disponibili

| Funzione | Cosa fa |
|---|---|
| `centesimi(n)` | costruisce un importo, con eccezione se non è intero |
| `parseEuro(testo)` | da quello che digita l'utente a centesimi; `null` se non è valido |
| `formatEuro(cent)` | l'unica funzione che scrive un importo a schermo |
| `sommaCentesimi(lista)` | somma restando negli interi |
| `moltiplica(prezzo, qta)` | riga di conto; quantità negativa = storno |
| `inverti(cent)` | costruisce lo storno |
| `statoSaldo(cent)` | `'deve'` / `'in_pari'` / `'acconto'` |
| `descriviSaldo(cent)` | testo pronto: "deve 24,50 €" |

### Il tipo marchiato

```typescript
export type Centesimi = number & { readonly __marchio: 'Centesimi' };
```

A runtime è un normale `number`, ma TypeScript rifiuta di accettare un numero qualsiasi dove è atteso un importo. Costa cinque righe e previene la classe di errore più costosa del progetto.

### Due dettagli scoperti scrivendo i test

**`parseEuro` valida invece di ripulire.** La prima versione toglieva i caratteri non numerici con una sostituzione: così però `"1,2,3"` diventava `123` e `"-5"` diventava `5`, cioè accettava silenziosamente input sbagliati trasformandoli in importi plausibili. La versione buona verifica la forma con un'espressione regolare e restituisce `null` se non torna. Meglio un campo che non accetta che un importo inventato.

**`formatEuro` forza il raggruppamento delle migliaia.** L'italiano segue la regola CLDR "min2": senza intervenire, `1200` verrebbe scritto `1200,00 €` e `12000` invece `12.000,00 €`. Il separatore comparirebbe e scomparirebbe a seconda della cifra, con differenze anche tra versioni di browser. Con `useGrouping: 'always'` il totale del credito si legge sempre allo stesso modo.

**Regola assoluta:** `importoCent / 100` compare in un solo punto del codice, dentro `formatEuro`. Il controllo è automatico: `npm run verifica:denaro`.

---

## 4. Strategia offline

### 4.1 Il modello mentale

Tre livelli, in ordine di velocità:

```
[ Schermo ]
     ↕  istantaneo
[ Cache TanStack Query in memoria ]
     ↕  ~10ms
[ IndexedDB sul dispositivo ]  ←── copia locale + coda di scrittura
     ↕  rete
[ Supabase ]  ←── verità
```

Ogni azione dell'utente aggiorna **subito** i primi due livelli, poi tenta il terzo. Se il terzo fallisce, l'operazione resta in coda e viene ritentata. L'utente non aspetta mai la rete.

### 4.2 Lettura

All'avvio l'app scarica i dati che servono e li conserva in IndexedDB:

| Dato | Quando si aggiorna | Dimensione |
|---|---|---|
| Prodotti e categorie | all'avvio, poi ogni ora | irrilevante (< 50 voci) |
| Clienti | all'avvio, poi ogni 5 min | piccola |
| Conti aperti | all'avvio, poi realtime | piccola |
| Righe dei conti aperti | con il conto | piccola |
| Storico movimenti | **solo online, su richiesta** | può crescere |

Lo storico completo non si tiene in locale: non serve dietro al banco e crescerebbe senza limite. Offline si vede il saldo (calcolato dai dati in cache) ma non l'estratto conto di sei mesi fa.

### 4.3 Scrittura — la coda

```typescript
// lib/offline/coda.ts (contratto)

export type Operazione =
  // scritture del giro normale
  | { tipo: 'crea_cliente';       dati: { id; nome; soprannome; telefono } }
  | { tipo: 'salva_conto';        dati: { id; clienteId; apertoIl; confermatoIl;
                                          righe: […]; pagamento: {…} | null } }
  | { tipo: 'registra_pagamento'; dati: { id; clienteId; contoId; importoCent;
                                          metodo; scontrinoBattuto } }
  // anagrafica
  | { tipo: 'disattiva_cliente';  dati: { id; nome } }
  | { tipo: 'elimina_cliente';    dati: { id; nome } }
  // scritte e testate, ma non usate finché la bozza resta locale (DEC-08)
  | { tipo: 'apri_conto' } | { tipo: 'aggiungi_riga' }
  | { tipo: 'storna_riga' } | { tipo: 'elimina_riga' } | { tipo: 'chiudi_conto' };

export interface VoceCoda {
  opId: string;             // uuid, va nella colonna op_id
  operazione: Operazione;
  creataIl: number;
  tentativi: number;
  riprovaDopo: number;      // attesa crescente fra un tentativo e l'altro
  ultimoErrore?: string;
  stato: 'in_attesa' | 'in_invio' | 'fallita';
}
```

Il contratto vero, con tutti i campi, sta in `lib/dominio/coda.ts`: qui c'è solo la forma, perché è quella che serve a capire il resto della sezione.

**`salva_conto` è l'operazione normale per registrare un conto** (DEC-08): porta intestazione, righe e pagamento in un invio solo. `apri_conto`, `aggiungi_riga`, `storna_riga`, `elimina_riga` e `chiudi_conto` restano scritte e coperte da test perché torneranno in Fase 4, quando le bozze si sposteranno sul server e due baristi dovranno comporre lo stesso conto.

**Gli orari li mette il dispositivo, non il server.** `salva_conto` porta `apertoIl`, `confermatoIl` e un `creatoIl` per riga. Il default `now()` di Postgres segnerebbe il momento in cui la coda si svuota: dopo mezz'ora senza rete, i caffè delle sette risulterebbero venduti alle sette e mezza.

Il ciclo di vita:

1. L'utente tocca "Caffè". L'app genera `id` e `opId` sul dispositivo.
2. Scrive la riga in IndexedDB e aggiorna la cache in memoria. **Lo schermo si aggiorna qui**, in meno di un fotogramma.
3. Accoda l'operazione.
4. Il motore di sincronizzazione prende le operazioni in ordine e le invia.
5. Successo → la voce esce dalla coda. Errore di rete → si ritenta con attesa crescente (1s, 2s, 4s… fino a 60s). Errore di dati (vincolo violato) → la voce va in `fallita` e viene mostrata all'utente.

**Mai `invalidateQueries` subito dopo aver accodato.** È la trappola in cui si cade per istinto: si mette l'operazione in coda e si chiede a TanStack di rileggere. Ma la lettura parte prima che la scrittura sia arrivata al server, torna il valore vecchio e viene marcata *fresca* — così il saldo resta indietro per tutto lo `staleTime`, e l'elenco clienti mostra un numero diverso dalla scheda dello stesso cliente.

La regola è: **aggiornare la cache a mano con il valore giusto** (`aggiornaSaldoInCache` in `lib/hooks/use-clienti.ts`) e lasciare che la rilettura vera arrivi da sola quando la coda si svuota — `avviaSync` invalida tutto dopo ogni operazione riuscita. Chi tocca il saldo di un cliente deve aggiornare **entrambe** le query che lo contengono, l'elenco e la scheda: è il motivo per cui esiste quella funzione invece di due `setQueryData` sparsi.

### 4.4 Ordine e dipendenze

Le operazioni si inviano **in ordine di creazione**, sempre. Se "apri conto" non è ancora arrivato al server, "aggiungi riga" su quel conto fallirebbe per chiave esterna mancante. Mantenere l'ordine risolve il problema senza logica aggiuntiva.

Se un'operazione fallisce definitivamente, quelle che dipendono da lei restano bloccate dietro. L'app deve mostrarlo chiaramente invece di far finta di niente.

### 4.5 Cosa NON si può fare offline

Vanno disabilitate esplicitamente con un messaggio comprensibile, non lasciate fallire in silenzio:

- Estratto conto storico oltre i conti aperti
- Schermata Scontrini: sono dati di controllo, non servono a servire un caffè
- Chiusura giornaliera (Fase 2)
- Modifica del listino
- Report e statistiche
- Login iniziale (la sessione già attiva funziona offline)

Attenzione a come lo si scopre: senza rete TanStack **mette la richiesta in pausa** invece di farla fallire, quindi `error` resta nullo e `isPending` resta vero. Chi si affida solo a `error` lascia a schermo gli scheletri per sempre. Il controllo giusto è `fetchStatus === 'paused'` senza dati (vedi `scheda-cliente.tsx` ed `elenco-scontrini.tsx`).

### 4.6 Indicatore di stato

In alto a destra, sempre visibile, tre stati:

| Stato | Aspetto | Significato |
|---|---|---|
| Sincronizzato | punto verde, nessun testo | tutto inviato |
| In coda | punto ambra + numero | *n* operazioni da inviare, l'app funziona |
| Problema | punto rosso, tappabile | operazioni fallite, serve intervento |

L'errore va detto in italiano comprensibile: "3 operazioni non inviate — tocca per vedere", non "Error: PGRST204".

---

## 5. Realtime

Supabase può notificare i cambiamenti in tempo reale. Va usato con parsimonia:

**Sì:** conti aperti e loro righe. Sono pochi record e servono a due baristi che lavorano insieme.

**No:** clienti, prodotti, storico. Cambiano di rado, il polling periodico basta e consuma molto meno.

```typescript
// esempio di sottoscrizione — non ancora implementato (Fase 4)
supabase
  .channel('conti-aperti')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'righe_conto' },
      () => queryClient.invalidateQueries({ queryKey: ['conti-aperti'] }))
  .subscribe();
```

Nota: si invalida la query, non si applica la modifica a mano. Ricaricare è più lento ma non può produrre uno stato incoerente, e con questi volumi la differenza non è percepibile.

---

## 6. Autenticazione

✅ **Implementato** in T-06: `proxy.ts`, `lib/supabase/sessione.ts`, `app/login/`.

- Login con **email e password** tramite Supabase Auth. Niente OAuth: il barista non deve avere un account Google.
- La protezione delle rotte usa `getUser()`, non `getSession()`: il primo verifica il token con Supabase, il secondo si fida del cookie. Su un controllo di accesso, fidarsi del cookie non basta.
- Sessione **lunga** (30 giorni) con rinnovo automatico. Chiedere la password ogni mattina è il modo più veloce per far abbandonare l'app.
- **Blocco rapido opzionale:** PIN a 4 cifre per riaprire l'app senza rifare il login completo. Protegge dal telefono lasciato sul banco senza rendere l'accesso pesante.
- Nessuna registrazione libera: gli utenti li crea il titolare dal pannello Supabase (Fase 1) o dall'app (Fase 4).

---

## 7. Prestazioni — vincoli misurabili

Non sono aspirazioni: sono criteri di accettazione.

| Metrica | Limite | Come si misura |
|---|---|---|
| Apertura app (già in cache) | < 1,5 s a schermo utile | Lighthouse mobile, throttling 4G lento |
| Tap prodotto → riga a schermo | < 100 ms | performance.now() nel codice, log in sviluppo |
| Tap dalla home per registrare un caffè a un cliente | ≤ 3 | conteggio manuale |
| Bundle JavaScript iniziale | < 200 KB compresso | `next build` |
| Funzionamento con rete spenta | tutte le funzioni di §4.5 tranne le escluse | test manuale in modalità aereo |

Il secondo vincolo è il motivo per cui l'aggiornamento è ottimistico: 100 ms non sono raggiungibili se si aspetta il server.

---

## 8. Dimensioni di tocco e leggibilità

Vincoli da rispettare in ogni schermata, non solo raccomandazioni:

- Bersaglio di tocco minimo **56×56 px** per le azioni frequenti (i 44 px di Apple sono pensati per mani asciutte e ferme, non per un bar).
- Testo mai sotto **16 px**; gli importi a **20 px** o più, in grassetto.
- Contrasto minimo **4.5:1**, verificato — un telefono al sole dietro una vetrina è il caso peggiore.
- Nessuna azione critica affidata a gesti nascosti (scorrimento laterale, pressione lunga) senza un'alternativa visibile.
- Azioni principali nella **metà bassa** dello schermo, raggiungibili con il pollice di una mano.

---

## 9. Gestione degli errori

Tre categorie, tre comportamenti:

| Categoria | Esempio | Cosa fa l'app |
|---|---|---|
| Rete assente | telefono in modalità aereo | Silenzio. Accoda e prosegue. L'indicatore mostra la coda. |
| Errore di dati | vincolo violato, conto già chiuso | Messaggio in italiano con l'azione da fare. L'operazione resta visibile come fallita. |
| Errore imprevisto | eccezione non gestita | Schermata di errore con pulsante "Riprova" e "Torna alla home". L'errore viene registrato. |

Regola generale: **un errore non deve mai far perdere dati inseriti**. Se un pagamento non parte, resta in coda; se una schermata va in errore, i dati sono comunque in IndexedDB.

**Non si dà la colpa alla rete senza sapere che è la rete.** È l'errore in cui si cade per comodità: un solo messaggio "serve la connessione" per qualunque lettura fallita. Quando il server risponde davvero — una vista che non esiste perché una migrazione non è stata eseguita, un permesso negato — quel messaggio manda a controllare il modem, che funziona. Un messaggio sbagliato costa più tempo di nessun messaggio.

`spiegaErroreLettura()` in `lib/dominio/errori.ts` distingue quattro cause e restituisce la frase giusta; `AvvisoLettura` la mostra. Perché funzioni, chi legge deve lanciare `ErroreLettura` conservando il codice del database: `new Error(error.message)` butta via proprio il codice che serve a distinguere i casi.

Messaggi vietati: "Errore", "Qualcosa è andato storto", codici tecnici. Messaggi corretti: "Questo conto è stato chiuso da un altro dispositivo. Aprine uno nuovo?"

---

## 10. Variabili d'ambiente

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Solo per script di manutenzione, MAI nel codice del browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

La chiave `anon` è pubblica per progetto: è sicura **solo perché RLS è attiva**. Ecco perché §3.9 del modello dati insiste sull'attivarla subito. La chiave `service_role` scavalca RLS: non deve mai comparire in un file dentro `app/` o `components/`.

`.env.local` va in `.gitignore`. Sempre.

---

## 11. Deploy

**Host scelto: Netlify.** I documenti indicavano Vercel; la scelta è cambiata perché il repository era già collegato a Netlify.

1. Repository su GitHub (privato): `VoidSergio/GestioBar`
2. `netlify.toml` nel progetto — senza, Netlify serve il sito come statico e restituisce 404 ovunque
3. Le due variabili `NEXT_PUBLIC_*` vanno inserite **nel pannello Netlify**, non in un file
4. Ogni push su `main` fa il deploy

### La protezione delle rotte è doppia, di proposito

`proxy.ts` (ex `middleware.ts`) intercetta le richieste prima che la pagina venga costruita. In Next 16 gira **obbligatoriamente sul runtime Node.js**: l'edge runtime non è supportato e non è configurabile. Netlify esegue storicamente il middleware Next come edge function, e non è confermato che il loro plugin gestisca già `proxy.ts`.

Invece di scommettere, ogni pagina riservata chiama anche `richiediAccesso()` in `lib/supabase/accesso.ts`, che verifica la sessione lato server e reindirizza a `/login`. Se il proxy non gira, l'app resta protetta.

Sarebbe un controllo ridondante su un host che esegue il proxy correttamente. È il tipo di ridondanza che si tiene: costa una chiamata già presente in pagina, e toglie un punto unico di rottura che riguarda l'accesso ai dati dei clienti.

**Ambienti:** un solo progetto Supabase in Fase 1 è accettabile, ma appena ci sono dati veri va creato un secondo progetto per le prove. Provare una migrazione sui dati di produzione è il modo classico di perdere il credito di sei mesi.

---

## 12. Test — cosa vale la pena testare

Non tutto merita un test. Questi sì.

**Stato al 6 agosto 2026: 187 test, tutti in `lib/dominio/`.** Girano in poco più di un secondo perché non montano niente — è il vantaggio di tenere le regole in funzioni pure.

**Test unitari obbligatori** (`lib/dominio/`):

- `parseEuro`: "1,20" → 120, "1.20" → 120, "abc" → null, "-5" → null, "" → null
- `formatEuro`: 120 → "1,20 €", 0 → "0,00 €", -500 → "-5,00 €"
- calcolo del totale di un conto con storni
- calcolo del saldo cliente con acconti multipli
- calcolo dei giorni di anzianità del debito
- saldo progressivo dell'estratto conto **con lo storico paginato**: è il caso che ha nascosto un bug vero, perché sommando da zero il totale in cima non coincideva col saldo
- chiusura conto con importo parziale, resto e divieto di debito al banco
- riassunto scontrini: incassato senza scontrino e merce a credito non si sommano

**Test di integrazione** (contro un Supabase locale):

- doppio invio con lo stesso `op_id` → una sola riga
- due conti aperti per lo stesso cliente → il secondo fallisce
- cancellazione di riga dopo 60 secondi → rifiutata
- cancellazione di pagamento → sempre rifiutata

**Test manuali prima di ogni rilascio:**

- modalità aereo: aggiungere 3 righe, riattivare la rete, verificare che arrivino tutte una volta sola
- tap ripetuto veloce sullo stesso prodotto: verificare il conteggio
- due dispositivi sullo stesso conto contemporaneamente
- `npm run verifica:denaro`: deve trovare **una sola** divisione per 100, dentro `formatEuro`

Non serve testare i componenti di interfaccia con test automatici in questa fase: cambiano troppo e il ritorno è basso.

---

**Prossimo documento:** `04-UX-MOBILE.md`
