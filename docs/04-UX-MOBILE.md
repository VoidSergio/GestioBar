# UX mobile-first — schermate e flussi

> Specifica esecutiva. Descrive cosa vede l'utente e in quanti tap.
> Il vincolo che governa tutto: **registrare un caffè a un cliente in 3 tap**.

---

## 1. Principi non negoziabili

1. **Il pollice destro tiene il telefono.** Le azioni frequenti stanno nella metà bassa dello schermo. La parte alta è per le informazioni, non per i pulsanti.
2. **Nessuna conferma per le azioni reversibili.** Aggiungere un caffè non chiede "sei sicuro?". Chiede invece una conferma incassare un pagamento, che non è reversibile.
3. **Il numero più importante è il più grande.** Su ogni schermata c'è un solo numero grande: al banco è il totale del conto, sui Crediti è il credito in giro, sul cliente è il suo saldo.
4. **Niente schermate vuote mute.** Uno stato vuoto dice cosa fare, oppure non è uno stato vuoto: al banco non c'è nessun messaggio perché c'è già la griglia, e si comincia toccando un prodotto.
5. **L'errore non blocca l'inserimento.** Se la rete manca, l'app funziona lo stesso e lo dice con discrezione.

---

## 2. Navigazione

Tab bar fissa in basso, quattro voci. Niente menu a panino: un menu nascosto costa un tap in più su ogni spostamento, e in un bar quel tap non c'è.

```
┌─────────────────────────────────┐
│                                 │
│         contenuto               │
│                                 │
├─────────────────────────────────┤
│  🏠      👥      💰      ⚙️     │
│ Banco  Clienti 348,50   Altro   │
└─────────────────────────────────┘
```

| Tab | Contenuto |
|---|---|
| **Banco** | Il conto in composizione, con la griglia prodotti. È la schermata di apertura (§3). |
| **Clienti** | Elenco e ricerca clienti, accesso alle schede. |
| **Crediti** | Chi deve soldi, ordinato per anzianità del debito. |
| **Altro** | Scontrini, listino, chiusura turno, report, magazzino (F3), impostazioni. |

**Il credito in giro sta sulla scheda Crediti**, al posto della parola "Crediti", in rosso, quando c'è qualcosa da incassare. Era il numero grande della vecchia home; adesso che la home è la griglia dei prodotti non ha più una schermata tutta sua, ma non poteva finire dietro un tocco — è la ragione per cui esiste il progetto. Qui è piccolo e sempre a schermo: la mattina si legge accendendo l'app, senza cercarlo.

---

## 3. Schermata: Banco (home)

**La schermata di apertura è la griglia dei prodotti.** L'app tiene sempre pronto un conto al banco: aperta l'app, il primo tocco è già il prodotto.

```
┌─────────────────────────────────┐
│ [Banco ▾] ●  [Mario  4,80] ┌─┐  │  ← striscia conti, scorrevole  │+│
│                            └─┘  │
├─────────────────────────────────┤
│ Caffè         − 2 +      2,40 € │  ← quello che stai battendo
│ 1,20 l'uno                      │
├─────────────────────────────────┤
│ ┌───┬───┬───┬───┬───┬───┬──▸    │
│ │Tut│Caf│Acq│Bib│Foo│Bir│       │  ← filtro categorie
│ └───┴───┴───┴───┴───┴───┴──     │
│ ┌────────┬────────┬────────┐    │
│ │ Caffè  │ Caffè  │Cappucc.│    │
│ │ 1,20 ▾ │macchia.│ 1,70 ▾ │    │  ← la griglia, subito
│ ├────────┼────────┼────────┤    │
│ │ Acqua  │ Acqua  │ Pasta  │    │
│ └────────┴────────┴────────┘    │
├─────────────────────────────────┤
│  Totale conto        2,40 €     │
│ ┌──────────────┬──────────────┐ │
│ │   INCASSA    │   A CREDITO  │ │
│ └──────────────┴──────────────┘ │
├─────────────────────────────────┤
│  🏠      👥      💰      ⚙️     │
│ Banco  Clienti 348,50   Altro   │
└─────────────────────────────────┘
```

### Perché non è più l'elenco dei conti aperti

Lo era, e il conto dei tap tornava: home → **+** (1) → Mario (2) → Caffè (3). Tre tap, come promesso.

Quello che non tornava è **dove** cadevano quei tap. Due dei tre servivano *prima* di poter cominciare, e si pagavano anche quando non c'era nessun nome da mettere — il cliente che paga e se ne va, che è la maggior parte della giornata. Il vincolo dei tre tap era misurato dal punto sbagliato: contava la strada per registrare *a un cliente*, non quella per registrare e basta.

**L'ordine delle domande si è invertito.** Prima: chi è → cosa prende. Adesso: cosa prende → e solo se resta a debito, chi è. Nel bar l'ordinazione arriva prima del nome, e sul foglio di carta — il concorrente — non si scrive un nome prima di segnare un caffè.

Si può fare perché la bozza è locale fino alla conferma (DEC-08): finché non si conferma non c'è nessuna riga registrata a cui stare cambiando l'intestatario.

**Il conto dei tap adesso:**

| Cosa | Tap |
|---|---|
| un caffè a chi paga subito | 1 (il prodotto) + INCASSA + CONFERMA |
| un caffè a Mario, a credito | 1 (il prodotto) + A CREDITO + Mario |

**Comportamenti:**

- Il conto al banco lo crea l'app da sola, se non c'è. È una bozza vuota: non tocca il database e non compare fra i conti aperti finché non ci batti dentro qualcosa.
- **La striscia in cima** ha preso il posto dell'elenco: i conti aperti a nome di qualcuno sono etichette in fila con il loro totale, si leggono di sfuggita e si aprono con un tocco (§5). Un banco vuoto non compare: non è un conto aperto, è il posto dove si comincia a battere.
- **La prima etichetta è il conto in corso.** Si tocca per intestarlo a un cliente senza perdere quello che si è già battuto. Se quel cliente ha già un conto aperto, le voci ci confluiscono dentro invece di aprirgliene un secondo.
- Il **+** apre invece un conto *a parte*, senza toccare quello in corso: serve quando arriva un secondo gruppo mentre stai ancora battendo il primo. Se anche il secondo è senza nome si chiama "Banco 2", poi "Banco 3": due etichette identiche nella striscia sono peggio di niente, ci si mette dentro l'ordinazione sbagliata senza accorgersene.
- **Il conto in corso resta quello anche quando gli dai un nome.** Non è un dettaglio di implementazione: se la schermata ricavasse ogni volta "il conto senza cliente", nell'istante dell'assegnazione l'ordinazione sparirebbe dallo schermo. È successo — `09-DIARIO.md`, 12 agosto.
- La **✕** compare solo quando c'è qualcosa da buttare via, e svuota il conto in corso.
- **A CREDITO senza cliente non sparisce, chiede a chi.** È l'unico momento in cui il nome serve davvero, ed è lì che si chiede.

---

## 4. Flusso: "a chi?"

Il pannello che chiede il cliente sale dal basso. È sempre lo stesso; cambiano la domanda in cima e cosa si fa con la risposta.

| Da dove | La domanda | Cosa succede |
|---|---|---|
| il nome del conto in corso | "Di chi è questo conto?" | lo intesta, e si continua a battere |
| il **+** | "Un altro conto, a chi?" | ne apre uno a parte, quello in corso non si tocca |
| **A CREDITO** senza cliente | "A chi lo segno?" | lo intesta e lo chiude. **Qui "Banco" non compare** |
| il nome dentro il pannello Incassa | "Chi paga?" | lo intesta senza chiudere il pannello |

La domanda cambia perché costa zero e toglie un'esitazione: "A chi?" davanti a un conto già battuto non dice se stai per chiuderlo o per rinominarlo.

```
┌─────────────────────────────────┐
│ ─────                           │  ← maniglia, si chiude scorrendo giù
│ A chi?                          │
│ ┌───────────────────────────┐   │
│ │ 🔍 Cerca o scrivi nome    │   │  ← tastiera aperta subito
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │  🏪  Banco (paga subito)  │   │  ← sempre in cima
│ └───────────────────────────┘   │
│                                 │
│ FREQUENTI                       │
│  Mario Rossi        deve 24,50 €│
│  Giulia Bianchi     in pari     │
│  Franco (Ciccio)    deve 8,00 € │
│  Anna Verdi         in pari     │
│                                 │
│ ┌───────────────────────────┐   │
│ │  + Nuovo cliente          │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Dettagli che contano:**

- I clienti "frequenti" sono quelli con più conti negli ultimi 30 giorni, non quelli in ordine alfabetico e **non quelli che devono di più**. Sono due domande diverse: l'elenco Clienti serve a cercare qualcuno per incassare, e lì conta il debito; qui si sta aprendo un conto, e conta chi è probabile che sia la persona davanti — nel bar è quello che viene tutte le mattine. Nel 90% dei casi è tra i primi quattro e non serve digitare.
- Chi non è passato negli ultimi 30 giorni non sparisce: scende sotto, ordinato come nell'elenco Clienti. È il caso del cliente nuovo, che ha zero conti e va comunque trovato — ma dopo quelli veri. Se il conteggio non è ancora arrivato (prima apertura, rete assente e cache fredda) l'ordine è quello dell'elenco Clienti: peggiore, mai vuoto.
- Accanto a ogni nome si vede già **quanto deve**. Il barista decide con l'informazione davanti, non dopo.
- Se il cliente supera il limite di credito, il saldo appare in rosso con un'icona di avviso. Non blocca (vedi §3.3 del modello dati).
- Digitando, la ricerca filtra su nome e soprannome. Se non trova nulla, il pulsante diventa "+ Crea 'Marc'" — creare un cliente non deve costare più di digitarne il nome.
- Se il cliente ha **già un conto aperto**, il tap ci porta dentro invece di crearne un altro. Silenziosamente: non è un errore, è la cosa giusta.

Selezionato il cliente → si apre direttamente il dettaglio conto con la griglia prodotti. **Nessuna schermata intermedia.**

---

## 5. Schermata: Dettaglio conto

```
┌─────────────────────────────────┐
│ ←   Mario Rossi          ● sync │
│     deve già 24,50 €            │  ← contesto sempre visibile
├─────────────────────────────────┤
│ Caffè         − 2 +      2,40 € │  ← quantità netta del gruppo
│ 1,20 l'uno                      │
│ Cappuccino deca − 1 +    1,80 € │  ← variante sempre scritta
│ 1,80 l'uno                      │
├─────────────────────────────────┤
│ ┌───┬───┬───┬───┬───┬───┬──▸    │
│ │Tut│Caf│Acq│Bib│Foo│Bir│       │  ← filtro categorie, scorrevole
│ └───┴───┴───┴───┴───┴───┴──     │     (poi Ape, Vin, Sup)
│ ┌────────┬────────┬────────┐    │
│ │ Caffè  │ Caffè  │Cappucc.│    │
│ │ 1,20 ▾ │macchia.│ 1,70 ▾ │    │  ← griglia 3 colonne
│ │        │ 1,30 ▾ │        │    │     riquadri ≥ 100×72 px
│ ├────────┼────────┼────────┤    │     ▾ = ha varianti
│ │ Acqua  │ Acqua  │ Pasta  │    │
│ │bicchie.│bottigl.│ 1,50   │    │
│ │ 0,30   │ 1,00 ▾ │        │    │
│ ├────────┼────────┼────────┤    │
│ │Pizzetta│ Latte  │Caffell.│    │
│ │sfoglia │macchia.│ 1,80 ▾ │    │
│ │ 1,50   │ 1,80 ▾ │        │    │
│ └────────┴────────┴────────┘    │
├─────────────────────────────────┤
│  Totale conto        5,70 €     │
│ ┌──────────────┬──────────────┐ │
│ │   INCASSA    │   A CREDITO  │ │  ← due azioni, entrambe grandi
│ └──────────────┴──────────────┘ │
└─────────────────────────────────┘
```

È la stessa schermata del banco (§3) con un'altra intestazione: freccia indietro, nome del cliente, quanto deve già. Ci si arriva dalla striscia in cima o dalla scheda cliente.

**Comportamenti:**

- Tap su un prodotto: la riga compare **immediatamente** in cima all'elenco, con un breve lampeggio. Vibrazione breve se il dispositivo la supporta.
- Tap ripetuto sullo stesso prodotto: nell'elenco compare **una voce sola con la quantità** — "Ichnusa ×2" — invece di due righe uguali. Vale per la stessa variante: due caffè normali si sommano, un normale e un decaffeinato restano voci separate.
- Ogni voce ha i pulsanti **−** e **+** a destra, sotto il pollice. Il **−** toglie un'unità.
- **Prodotti con varianti** (il ▾): il tap breve addebita la versione normale, il tap sul ▾ o la pressione prolungata apre l'elenco delle varianti. Il dettaglio completo sta in `07-LISTINO.md` §4.

### Che cosa succede davvero quando premi −

Il documento diceva, nella prima stesura, che il tap ripetuto "incrementa la quantità della riga esistente". Era in contraddizione con DEC-03: le righe sono immutabili, e incrementare una quantità è una modifica. La contraddizione è emersa quando è servito **diminuire**.

**Risoluzione: ogni tap crea una riga da un'unità.** Non si modifica mai niente. Il raggruppamento è solo per la lettura — "Ichnusa ×2" a schermo sono due righe nel database, ognuna con la sua ora esatta.

Il **−** ha quindi due comportamenti, e il confine è già scritto nel database (trigger `blocca_cancellazione_riga`):

| Quando | Cosa fa | Perché |
|---|---|---|
| entro **60 secondi** | cancella la riga davvero | è un errore di battitura, non deve lasciare traccia |
| dopo 60 secondi | aggiunge uno storno di −1 | è storia: il cliente ha cambiato idea, e si deve poter ricostruire |

Toglie sempre l'unità **battuta per ultima**: è quella sbagliata, ed è anche l'unica che ha buone probabilità di rientrare nei 60 secondi.

**Gli storni non compaiono come voci a sé nel conto.** Abbassano la quantità del loro gruppo, e basta: "Ichnusa ×2" diventa "Ichnusa ×1". La schermata del conto serve a lavorare con la fila davanti, non a fare l'istruttoria.

La storia completa — ogni riga, ogni storno, con l'ora — resta nell'**estratto conto del cliente** (§8). È lì che si guarda quando qualcuno contesta, ed è lì che DEC-03 mantiene la sua promessa. Separare le due schermate è una scelta: velocità dove si lavora, tracciabilità dove si discute.

- Un gruppo che arriva a zero sparisce dall'elenco: "Ichnusa ×0" non aiuta nessuno.
- I prodotti "preferiti" occupano le prime posizioni: i sei più usati devono stare nella prima schermata senza scorrere.
- La barra del totale è **fissa in basso**, sempre visibile mentre si scorre.

**Le due azioni finali:**

| Azione | Cosa fa |
|---|---|
| **INCASSA** | Apre il pannello pagamento (§6). Il conto si chiude quando è saldato. |
| **A CREDITO** | Chiude il conto senza pagamento. L'importo va sul saldo del cliente. Un tap, nessuna conferma — è l'azione più frequente per i clienti abituali. |

Per il conto "Banco", **A CREDITO** non compare: non c'è un cliente a cui addebitarlo.

---

## 6. Flusso: incassare

```
┌─────────────────────────────────┐
│ ─────                           │  ┐
│ SCONTRINO BATTUTO?              │  │
│ ┌─────────────┬───────────────┐ │  │  ferma
│ │   ✓ SÌ      │      NO       │ │  │  in alto
│ └─────────────┴───────────────┘ │  │
│ Quanto ti ha dato   [ Banco ▾ ] │  │
│ ┌───────────────────────────┐   │  │
│ │                    32,90  │   │  │
│ └───────────────────────────┘   │  ┘
│ Conto di Mario         8,40 €   │  ┐
│ Debito precedente     24,50 €   │  │  scorre
│ Totale dovuto         32,90 €   │  │  solo
│ [Solo il conto 8,40][Tutto 32,90]  │  questa
│ [Contanti][ Carta ][ Altro ]    │  ┘
│ ┌───────┬───────┬───────┐       │  ┐
│ │   1   │   2   │   3   │       │  │
│ │   4   │   5   │   6   │       │  │  fermo
│ │   7   │   8   │   9   │       │  │  in basso
│ │  00   │   0   │   ⌫   │       │  │
│ └───────┴───────┴───────┘       │  │
│ ┌────────┬──────────────────┐   │  │
│ │Annulla │    CONFERMA      │   │  │
│ └────────┴──────────────────┘   │  ┘
└─────────────────────────────────┘
```

### Tre fasce, e una regola sola: non si scorre per confermare

In alto e ferma la scelta dello scontrino e l'importo — quello che devi vedere mentre digiti. In basso e fermo il tastierino con CONFERMA — tutto quello che il pollice deve raggiungere. In mezzo, e solo in mezzo, la parte che eventualmente scorre. Su un telefono normale non scorre niente.

**Niente tastiera di sistema.** Si mangiava metà schermo, e in un pannello dove bisogna anche vedere il dovuto, scegliere il metodo e arrivare a CONFERMA quella metà voleva dire scorrere *con la tastiera aperta*: il gesto più scomodo che ci sia con una mano sola. E i suoi tasti sono piccoli, perché sono fatti per scrivere parole. Qui servono dieci cifre, e servono grandi.

**Lo scontrino è due tasti, non una spunta, ed è la prima cosa in alto.** Una spunta in mezzo al pannello finiva fuori schermo con la tastiera aperta, e una spunta che non si vede è una spunta che nessuno controlla. Il tasto scelto è pieno di colore e porta il segno di spunta — in penombra due tinte si confondono, un ✓ no. Resta la memoria dell'ultima scelta, perché al banco è quasi sempre la stessa: la differenza è che ora la scelta ricordata **si vede**.

**Chi paga si sceglie anche qui.** Accanto a "Quanto ti ha dato" c'è il nome del conto: "Banco ▾" se non ne ha uno, il cliente se ce l'ha. Si tocca e si intesta, senza chiudere il pannello.

Serve perché un conto battuto al banco non ha un nome — e va benissimo finché lo si incassa e basta. Ma se quello davanti è un cliente abituale, perché lascia un pezzo, perché ha un debito vecchio da coprire, o solo perché la consumazione deve restare nella sua storia, il nome serve **adesso**, non prima di battere il caffè. Chiederlo qui costa un tocco a chi ne ha bisogno e zero a tutti gli altri.

Intestando il conto a pannello aperto il dovuto cambia: al totale si aggiunge il debito che quella persona si trascina. Il precompilato lo segue, ma solo finché nessuno ha toccato il tastierino — una cifra scritta a mano non si sovrascrive mai.

**A CREDITO invece non accetta il banco.** Quando la domanda è "a chi lo segno?", la voce "Banco" non compare: un debito senza intestatario non è un debito, sono soldi che escono e non compaiono da nessuna parte. La regola non vive qui, però: sta in `puoAndareACredito` (`lib/dominio/bozza.ts`), con i test intorno. Il perché è in `09-DIARIO.md`.

**Dettagli:**

- Il campo importo è **modificabile**: il cliente può dare 20 € su 32,90 di debito. Il resto rimane a saldo.
- È precompilato col dovuto, e **il primo tocco sul tastierino lo azzera**: chi tocca una cifra sta dicendo "non è questa la somma". Se le cifre si aggiungessero in coda, un tocco distratto trasformerebbe 32,90 in 329,00.
- Le due scorciatoie coprono i casi reali: "pago quello di adesso" e "salda tutto".
- Se l'importo inserito supera il dovuto, l'app mostra il resto da dare: "Resto: 7,10 €". Non lo registra come credito del cliente a meno che non si scelga esplicitamente "lascia come acconto".
- Dopo la conferma: schermata di riepilogo per 2 secondi con il nuovo saldo. Dal dettaglio si torna indietro; dal banco non si va da nessuna parte — il conto successivo è già pronto e la griglia riappare.

Stessa disposizione nel pannello d'incasso della scheda cliente (§8) e stesso tastierino nella chiusura di turno: due pannelli che fanno la stessa cosa devono avere i comandi nello stesso posto, altrimenti la memoria del pollice si confonde proprio quando serve.

---

## 6.1 Come si scrivono gli importi

**Le cifre entrano da destra, come su un bancomat. La virgola non si digita mai.**

```
 2      →   0,02
 25     →   0,25
 250    →   2,50
 25000  → 250,00
```

Al banco la virgola è un tasto sbagliato: si digita con una mano sola, spesso bagnata, e premuta o dimenticata per sbaglio sposta un importo di un fattore cento senza che nessuno se ne accorga. Togliendola, il valore in lavorazione è **sempre un intero di centesimi**: non esiste lo stato intermedio "testo che forse è un numero", quindi non esiste il momento in cui l'importo è ambiguo.

La regola vale **su tutti i campi importo dell'app**, tastierino o tastiera di sistema che sia — anche sui prezzi del listino, dove si scrive con calma. Se "250" valesse 2,50 € in una schermata e 250,00 € in un'altra, l'ambiguità che questa regola toglie di mezzo tornerebbe dentro dalla porta di servizio.

Le funzioni sono in `lib/dominio/denaro.ts` (`digitaCifre`, `cancellaCifra`, `cifreInCentesimi`, `mascheraImporto`) e hanno 16 test. `parseEuro` resta per leggere testo già scritto, non per l'inserimento.

---

## 7. Schermata: Crediti

È la schermata per cui esiste il sistema.

```
┌─────────────────────────────────┐
│ Crediti                         │
│                                 │
│  Totale da incassare            │
│      348,50 €                   │
│      da 12 clienti              │
│                                 │
│ ┌─────┬─────┬─────┬─────┐       │
│ │Tutti│ >30g│ >60g│Sopra│       │  ← filtri per anzianità e limite
│ └─────┴─────┴─────┴─────┘       │
│                                 │
│ ┌───────────────────────────┐   │
│ │ 🔴 Franco (Ciccio)        │   │
│ │    68,00 €      da 47 gg  │   │
│ │    📞 Chiama   💬 Scrivi  │   │
│ ├───────────────────────────┤   │
│ │ 🟠 Anna Verdi             │   │
│ │    42,50 €      da 22 gg  │   │
│ ├───────────────────────────┤   │
│ │ 🟢 Mario Rossi            │   │
│ │    24,50 €       da 5 gg  │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Codice colore per anzianità:** verde fino a 15 giorni, arancione fino a 45, rosso oltre. È l'anzianità che conta, non l'importo — un debito piccolo e vecchio è un problema, uno grande e recente no.

**Azioni rapide** sulla riga espansa:

- **Chiama**: apre il telefono con il numero già composto.
- **Scrivi**: apre WhatsApp o SMS con un messaggio precompilato ed **educato**, modificabile prima dell'invio:

  > Ciao Franco, ti scrivo dal Bar Centrale. Quando passi, il conto è di 68,00 €. Grazie!

  Il tono conta più della funzione: un sollecito automatico che suona come un'agenzia di recupero crediti fa perdere il cliente. Il messaggio è un promemoria fra persone che si conoscono.

- Tap sul nome → scheda cliente con estratto conto completo.

Nessun invio automatico. L'app prepara il messaggio, la persona decide se mandarlo.

---

## 8. Schermata: Scheda cliente

```
┌─────────────────────────────────┐
│ ←   Mario Rossi            ⋮    │
│     347 123 4567                │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Deve      24,50 €        │  │
│  │  dal 28 luglio (5 giorni) │  │
│  └───────────────────────────┘  │
│                                 │
│ ┌──────────────┬──────────────┐ │
│ │ APRI CONTO   │   INCASSA    │ │
│ └──────────────┴──────────────┘ │
│                                 │
│ MOVIMENTI                       │
│  Oggi                           │
│   Caffè ×2            2,20 €    │
│   Cornetto            1,20 €    │
│  Venerdì 31 luglio              │
│   Pagamento contanti −20,00 €   │
│   Spritz ×2          10,00 €    │
│  Giovedì 30 luglio              │
│   Caffè               1,10 €    │
│   ~~Birra media~~     ~~5,00~~  │  ← stornata
│   Storno Birra       −5,00 €    │
│                                 │
│         [ Carica altro ]        │
└─────────────────────────────────┘
```

- I movimenti sono raggruppati per giorno, dal più recente.
- I pagamenti sono in verde con segno meno, le consumazioni in nero.
- Gli storni restano visibili: è il punto di DEC-03. Quando il cliente chiede "ma io quella birra non l'ho presa", la risposta è sullo schermo.
- Il menu **⋮** contiene: modifica anagrafica, imposta limite di credito, esporta estratto conto (PDF/testo da inviare), disattiva cliente.

**Un giorno solo.** Accanto a MOVIMENTI c'è un selettore di data: scelto un giorno si vede che cosa
ha preso quel cliente e **a che ora**. Serve quando qualcuno chiede "ma giovedì che cosa ho
preso?", e scorrere all'indietro trenta righe per volta su un cliente abituale sono venti tocchi.

In quella modalità **il saldo progressivo sparisce**, e non è una semplificazione: il progressivo
si calcola partendo dal saldo di adesso e tornando indietro, quindi vale solo se le righe in mano
sono le più recenti. Ancorarlo a un giovedì di tre settimane fa darebbe una colonna di numeri
plausibili e tutti sbagliati. Al suo posto c'è l'ora, che è poi quello che si stava cercando.

---

## 9. Schermata: Listino

Si usa raramente, quindi non deve essere veloce — deve essere chiara.

- Elenco per categoria, con prezzo modificabile in linea.
- Interruttore "preferito" su ogni prodotto, con avviso se se ne segnano più di 9 (la griglia visibile ne contiene 9).
- **Riordino a modalità.** Il tasto "↕ Riordina" in alto trasforma l'elenco: ogni prodotto mostra ⇈ (in cima), ↑ e ↓ da 56 px, e sparisce tutto il resto. Fuori da quella modalità la schermata è quella di sempre — si riordina una volta ogni tanto, e per il resto dell'anno quelle frecce sarebbero solo roba da saltare con l'occhio.

  Non è il trascinamento che diceva la prima stesura di questo documento. Il trascinamento su telefono litiga con lo scorrimento della pagina, e in un elenco di 63 prodotti "portare qualcosa fra i primi" vorrebbe dire trascinare mentre la lista scorre da sola. Il tasto **in cima** fa in un tocco il gesto che serve davvero. Il ragionamento completo sta in `05-ROADMAP.md`, T-16.

  Si sposta il **prodotto**, non la variante: le varianti seguono, perché nella griglia sono un riquadro solo.
- Quando si cambia un prezzo, un avviso ricorda che vale solo per le consumazioni future (DEC-05). Serve a rassicurare, non a chiedere conferma.
- Un prodotto si "disattiva", non si elimina.

---

## 9.1 Schermata: Report

Si apre la sera, da fermi, con le mani asciutte. **È l'unica schermata dell'app che non insegue
nessun vincolo di tap**, e lo dichiara: qui si scorre, si legge, si confronta. Non scrive niente —
se un numero è sbagliato si riscrive una vista, non si perde un dato.

Richiede la rete e lo dice. Sono somme su mesi di movimenti: tenerle nella copia locale vorrebbe
dire portarsi dietro tutto lo storico sul telefono per una schermata che si guarda due volte al
giorno (`03-ARCHITETTURA.md` §4.5).

**Periodo:** oggi, ieri, settimana, mese. "Settimana" è **la settimana in corso da lunedì**, non
gli ultimi sette giorni: al banco "come sta andando la settimana" vuol dire quella, e un totale che
comprende mezzo lunedì scorso non si confronta con niente.

### La riga che evita la telefonata delle undici di sera

Sotto credito concesso e rientrato c'è scritto, in italiano:

> Venduto e incassato non coincidono di **150,00 €**: non manca niente, il credito in giro è
> cresciuto.

Senza quella frase, una giornata da 400 € di consumazioni con 250 € in cassa sembra un ammanco, e
lo si cerca per mezz'ora. Le due grandezze **non devono** coincidere: la loro differenza è di
quanto si è mosso il credito (`02-MODELLO-DATI.md` §4.3).

### Che cosa esce, e che cosa no

I quindici più venduti del periodo, con quantità e incasso. Sotto, ripiegato, **il rovescio**:
quello che sta a catalogo e non è uscito. Ognuno occupa un riquadro nella griglia e allunga la
ricerca a tutti — è la stessa lettura, dal basso.

### Chi consuma

Classifica per mese corrente o per sempre. In fondo, sempre visibile:

> Qui ci sono solo i conti intestati. Quello battuto al banco non ha un nome e resta fuori.

Non è una nota a piè di pagina: da quando la schermata di apertura è la griglia, i conti anonimi
sono la maggioranza del giro. Senza quella riga il totale della classifica sembra sbagliato.

Sotto, **chi non si vede da un po'**: i clienti che non passano da tre settimane, dal più assente.
Le classifiche mostrano chi c'è, non chi manca — e chi manca è la domanda più utile delle due.

### A che ora si lavora

Una griglia ore × giorni degli ultimi novanta giorni: più pieno è il quadratino, più si è
lavorato. Nessun numero dentro — a colpo d'occhio serve la forma, non il conteggio esatto delle 8
di giovedì, che non cambia nessuna decisione. Novanta giorni e non sempre: le abitudini di un bar
cambiano con la stagione, e una media su due anni descrive un locale che non esiste più.

### Esportazione

Due file, giornate e prodotti, sul periodo scelto. Si aprono in Excel italiano: punto e virgola
come separatore, virgola decimale, date `12/08/2026`. Il criterio non è "è un CSV valido", è **"si
apre in Excel"** — sono due cose diverse, e la seconda è quella che conta (`lib/dominio/csv.ts`).

---

## 10. Stati e messaggi

| Situazione | Cosa vede l'utente |
|---|---|
| Banco vuoto | Nessun messaggio: c'è la griglia, e si comincia toccando un prodotto |
| Nessun credito | "Nessuno ti deve soldi. 🎉" |
| Nessun cliente registrato | "Ancora nessun cliente — creane uno aprendo un conto" |
| Offline, coda vuota | punto ambra, "Senza rete" |
| Offline con operazioni in coda | "3 da inviare" — tappabile per l'elenco |
| Operazione fallita | banda rossa in alto: "Un'operazione non è stata registrata — tocca per vedere" |
| Cliente oltre il limite | badge rosso sul nome: "Oltre il limite (100 €)" |
| Conto chiuso da un altro dispositivo | "Questo conto è appena stato chiuso da un altro dispositivo. Apro un conto nuovo?" con pulsante |

---

## 11. Aspetto

**Tema scuro come predefinito.** Il bar è spesso in penombra e il turno inizia alle 5 del mattino. Il tema chiaro resta disponibile nelle impostazioni.

Palette essenziale:

| Ruolo | Chiaro | Scuro |
|---|---|---|
| Sfondo | `#ffffff` | `#0f172a` |
| Superficie | `#f8fafc` | `#1e293b` |
| Testo | `#0f172a` | `#f1f5f9` |
| Accento (azione) | `#0891b2` | `#22d3ee` |
| Credito / debito | `#dc2626` | `#f87171` |
| Pagamento / positivo | `#16a34a` | `#4ade80` |
| Attenzione | `#ea580c` | `#fb923c` |

Tipografia: font di sistema (nessun caricamento da rete). Numeri con cifre a larghezza fissa (`font-variant-numeric: tabular-nums`) — le colonne di importi devono allinearsi.

Nessuna animazione oltre i 200 ms, e nessuna che ritardi la comparsa di un dato.

---

## 12. Le tre domande di verifica

Prima di considerare finita qualunque schermata:

1. **Si può usare con una mano sola, tenendo il telefono in basso?** Se un'azione frequente sta nella metà alta, la schermata è sbagliata.
2. **Quanti tap servono per l'azione più comune di questa schermata?** Se sono più di due oltre l'arrivo, va ripensata.
3. **Cosa succede se qui la rete non c'è?** Se la risposta è "non lo so", va deciso prima di scrivere il codice.

---

**Prossimo documento:** `05-ROADMAP.md`
