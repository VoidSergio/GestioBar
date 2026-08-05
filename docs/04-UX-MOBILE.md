# UX mobile-first — schermate e flussi

> Specifica esecutiva. Descrive cosa vede l'utente e in quanti tap.
> Il vincolo che governa tutto: **registrare un caffè a un cliente in 3 tap**.

---

## 1. Principi non negoziabili

1. **Il pollice destro tiene il telefono.** Le azioni frequenti stanno nella metà bassa dello schermo. La parte alta è per le informazioni, non per i pulsanti.
2. **Nessuna conferma per le azioni reversibili.** Aggiungere un caffè non chiede "sei sicuro?". Chiede invece una conferma incassare un pagamento, che non è reversibile.
3. **Il numero più importante è il più grande.** Su ogni schermata c'è un solo numero grande: sulla home è il credito totale, sul conto è il totale del conto, sul cliente è il suo saldo.
4. **Niente schermate vuote mute.** Uno stato vuoto dice cosa fare: "Nessun conto aperto. Tocca + per iniziare."
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
│ Conti  Clienti Crediti  Altro   │
└─────────────────────────────────┘
```

| Tab | Contenuto |
|---|---|
| **Conti** | Conti aperti adesso. È la schermata di apertura. |
| **Clienti** | Elenco e ricerca clienti, accesso alle schede. |
| **Crediti** | Chi deve soldi, ordinato per anzianità del debito. |
| **Altro** | Listino, cassa (F2), magazzino (F3), impostazioni. |

---

## 3. Schermata: Conti aperti (home)

```
┌─────────────────────────────────┐
│ Bar Centrale            ● sync  │
│                                 │
│  Credito in giro                │
│  ┌───────────────────────────┐  │
│  │      348,50 €             │  │  ← numero grande, tappabile → Crediti
│  │      12 clienti           │  │
│  └───────────────────────────┘  │
│                                 │
│  CONTI APERTI (3)               │
│  ┌───────────────────────────┐  │
│  │ Mario R.          4,80 €  │  │  ← tap → dettaglio conto
│  │ aperto 12 min fa      3 → │  │
│  ├───────────────────────────┤  │
│  │ Giulia          12,00 €   │  │
│  │ aperto 1 h fa         5 → │  │
│  ├───────────────────────────┤  │
│  │ Banco             2,20 €  │  │
│  │ aperto 2 min fa       2 → │  │
│  └───────────────────────────┘  │
│                                 │
│                         ┌─────┐ │
│                         │  +  │ │  ← pulsante flottante in basso a destra
│                         └─────┘ │
├─────────────────────────────────┤
│  🏠      👥      💰      ⚙️     │
└─────────────────────────────────┘
```

**Comportamenti:**

- I conti sono ordinati dal più recente. Il tempo trascorso è relativo ("12 min fa"), più utile dell'orario.
- Il conto si apre con un tap sulla riga intera, non su un pulsante piccolo.
- Il pulsante **+** apre la ricerca cliente (§4).
- Il riquadro del credito è tappabile e porta alla scheda Crediti.
- Se non ci sono conti aperti: "Nessun conto aperto — tocca + per aprirne uno", con il **+** evidenziato.

---

## 4. Flusso: aprire un conto (tap 1 e 2)

Tap **+** dalla home → si apre un pannello dal basso:

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

- I clienti "frequenti" sono quelli con più conti negli ultimi 30 giorni, non quelli in ordine alfabetico. Nel 90% dei casi la persona è tra i primi quattro e non serve digitare.
- Accanto a ogni nome si vede già **quanto deve**. Il barista decide con l'informazione davanti, non dopo.
- Se il cliente supera il limite di credito, il saldo appare in rosso con un'icona di avviso. Non blocca (vedi §3.3 del modello dati).
- Digitando, la ricerca filtra su nome e soprannome. Se non trova nulla, il pulsante diventa "+ Crea 'Marc'" — creare un cliente non deve costare più di digitarne il nome.
- Se il cliente ha **già un conto aperto**, il tap ci porta dentro invece di crearne un altro. Silenziosamente: non è un errore, è la cosa giusta.

Selezionato il cliente → si apre direttamente il dettaglio conto con la griglia prodotti. **Nessuna schermata intermedia.**

---

## 5. Schermata: Dettaglio conto (tap 3 = il prodotto)

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

**Il conteggio dei tap:** home → **+** (1) → Mario (2) → Caffè (3). Registrato. Vincolo rispettato.

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
│ ─────                           │
│ Incassa da Mario Rossi          │
│                                 │
│ Conto corrente        8,40 €    │
│ Debito precedente    24,50 €    │
│ ─────────────────────────────   │
│ Totale dovuto        32,90 €    │
│                                 │
│ ┌───────────────────────────┐   │
│ │        32,90              │   │  ← precompilato col totale
│ └───────────────────────────┘   │
│                                 │
│  [ Solo il conto: 8,40 € ]      │  ← scorciatoie
│  [ Tutto: 32,90 € ]             │
│                                 │
│ COME                            │
│ ┌────────┬────────┬────────┐    │
│ │Contanti│ Carta  │ Altro  │    │
│ └────────┴────────┴────────┘    │
│                                 │
│ ☐ Scontrino battuto             │
│                                 │
│ ┌───────────────────────────┐   │
│ │       CONFERMA            │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Dettagli:**

- Il campo importo è **modificabile**: il cliente può dare 20 € su 32,90 di debito. Il resto rimane a saldo.
- Le due scorciatoie coprono i casi reali: "pago quello di adesso" e "salda tutto".
- Se l'importo inserito supera il dovuto, l'app mostra il resto da dare: "Resto: 7,10 €". Non lo registra come credito del cliente a meno che non si scelga esplicitamente "lascia come acconto".
- Dopo la conferma: schermata di riepilogo per 2 secondi con il nuovo saldo, poi ritorno alla home. Il barista deve vedere il risultato senza dover cercare.
- La spunta "scontrino battuto" ricorda l'ultima scelta fatta, perché nella pratica è quasi sempre la stessa.

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

---

## 9. Schermata: Listino

Si usa raramente, quindi non deve essere veloce — deve essere chiara.

- Elenco per categoria, con prezzo modificabile in linea.
- Interruttore "preferito" su ogni prodotto, con avviso se se ne segnano più di 9 (la griglia visibile ne contiene 9).
- Trascinamento per riordinare.
- Quando si cambia un prezzo, un avviso ricorda che vale solo per le consumazioni future (DEC-05). Serve a rassicurare, non a chiedere conferma.
- Un prodotto si "disattiva", non si elimina.

---

## 10. Stati e messaggi

| Situazione | Cosa vede l'utente |
|---|---|
| Nessun conto aperto | "Nessun conto aperto — tocca **+** per iniziare" |
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
