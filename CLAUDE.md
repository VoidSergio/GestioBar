# Istruzioni per l'agente

> Questo file viene letto automaticamente da Claude Code all'inizio di ogni sessione in questo repository.
> Contiene le regole che non vanno mai violate. Le spiegazioni stanno negli altri documenti.

---

## Il progetto in tre righe

Gestionale per un bar, mobile-first, in italiano. Serve a sapere con certezza **quanto deve ogni cliente che paga in ritardo**. Tutto il resto (catalogo, cassa, magazzino) è contorno che serve a far funzionare quel numero.

Stack: Next.js 16 (App Router, Turbopack) + TypeScript strict + Supabase + TanStack Query + Tailwind 4.

**Stato:** Fase 0 chiusa, app pubblicata su Netlify. Fatti T-06 (accesso), T-07 (cache offline), T-08 (clienti), T-09 (coda), T-10 (griglia), T-11 (apertura conto), T-12 (righe), T-13 (chiusura conto), T-14 (scheda cliente), T-15 (crediti), T-16 (listino), T-17 (PWA), più **T-20 e T-22** (chiusura di turno) anticipati dalla Fase 2 — il perché è scritto in `05-ROADMAP.md`. 63 prodotti a catalogo, 266 test verdi. Il giro completo funziona. **T-18 è cominciato**: le prime tre correzioni dal banco sono in `09-DIARIO.md` alla data del 12 agosto.

**La schermata di apertura è la griglia prodotti**, non l'elenco dei conti. L'app tiene sempre pronto un conto al banco (`useBanco` in `lib/hooks/use-bozze.ts`): aperta l'app, il primo tocco è il prodotto. Il cliente si chiede alla fine, e solo se il conto resta a debito. I conti aperti stanno nella striscia in cima. Il perché sta in `04-UX-MOBILE.md` §3 — non è un dettaglio estetico, è il vincolo dei tap misurato dal punto giusto.

**Prima di scrivere SQL:** `npm run verifica:migrazioni` esegue tutte le migrazioni su un Postgres in WebAssembly e controlla che facciano quello che dicono. Una migrazione non si incolla in produzione senza averla vista girare — l'8 agosto ha trovato un pagamento perso che nessuno aveva visto leggendo il file.

**Il saldo si legge da un posto solo, ma sta in due cache.** L'elenco (`clienti-con-saldo`) e la scheda (`['cliente', id]`) contengono lo stesso numero: chi lo muove usa `aggiornaSaldoInCache()` in `lib/hooks/use-clienti.ts`, che le tocca entrambe. **Mai `invalidateQueries` subito dopo `accoda()`**: la rilettura parte prima che la scrittura arrivi al server e ricasca sul valore vecchio marcandolo fresco (`03-ARCHITETTURA.md` §4.3).

**Un conto confermato nasce sempre `chiuso`**, anche a credito: `stato` dice se lo stai ancora battendo, non se è stato pagato. Il debito vive in `v_saldo_clienti`.

**Spostare una consumazione a un altro cliente è uno storno parziale più un addebito**, mai un `update` della riga: `lib/dominio/spostamenti.ts`. Il prezzo si copia dalla riga originale, non dal catalogo.

**Un cliente con movimenti non si cancella, si disattiva.** La regola sta in `comeRimuovereCliente()` (`lib/dominio/clienti.ts`); il `delete` su `clienti` è riservato al titolare da RLS. Chi cancella deve controllare `count`, non solo `error`: RLS che vieta restituisce zero righe toccate senza errore.

Le scritture passano tutte da `accoda()` in `lib/offline/coda.ts`, mai direttamente da Supabase. Le regole della coda stanno in `lib/dominio/coda.ts` e sono coperte da 25 test.

**DEC-08 — il conto in composizione è una bozza locale.** Vive in IndexedDB (`lib/offline/bozze.ts`), si modifica liberamente e non tocca il database. Diventa un conto vero solo alla conferma, con l'unica operazione `salva_conto`. Non registrare righe mentre l'utente compone.

Note operative: `middleware.ts` non esiste — in Next 16 si chiama `proxy.ts`. I tipi delle righe in `lib/supabase/tipi.ts` devono restare `type` e non `interface`, altrimenti l'inferenza di supabase-js collassa su `never`.

Prima di scrivere codice: `npm test`, `npm run verifica:denaro`, `npm run lint` devono passare.

---

## Documenti — leggere prima di lavorare

| File | Quando serve |
|---|---|
| `01-VISIONE-E-DECISIONI.md` | Prima di proporre qualsiasi cambiamento architetturale |
| `02-MODELLO-DATI.md` | Ogni volta che tocchi il database o scrivi una query |
| `03-ARCHITETTURA.md` | Struttura file, offline, prestazioni, gestione errori |
| `04-UX-MOBILE.md` | Ogni volta che scrivi interfaccia |
| `05-ROADMAP.md` | Per sapere cosa fare adesso e quando è finito |
| `06-SETUP-SUPABASE.md` | Setup e problemi di database |
| `07-LISTINO.md` | Prodotti reali, prezzi, modello a varianti |
| `08-COLLAUDO.md` | Protocollo di T-18: come si misura ogni criterio dietro il banco |
| `09-DIARIO.md` | **Prima di toccare migrazioni, cache del saldo o messaggi d'errore.** Ci sta scritto cosa è già andato storto lì, e perché |

**Non iniziare un task senza aver letto il documento pertinente.**

---

## Regole assolute

### Denaro

- Tutti gli importi sono **interi in centesimi**. Mai `float`, mai `numeric` per il denaro.
- `/ 100` compare in **un solo punto** del codice: dentro `formatEuro` in `lib/dominio/denaro.ts`. Se lo scrivi altrove, stai introducendo un bug.
- Ogni importo che esce verso l'interfaccia passa da `formatEuro` (o `centesimiInCampo` dentro un campo).
- **Gli importi si digitano stile bancomat: le cifre entrano da destra e la virgola non si scrive mai.** "250" vale 2,50 €. Vale su *tutti* i campi importo, tastierino o tastiera di sistema — se una schermata leggesse "250" diversamente da un'altra, l'ambiguità tornerebbe dentro. Funzioni: `digitaCifre`, `cancellaCifra`, `cifreInCentesimi`, `mascheraImporto`. `parseEuro` serve a leggere testo già scritto, **non** all'inserimento.

### Dati

- **Il saldo non si memorizza mai.** Si legge da `v_saldo_clienti`. Non creare colonne `saldo`, non scrivere trigger che aggiornano totali.
- **I movimenti sono immutabili.** Righe e pagamenti non si modificano: si stornano con un movimento di segno opposto. Unica eccezione, già implementata nel database: eliminazione riga entro 60 secondi a conto aperto.
- **Il prezzo si congela sulla riga.** Quando aggiungi una riga, copia `descrizione` e `prezzo_unitario_cent` dal prodotto. Non leggerli dal catalogo al momento del pagamento.
- **Ogni scrittura porta un `op_id`** uuid generato dal dispositivo. È la protezione dai doppi invii. Un errore di chiave duplicata su `op_id` **non è un errore**: significa "già registrato", va trattato come successo.
- **Gli id li genera il client** (`crypto.randomUUID()`), non il database.

### Interfaccia

- Bersaglio di tocco minimo **56×56 px** per le azioni frequenti.
- Testo mai sotto **16 px**, importi a 20 px o più.
- Azioni principali nella **metà bassa** dello schermo.
- **Non si scorre per confermare.** Prima di mettere `autoFocus` su un campo dentro un pannello, guarda cosa copre la tastiera quando si apre: se copre l'azione principale, il pannello è sbagliato. Dove si digitano importi la tastiera di sistema non si usa affatto — c'è `components/comune/tastierino.tsx`.
- Ogni azione dell'utente aggiorna lo schermo **prima** di parlare con il server (aggiornamento ottimistico). L'utente non aspetta mai la rete.
- **Ogni schermata deve funzionare senza rete** o dire chiaramente perché non può. Le eccezioni sono elencate in `03-ARCHITETTURA.md` §4.5.
- Messaggi di errore in italiano comprensibile. Mai codici tecnici, mai "Qualcosa è andato storto".

### Lingua

- Interfaccia, nomi di tabelle, colonne, variabili, componenti e commenti: **italiano**.
- Eccezione: parole chiave del linguaggio e nomi di librerie.
- Coerenza sopra ogni cosa: se una colonna si chiama `creato_il`, la proprietà TypeScript si chiama `creatoIl`, non `createdAt`.

---

## Convenzioni di codice

| Elemento | Convenzione | Esempio |
|---|---|---|
| File | kebab-case | `griglia-prodotti.tsx` |
| Componenti React | PascalCase | `GrigliaProdotti` |
| Funzioni e variabili | camelCase italiano | `calcolaSaldoCliente` |
| Tabelle e colonne DB | snake_case italiano | `righe_conto`, `prezzo_unitario_cent` |
| Hook | `use-` + nome italiano | `use-conti-aperti.ts` |
| Tipi | PascalCase | `type Conto`, `type VoceCoda` |

### Direzione delle dipendenze

```
app/  →  components/  →  lib/hooks/  →  lib/supabase/ + lib/offline/
                                    ↘  lib/dominio/
```

**`lib/dominio/` non importa React né Supabase.** Solo funzioni pure. È lì che vivono le regole che non devono mai sbagliare, ed è lì che si scrivono i test.

---

## Come lavorare su un task

1. Leggi il task in `05-ROADMAP.md`, inclusi i criteri di accettazione.
2. Leggi i documenti indicati nel task.
3. Se un criterio è ambiguo, **chiedi** invece di interpretare.
4. Implementa.
5. Verifica ogni criterio, uno per uno. Non dichiarare fatto un task con criteri non verificati.
6. Esegui `npm run build` e `npm test`: devono passare puliti.
7. Esegui il controllo del denaro:

```bash
grep -rn "/ 100" --include=*.ts --include=*.tsx app components lib
# deve trovare una sola riga, dentro lib/dominio/denaro.ts
```

---

## Cosa fare quando qualcosa non torna

**Se un requisito sembra sbagliato:** dillo. Meglio una discussione prima che una riscrittura dopo.

**Se una decisione documentata sembra sbagliata:** dillo, citando il codice della decisione (DEC-01…DEC-08). Non aggirarla in silenzio. Se il ragionamento regge, il documento si aggiorna.

**Se un task richiede più di quanto sembrava:** fermati e segnalalo prima di scrivere codice, non a metà.

**Se non sai se qualcosa deve funzionare offline:** la risposta predefinita è sì. Se pensi di no, chiedi.

---

## Cosa non fare mai

- Aggiungere dipendenze non elencate in `03-ARCHITETTURA.md` §1 senza chiedere.
- Scrivere la chiave `service_role` in un file dentro `app/` o `components/`.
- Disattivare RLS "per fare una prova".
- Eseguire migrazioni sul progetto Supabase di produzione senza averle provate.
- **Modificare una migrazione già applicata.** Supabase confronta il contenuto di quelle registrate in remoto: cambiarne una fa fallire il push successivo per disallineamento di cronologia. Un prodotto aggiunto dall'app va rispecchiato in un file **nuovo** (`0014_bitter_con_aggiunta.sql` è il modello), mai dentro `0004_listino.sql`.
- Aggiungere schermate o funzioni non previste dalla roadmap perché "servivano".
- Iniziare la Fase 2 prima che T-19 sia chiuso.
- Usare `any` in TypeScript.
- Lasciare un `console.log` nel codice consegnato.

---

## Contesto sul dominio

Alcune cose che non sono ovvie a chi non ha lavorato in un bar, e che spiegano scelte apparentemente strane:

- **Il credito non si blocca.** Anche quando un cliente supera il limite, l'app avvisa ma non impedisce. Rifiutare un caffè a un cliente storico davanti agli altri è socialmente inaccettabile: l'avviso serve al barista, non al cliente.
- **Il sollecito è un promemoria fra persone che si conoscono**, non un'azione di recupero crediti. Il tono del messaggio precompilato conta più della funzione. Nessun invio automatico, mai.
- **Le mani sono bagnate e c'è fila.** È il motivo dei 56 px, del vincolo dei 3 tap e dell'assenza di conferme sulle azioni reversibili.
- **Il turno inizia alle 5 del mattino in un locale in penombra.** Da cui il tema scuro predefinito.
- **Il foglio di carta è il concorrente.** Se l'app è più lenta del foglio, perde. Ogni funzione aggiunta va pesata contro questo.
