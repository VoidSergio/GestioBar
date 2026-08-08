# Setup Supabase — guida passo passo

> Scritta per chi non ha mai usato un database. Nessun comando da terminale nelle prime tre sezioni.
> Tempo richiesto: circa 20 minuti.

---

## 0. Cos'è, in concreto

Supabase è un **database Postgres già acceso su internet**, gestito da qualcun altro. Il tuo telefono e quello del barista non parlano tra loro: parlano entrambi con questo database. È il motivo per cui vedono gli stessi dati.

Concretamente ottieni due cose:

- un **indirizzo** (tipo `https://abcdefgh.supabase.co`)
- una **chiave** (una stringa lunghissima)

Le incolli nell'app e l'app sa dove scrivere. Non c'è nient'altro da installare, da configurare o da tenere acceso.

Supabase include anche il sistema di **login** (email e password degli utenti) e il **realtime** (quando un barista aggiunge un caffè, l'altro telefono lo vede comparire). Sono inclusi, non componenti da aggiungere.

---

## 1. Creare l'account

1. Vai su `supabase.com` e scegli **Start your project**.
2. Registrati con GitHub oppure con email e password. Se non hai GitHub, l'email va benissimo.
3. Conferma l'indirizzo email dal link che ricevi.

Nessuna carta di credito richiesta.

---

## 2. Creare il progetto

Dalla dashboard, **New project**:

| Campo | Cosa mettere | Perché |
|---|---|---|
| Name | `gestionale-bar` | serve solo a te |
| Database Password | una password lunga, generata dal pulsante | **salvala subito** in un gestore di password: non è più recuperabile |
| Region | una qualsiasi in Europa | i dati dei clienti restano in UE, che semplifica la questione GDPR |
| Plan | Free | sufficiente per anni |

Il progetto impiega uno o due minuti a essere pronto.

> **La password del database non è la password con cui fai login.** È quella che serve per collegarsi al database dall'esterno. Se la perdi si può rigenerare, ma è una scocciatura: salvala adesso.

**Sulla regione:** Supabase ne propone una in automatico e va bene qualunque, purché sia europea. Irlanda (`eu-west-1`) e Francoforte (`eu-central-1`) differiscono di una quindicina di millisecondi dall'Italia — una differenza che non si percepisce, tanto più che l'app aggiorna lo schermo prima di parlare col server (DEC-06). Non vale la pena rifare il progetto per cambiarla.

---

## 3. Prendere indirizzo e chiave

Nel progetto: **Settings** (icona ingranaggio) → **API**.

Ti servono due valori:

| Valore | Dove | Uso |
|---|---|---|
| **Project URL** | in cima | va in `NEXT_PUBLIC_SUPABASE_URL` |
| **anon public** | sezione Project API keys | va in `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Nella stessa pagina c'è anche **service_role**. Quella **non va mai** nell'app: scavalca tutte le regole di sicurezza. Serve solo a script di manutenzione che giri tu dal tuo computer.

Nel progetto, il file `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Questo file **non va mai caricato su GitHub**. Deve essere elencato in `.gitignore` (Next.js ce lo mette già).

### "Ma se la chiave è pubblica, chiunque può leggere i miei dati?"

No, e il motivo è importante da capire. La chiave `anon` dice solo *quale progetto*, non *cosa puoi fare*. Cosa si può fare lo decidono le **policy RLS** (Row Level Security) scritte in `02-MODELLO-DATI.md` §3.9: senza un login valido, quella chiave non legge nulla.

È per questo che RLS va attivata **prima** di inserire dati veri. Un database con RLS spenta e chiave pubblica è un database aperto a chiunque conosca l'indirizzo.

---

## 4. Eseguire lo schema

I file sono già pronti nel progetto, in `supabase/migrations/`. Non serve copiarli dai documenti.

Nel menu di sinistra: **SQL Editor** → **New query**. Poi, **un file alla volta**: apri il file, seleziona tutto, incolla nell'editor, premi **Run**. Quando dice `Success`, passa al successivo.

| Ordine | File | Cosa crea |
|---|---|---|
| 1 | `0001_schema.sql` | tabelle, indici, trigger |
| 2 | `0002_viste.sql` | viste di lettura (saldi, conti aperti, griglia) |
| 3 | `0003_sicurezza.sql` | Row Level Security e regole anti-cancellazione |
| 4 | `0004_listino.sql` | i 59 prodotti del locale |

I file `0005` e `0006` sono Fase 2 e Fase 3: **non eseguirli adesso**. Se li esegui per sbaglio non succede niente di grave — crea tabelle vuote che nessuna schermata usa — ma il file `0007` le rimuove.

Il file `0007_correzioni_sicurezza.sql` serve solo ai database creati prima del 3 agosto 2026, quando le migrazioni avevano i difetti descritti in §4.1. Su un database nuovo non serve: `0001`–`0004` sono già corretti.

L'ordine conta: le tabelle si riferiscono l'una all'altra, e una tabella non può riferirsi a una che non esiste ancora. Se sbagli ordine ottieni `relation "..." does not exist`: ricomincia da `0001`.

Se compare la finestra **"Run without RLS / Run and enable RLS"**, scegli sempre **Run and enable RLS**.

### 4.1 Il Security Advisor

Nel menu di sinistra, sotto **Advisors**, Supabase controlla il database e segnala i problemi. Vale la pena aprirlo dopo ogni migrazione: le tre categorie che compaiono più spesso sono queste.

| Segnalazione | Cosa significa davvero |
|---|---|
| **Security Definer View** (critico) | Una vista gira con i permessi di chi l'ha creata e scavalca RLS. Le tabelle sembrano protette, ma dalla vista si legge tutto. Si risolve con `security_invoker = on`. |
| **Function Search Path Mutable** | Una funzione risolve i nomi delle tabelle in base alla configurazione di chi la chiama. Si risolve con `set search_path = ''` e nomi qualificati (`public.conti`). |
| **Multiple Permissive Policies** | Due policy che si sovrappongono sulla stessa operazione. Non è un buco, è lavoro inutile a ogni riga letta. |
| **Public Can Execute SECURITY DEFINER Function** | Una funzione che gira con i permessi dell'amministratore è chiamabile da chiunque. Si risolve con `revoke all on function ... from public, anon`. |
| **Unindexed foreign keys** | Chiave esterna senza indice: join lente e scansioni complete della tabella figlia. Si risolve con un `create index`. |
| **RLS Policy Always True** | La policy non filtra nulla. **Nel nostro caso è voluto** — vedi sotto. |

Il primo è l'unico davvero grave, e sono i **dati dei clienti** a essere esposti. Non ignorarlo.

### 4.2 L'avviso che resta, ed è giusto che resti

`RLS Policy Always True` continuerà a comparire su sei tabelle. La policy è:

```sql
create policy "..." on tabella for all to authenticated using (true);
```

Il pezzo che conta è **`to authenticated`**: un utente anonimo non rientra e non legge niente. La regola dice "chi ha fatto il login può operare", che in Fase 1 è esattamente il comportamento voluto — l'unico utente sei tu, e il barista che arriverà dovrà fare le stesse cose.

In **Fase 4 (T-40)** queste policy diventeranno regole per ruolo: il barista non leggerà i report economici, non modificherà il listino, non cancellerà righe altrui. L'avviso sparirà allora, perché sarà cambiato il requisito — non per far tacere un controllo automatico.

Un avviso che hai capito e deciso di accettare non è debito tecnico. Lo diventa quando smetti di leggerli tutti perché tanto "sono sempre gialli".

**Verifica finale**, sempre nel SQL Editor:

```sql
select count(*) from prodotti;            -- deve dare 59
select count(*) from v_griglia_prodotti;  -- deve dare 34
select * from v_saldo_clienti;            -- 0 righe, nessun errore
```

E in **Table Editor** devi vedere sette tabelle, ciascuna con l'etichetta **RLS enabled**.

Se una tabella non ce l'ha, il blocco §3.9 non è passato: rilancialo.

---

## 5. Creare il primo utente

**Authentication** → **Users** → **Add user** → **Create new user**.

Metti la tua email e una password. **Disattiva** "Auto Confirm User" solo se vuoi verificare l'email; per il primo utente lascialo attivo, è più semplice.

Il trigger `crea_profilo_utente` crea il profilo automaticamente. Verifica:

```sql
select id, nome, ruolo from profili;
```

Il primo utente deve risultare `titolare`.

Per aggiungere un barista, ripeti la stessa procedura: il ruolo sarà `barista` in automatico.

---

## 5.1 Chiudere la registrazione libera — **il passo che regge tutto il resto**

**Authentication** → **Sign In / Providers** → sezione **User Signups** → spegni
**"Allow new users to sign up"** → **Save changes**.

È acceso di default, e finché lo è **chiunque conosca l'indirizzo del sito può crearsi un account
ed entrare**. Non serve indovinare niente: si registra, conferma la mail — la sua, va benissimo —
e si trova dentro.

**Perché è il passo che regge tutto il resto.** Le policy della Fase 1 sono
`for all to authenticated using (true)`: chi è autenticato può leggere e scrivere tutto. È una
scelta consapevole e scritta, e ha senso per un locale dove lavora una persona sola. Ma ha una
condizione che non era scritta da nessuna parte, e adesso lo è: **vale solo se gli account li
crei tu.** Con la registrazione aperta, quel `using (true)` smette di essere una semplificazione
e diventa una porta.

È anche la risposta agli avvisi **"RLS Policy Always True"** che il Security Advisor mostra su
`clienti`, `conti`, `pagamenti`, `righe_conto`, `prodotti` e `categorie`. Non sono errori: sono
quella scelta. Diventano accettabili nel momento in cui nessuno può procurarsi un accesso, e non
prima. Si stringeranno a T-40, quando i baristi avranno ruoli diversi.

Dopo averlo spento, controlla chi c'è: **Authentication** → **Users**. Se compare qualcuno che
non hai creato tu, non è un falso allarme.

Gli utenti che ti servono continui a crearli dalla dashboard come al §5. Chi è già dentro non
viene toccato: si spegne la registrazione, non l'accesso.

### Mentre sei lì, tre voci nel provider Email

**Authentication** → **Sign In / Providers** → **Email**:

- **Require current password when updating** — accendilo. Spento, chi mette le mani su un
  telefono già collegato cambia la password senza sapere la vecchia, e ti chiude fuori dal tuo
  gestionale. In un bar i telefoni stanno sul banco.
- **Secure password change** — accendilo, stessa famiglia.
- **Minimum password length** — da 6 a 10. La password la digiti di rado, il telefono resta
  collegato.

**Leaked Password Protection** richiede il piano Pro e resterà segnalata dal Security Advisor.
Si sostituisce scegliendo una password che non hai usato altrove.

---

## 6. Backup

Supabase fa i suoi backup, ma il piano gratuito ne conserva pochi giorni. Per un dato che rappresenta soldi veri, tienine anche una copia tua.

### Copia manuale rapida

Nel SQL Editor, esporta le tabelle importanti in CSV con il pulsante di download dei risultati:

```sql
select * from clienti;
select * from conti;
select * from righe_conto;
select * from pagamenti;
```

Cinque minuti, una volta al mese. Meglio di niente e sorprendentemente efficace.

### Backup completo automatico

Se hai Postgres installato sul computer:

```bash
# una volta: prendi la connection string da Settings → Database → Connection string (URI)
pg_dump "postgresql://postgres:LA_TUA_PASSWORD@db.abcdefgh.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  > backup_$(date +%Y%m%d).sql
```

Mettilo in un'attività pianificata settimanale e salva i file su un disco esterno o un servizio cloud. Il ripristino è `psql < backup.sql` su un progetto nuovo.

---

## 7. Limiti del piano gratuito

| Limite | Valore | Cosa significa per te |
|---|---|---|
| Spazio database | 500 MB | una riga di conto pesa ~200 byte: **oltre 2 milioni di consumazioni** |
| Traffico | 5 GB/mese | irrilevante per un'app di testo |
| Utenti registrati | 50.000 | ne avrai 3 |
| Connessioni realtime | 200 contemporanee | ne userai 2 o 3 |
| **Sospensione per inattività** | dopo 7 giorni senza richieste | **questo sì che conta** |

L'ultimo punto merita attenzione: un progetto gratuito che non riceve richieste per una settimana viene messo in pausa. Si riattiva con un click dalla dashboard e non perdi niente, ma se succede di lunedì mattina alle 6 è una seccatura.

Se il bar è chiuso per ferie più di una settimana, riattivalo prima di riaprire. In alternativa, una funzione pianificata che fa una query banale ogni giorno tiene il progetto sveglio.

Il piano a pagamento parte da 25 $ al mese e toglie questo limite. Non serve fino a quando il sistema non è davvero in uso quotidiano.

---

## 8. Due ambienti (quando i dati diventano veri)

Finché stai costruendo, un progetto solo va bene. Dal momento in cui ci sono conti veri di clienti veri, servono due progetti:

| Progetto | Nome | Uso |
|---|---|---|
| Produzione | `gestionale-bar` | dati veri, non ci si sperimenta |
| Prove | `gestionale-bar-dev` | migrazioni e funzioni nuove si provano qui |

Costano zero entrambi. La regola: **nessuna modifica allo schema di produzione che non sia già stata provata su quello di prova.** Una `alter table` sbagliata su dati veri è il modo classico di perdere il credito di sei mesi.

---

## 9. Problemi frequenti

| Sintomo | Causa quasi certa | Rimedio |
|---|---|---|
| `relation "..." does not exist` | blocchi SQL eseguiti fuori ordine | rilancia dall'inizio, nell'ordine di §4 |
| Query che restituisce 0 righe pur avendo dati | RLS attiva e utente non autenticato | verifica il login; nel SQL Editor sei "postgres" e vedi tutto, dall'app no |
| `new row violates row-level security policy` | manca la policy di scrittura | ricontrolla §3.9 del modello dati |
| `duplicate key value violates unique constraint "..._op_id_key"` | **non è un errore**: è la protezione dai doppi invii | l'app deve trattarlo come "già registrato" e proseguire |
| L'app non si collega | variabili d'ambiente sbagliate o non ricaricate | controlla `.env.local` e **riavvia** `npm run dev` |
| Progetto in pausa | 7 giorni senza attività | riattiva dalla dashboard |
| Trigger su `auth.users` non creato | serve il ruolo giusto | esegui quel blocco dal SQL Editor della dashboard, non da un client esterno |

---

## 10. Checklist finale

- [ ] Progetto creato in regione europea
- [ ] Password del database salvata in un gestore di password
- [ ] URL e chiave `anon` nel `.env.local`
- [ ] `.env.local` in `.gitignore`, mai su GitHub
- [ ] Chiave `service_role` **non** presente in nessun file dell'app
- [ ] Tutti i blocchi SQL eseguiti, nell'ordine
- [ ] 59 prodotti, 34 riquadri, viste funzionanti
- [ ] RLS attiva su tutte e sette le tabelle
- [ ] Primo utente creato, profilo `titolare` verificato
- [ ] Backup: modalità scelta e prima copia fatta

---

**Prossimo documento:** `07-LISTINO.md` (già pronto) e `05-ROADMAP.md` per iniziare a costruire.
