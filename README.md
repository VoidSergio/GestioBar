# Gestionale Bar

Conti aperti e clienti a credito, dal telefono. Mobile-first, funziona anche quando il wifi cade.

**Stato:** Fase 0 completata (impalcatura). L'app non gestisce ancora conti: la prossima cosa da costruire è T-06 in `docs/05-ROADMAP.md`.

---

## Cosa fare adesso, in ordine

### 1. Installare le dipendenze

```bash
npm install
```

### 2. Verificare che il modulo denaro funzioni

```bash
npm test
npm run verifica:denaro
```

Entrambi devono passare **prima** di scrivere qualsiasi altro codice. Il modulo denaro è la fondazione: se sbaglia lui, sbaglia tutto il resto.

### 3. Creare il progetto Supabase

Segui `docs/06-SETUP-SUPABASE.md`. Sono 20 minuti e non serve il terminale.

### 4. Eseguire le migrazioni

Nel SQL Editor di Supabase, incolla e lancia **in quest'ordine**:

| File | Cosa crea |
|---|---|
| `supabase/migrations/0001_schema.sql` | tabelle, indici, trigger |
| `supabase/migrations/0002_viste.sql` | viste di lettura (saldi, conti aperti, griglia) |
| `supabase/migrations/0003_sicurezza.sql` | Row Level Security e regole anti-cancellazione |
| `supabase/migrations/0004_listino.sql` | il listino del locale, 59 prodotti |

I file `0005` e `0006` sono Fase 2 e Fase 3: **non eseguirli adesso**.

Verifica finale nel SQL Editor:

```sql
select count(*) from prodotti;            -- deve dare 59
select count(*) from v_griglia_prodotti;  -- deve dare 34
```

### 5. Collegare l'app al database

```bash
cp .env.local.example .env.local
```

Apri `.env.local` e incolla i due valori da Supabase → Settings → API.

### 6. Avviare

```bash
npm run dev
```

Apri `http://localhost:3000`. La schermata iniziale è una diagnostica: ti dice se il collegamento funziona e se i 59 prodotti sono a posto. Quando tutti i pallini sono verdi, la Fase 0 è chiusa.

---

## I documenti

Tutto il progetto è descritto in `docs/`. Parti da `docs/00-INDICE.md`.

| File | Contenuto |
|---|---|
| `01-VISIONE-E-DECISIONI.md` | il problema, le fasi, le 7 decisioni architetturali |
| `02-MODELLO-DATI.md` | schema del database, con lo SQL |
| `03-ARCHITETTURA.md` | stack, struttura, strategia offline, prestazioni |
| `04-UX-MOBILE.md` | ogni schermata disegnata |
| `05-ROADMAP.md` | i task da fare, con criteri di accettazione |
| `06-SETUP-SUPABASE.md` | guida al database, senza terminale |
| `07-LISTINO.md` | il listino reale e il modello a varianti |

`CLAUDE.md` alla radice contiene le regole per chi scrive il codice — viene letto automaticamente da Claude Code.

---

## Le tre regole da non violare mai

1. **Gli importi sono interi in centesimi.** 1,20 € è `120`. La divisione per 100 esiste in un solo punto del progetto, dentro `formatEuro()`. Il controllo è automatico: `npm run verifica:denaro`.

2. **Il saldo non si memorizza.** Si legge da `v_saldo_clienti`, che lo ricalcola. Non creare colonne `saldo`.

3. **I movimenti non si modificano.** Righe e pagamenti si correggono con uno storno di segno opposto, che resta visibile nello storico.

Il perché di ognuna sta in `docs/01-VISIONE-E-DECISIONI.md` §5.

---

## Struttura

```
app/                    schermate (App Router)
components/             componenti di interfaccia
lib/
  dominio/              regole pure, senza React né Supabase — qui vanno i test
  supabase/             client e tipi
  offline/              coda di scrittura e sincronizzazione   [da fare: T-09]
  hooks/                accesso ai dati                        [da fare: T-07+]
supabase/migrations/    SQL da eseguire su Supabase
docs/                   progettazione
scripts/                controlli automatici
```

La direzione delle dipendenze va rispettata: `app → components → hooks → supabase/offline`, e `lib/dominio/` non importa niente da React o Supabase.

---

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | avvia in sviluppo |
| `npm run build` | compila per la produzione |
| `npm test` | test del dominio |
| `npm run lint` | controlli di stile |
| `npm run verifica:denaro` | verifica la regola dei centesimi |

---

## Provare l'app dal telefono

Sulla stessa rete wifi, `npm run dev` espone l'indirizzo locale del computer (tipo `http://192.168.1.20:3000`). Aprilo dal telefono: è l'unico modo serio di valutare le schermate, perché è lì che l'app verrà usata.
