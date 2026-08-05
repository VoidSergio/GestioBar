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

Le voci con ✅ esistono già; le altre sono da costruire seguendo `05-ROADMAP.md`.

```
gestionale-bar/
├── app/
│   ├── layout.tsx                  ✅ shell, metadata, PWA
│   ├── page.tsx                    ✅ ora diagnostica setup → diventerà la HOME (T-11)
│   ├── globals.css                 ✅ palette e regole di base (@theme Tailwind 4)
│   ├── login/
│   │   ├── page.tsx                ✅ schermata di accesso
│   │   ├── modulo-accesso.tsx      ✅ form (client)
│   │   └── azioni.ts               ✅ accedi() ed esci()
│   ├── conto/
│   │   └── [id]/page.tsx           # dettaglio conto, griglia prodotti
│   ├── clienti/
│   │   ├── page.tsx                ✅ elenco + ricerca + creazione
│   │   └── [id]/page.tsx           # estratto conto, saldo, incassa  [T-14]
│   ├── crediti/
│   │   └── page.tsx                # chi deve soldi, per anzianità
│   ├── listino/
│   │   └── page.tsx                # gestione prodotti          [Fase 1, uso raro]
│   ├── cassa/
│   │   └── page.tsx                # chiusura giornaliera       [Fase 2]
│   ├── magazzino/
│   │   └── page.tsx                #                            [Fase 3]
│   └── api/
│       └── health/route.ts
│
├── components/
│   ├── ui/                         # shadcn: button, dialog, input, sheet…
│   ├── conto/
│   │   ├── griglia-prodotti.tsx
│   │   ├── righe-conto.tsx
│   │   ├── barra-totale.tsx
│   │   └── dialog-pagamento.tsx
│   ├── clienti/
│   │   ├── elenco-clienti.tsx      ✅
│   │   ├── modulo-nuovo-cliente.tsx ✅
│   │   ├── ricerca-cliente.tsx     # selettore per aprire un conto   [T-11]
│   │   └── estratto-conto.tsx      #                                 [T-14]
│   └── shell/
│       ├── pulsante-esci.tsx       ✅
│       ├── provider-dati.tsx       ✅ TanStack Query + ripristino cache
│       ├── indicatore-sync.tsx     ✅ pallino verde/ambra/rosso
│       ├── barra-navigazione.tsx   # tab bar in basso              [T-11]
│       └── intestazione.tsx        #                                [T-11]
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ✅ client lato browser
│   │   ├── server.ts               ✅ client lato server (SSR)
│   │   ├── configurazione.ts       ✅ lettura .env con errori in italiano
│   │   ├── sessione.ts             ✅ rinnovo sessione (proxy)
│   │   ├── accesso.ts              ✅ richiediAccesso() per le pagine
│   │   └── tipi.ts                 ✅ scritti a mano, rigenerabili da Supabase CLI
│   ├── offline/
│   │   ├── db.ts                   ✅ schema IndexedDB (cache + coda)
│   │   ├── cache-query.ts          ✅ salva/ripristina la cache
│   │   ├── coda.ts                 # coda di scrittura              [T-09]
│   │   └── sync.ts                 # motore di sincronizzazione     [T-09]
│   ├── dominio/
│   │   ├── denaro.ts               ✅ centesimi, parsing, formattazione
│   │   ├── denaro.test.ts          ✅ 22 test
│   │   ├── clienti.ts              ✅ validazione, ricerca, ordinamento
│   │   ├── clienti.test.ts         ✅ 18 test
│   │   ├── listino.ts              ✅ scelta variante, nome completo
│   │   ├── listino.test.ts         ✅ 9 test
│   │   ├── conti.ts                # regole di business sui conti
│   │   ├── crediti.ts              # calcoli su saldo e anzianità
│   │   └── schemi.ts               # schemi Zod
│   ├── hooks/
│   │   ├── use-prodotti.ts         ✅ griglia dal database
│   │   ├── use-stato-rete.ts       ✅ online/offline
│   │   ├── use-clienti.ts          ✅ elenco con saldi + creazione
│   │   ├── use-conti-aperti.ts     #                                [T-11]
│   │   ├── use-conto.ts            #                                [T-12]
│   │   └── use-crediti.ts          #                                [T-15]
│   └── utils.ts
│
├── supabase/
│   └── migrations/
│       ├── 0001_schema.sql          ✅ tabelle, indici, trigger
│       ├── 0002_viste.sql           ✅ viste di lettura
│       ├── 0003_sicurezza.sql       ✅ RLS e regole anti-cancellazione
│       ├── 0004_listino.sql         ✅ 59 prodotti
│       ├── 0005_fase2_cassa.sql     ✅ pronto, NON eseguire ancora
│       └── 0006_fase3_magazzino.sql ✅ pronto, NON eseguire ancora
│
├── scripts/
│   └── verifica-denaro.mjs         ✅ controllo automatico DEC-04
│
├── public/
│   ├── manifest.json               ✅
│   └── icone/                      ✅ 192, 512, maskable, apple-touch
│
├── docs/                           ✅ i sette documenti di progetto
├── .env.local                      ✅ (solo locale, mai su GitHub)
├── proxy.ts                        ✅ ex middleware.ts (rinominato in Next 16)
├── netlify.toml                    ✅ senza questo file: 404 ovunque
├── .env.local.example              ✅
├── next.config.ts                  ✅
├── vitest.config.mts               ✅
├── eslint.config.mjs               ✅
├── tsconfig.json                   ✅
├── README.md                       ✅
└── CLAUDE.md                       ✅
```

Non esiste `tailwind.config.ts`: con Tailwind 4 la configurazione sta in `app/globals.css` dentro `@theme`.

### Regola di dipendenza

```
app/  →  components/  →  lib/hooks/  →  lib/supabase/ + lib/offline/
                                    ↘  lib/dominio/
```

Le frecce vanno in una direzione sola. In particolare: **`lib/dominio/` non importa nulla da React né da Supabase.** Contiene funzioni pure, testabili senza montare niente. È lì che vivono le regole che non devono mai sbagliare — calcolo dei totali, formattazione del denaro, validazione degli storni.

---

## 3. Il modulo denaro

✅ **Implementato** in `lib/dominio/denaro.ts`, con 22 test in `denaro.test.ts`.
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
  | { tipo: 'apri_conto';      dati: { id: string; clienteId: string | null } }
  | { tipo: 'aggiungi_riga';   dati: { id: string; contoId: string; prodottoId: string | null;
                                       descrizione: string; prezzoUnitarioCent: number; quantita: number } }
  | { tipo: 'storna_riga';     dati: { id: string; rigaOriginaleId: string } }
  | { tipo: 'elimina_riga';    dati: { rigaId: string } }
  | { tipo: 'registra_pagamento'; dati: { id: string; clienteId: string | null; contoId: string | null;
                                          importoCent: number; metodo: string } }
  | { tipo: 'chiudi_conto';    dati: { contoId: string } }
  | { tipo: 'crea_cliente';    dati: { id: string; nome: string; soprannome?: string; telefono?: string } };

export interface VoceCoda {
  opId: string;             // uuid, va nella colonna op_id
  operazione: Operazione;
  creataIl: number;
  tentativi: number;
  ultimoErrore?: string;
  stato: 'in_attesa' | 'in_invio' | 'fallita';
}
```

Il ciclo di vita:

1. L'utente tocca "Caffè". L'app genera `id` e `opId` sul dispositivo.
2. Scrive la riga in IndexedDB e aggiorna la cache in memoria. **Lo schermo si aggiorna qui**, in meno di un fotogramma.
3. Accoda l'operazione.
4. Il motore di sincronizzazione prende le operazioni in ordine e le invia.
5. Successo → la voce esce dalla coda. Errore di rete → si ritenta con attesa crescente (1s, 2s, 4s… fino a 60s). Errore di dati (vincolo violato) → la voce va in `fallita` e viene mostrata all'utente.

### 4.4 Ordine e dipendenze

Le operazioni si inviano **in ordine di creazione**, sempre. Se "apri conto" non è ancora arrivato al server, "aggiungi riga" su quel conto fallirebbe per chiave esterna mancante. Mantenere l'ordine risolve il problema senza logica aggiuntiva.

Se un'operazione fallisce definitivamente, quelle che dipendono da lei restano bloccate dietro. L'app deve mostrarlo chiaramente invece di far finta di niente.

### 4.5 Cosa NON si può fare offline

Vanno disabilitate esplicitamente con un messaggio comprensibile, non lasciate fallire in silenzio:

- Estratto conto storico oltre i conti aperti
- Chiusura giornaliera (Fase 2)
- Modifica del listino
- Report e statistiche
- Login iniziale (la sessione già attiva funziona offline)

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
// esempio di sottoscrizione, in use-conti-aperti.ts
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

Non tutto merita un test. Questi sì:

**Test unitari obbligatori** (`lib/dominio/`):

- `parseEuro`: "1,20" → 120, "1.20" → 120, "abc" → null, "-5" → null, "" → null
- `formatEuro`: 120 → "1,20 €", 0 → "0,00 €", -500 → "-5,00 €"
- calcolo del totale di un conto con storni
- calcolo del saldo cliente con acconti multipli
- calcolo dei giorni di anzianità del debito

**Test di integrazione** (contro un Supabase locale):

- doppio invio con lo stesso `op_id` → una sola riga
- due conti aperti per lo stesso cliente → il secondo fallisce
- cancellazione di riga dopo 60 secondi → rifiutata
- cancellazione di pagamento → sempre rifiutata

**Test manuali prima di ogni rilascio:**

- modalità aereo: aggiungere 3 righe, riattivare la rete, verificare che arrivino tutte una volta sola
- tap ripetuto veloce sullo stesso prodotto: verificare il conteggio
- due dispositivi sullo stesso conto contemporaneamente

Non serve testare i componenti di interfaccia con test automatici in questa fase: cambiano troppo e il ritorno è basso.

---

**Prossimo documento:** `04-UX-MOBILE.md`
