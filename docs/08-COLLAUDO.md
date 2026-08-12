# Collaudo sul campo — protocollo di T-18

> Questo documento non si legge dietro il banco. Si legge **una volta**, la sera prima di
> cominciare, e poi resta chiuso. Dietro il banco c'è solo la scheda di carta.
>
> Riferimento: `05-ROADMAP.md` T-18. Il criterio di uscita della Fase 1 non è "il codice è
> finito", è **"il foglio di carta non serve più"** — e quello si decide a T-19, non qui.

---

## 1. Cosa stai davvero provando

Non stai provando se l'app funziona. Quello lo dicono i 216 test. Stai provando tre cose che
nessun test può dire:

1. **Se i numeri dell'app sono gli stessi del foglio.** Una divergenza scoperta adesso è un bug.
   Scoperta fra tre mesi è una discussione con un cliente.
2. **Se l'app è più veloce del foglio quando c'è fila.** Il foglio è il concorrente. Se perdi,
   perde l'app, non il cliente.
3. **Che cosa ti dà fastidio.** Questo è l'unico dato che esiste solo in questa settimana. Fra
   un mese ti ci sarai abituato e non lo noterai più — e le cose a cui ci si abitua sono
   esattamente quelle che tengono lontani gli altri.

Il terzo punto è il più prezioso ed è quello che si dimentica per primo. Da cui la scheda.

---

## 2. Le tre regole della settimana

**Il foglio si tiene in parallelo tutti i sette giorni.** Anche il giorno in cui l'app va
benissimo. Anche il giorno in cui sei di corsa. Un foglio tenuto per cinque giorni su sette non
serve a niente: la divergenza si nasconde proprio nei due giorni saltati.

**Non si corregge niente durante la settimana.** La tentazione di sistemare un fastidio piccolo
la sera stessa è forte e va resistita, per due motivi. Il primo: un attrito visto una volta sola
può essere stanchezza, non un difetto — la frequenza si misura solo lasciandolo lì. Il secondo:
se cambi il codice a metà settimana, i primi tre giorni e gli ultimi quattro non sono più la
stessa prova. Le correzioni sono T-19, ed è un task apposta.

L'eccezione unica: **un numero sbagliato si corregge subito**, perché sono soldi di qualcuno. Ma
lo si annota prima di correggerlo.

**Se durante il servizio l'app ti rallenta, molla l'app e usa il foglio.** Poi annota. Non stai
facendo un esame all'app davanti a un cliente che aspetta: il cliente viene prima. Un attrito
annotato è un dato; un cliente spazientito è un cliente spazientito.

---

## 3. I sei criteri, e come si misurano

I criteri sono in `05-ROADMAP.md` T-18. Qui c'è come si verificano davvero.

### 3.1 Un caffè cronometrato: 1 tap se paga, 3 se resta a debito

Sono **due** percorsi, e vanno misurati separati perché il primo è la giornata e il secondo è
l'eccezione (`04-UX-MOBILE.md` §3):

- **paga subito:** apri l'app → **Caffè** (1) → INCASSA → CONFERMA;
- **a credito:** apri l'app → **Caffè** (1) → **A CREDITO** (2) → il cliente (3).

> **Nota del 12 agosto.** La versione precedente di questo criterio diceva "3 tap dalla home" e
> contava home → **+** → cliente → Caffè. Il numero tornava, ma misurava la strada per registrare
> *a un cliente* trattandola come la strada per registrare: due tap su tre servivano a rispondere
> a "a chi?", domanda che nella maggior parte della giornata non ha risposta. Il motivo per cui
> il criterio è cambiato sta in `09-DIARIO.md`, ed è la cosa più utile di questa pagina: un
> criterio può passare benissimo e misurare la cosa sbagliata.

**Come misurarlo.** Non a mente e non una volta sola. Prendi il cronometro del telefono — o
meglio, fatti cronometrare da qualcuno — e fallo **cinque volte in momenti diversi della
settimana**, almeno una con la fila e le mani bagnate. Parti dal telefono in tasca, non
dall'app già aperta: la prova comprende tirarlo fuori e sbloccarlo, perché nella realtà è
compreso.

**Cosa annotare:** i tap effettivi, non quelli previsti. Se il cliente non era fra i frequenti e
hai dovuto cercarlo, sono quattro o cinque tap: quello è il numero da scrivere. Il criterio
riguarda il caso comune, ma il caso comune vero lo definisce la settimana, non il documento.

**Passa se:** un tap per il caffè pagato, tre per quello a credito, e il tempo totale è al di
sotto di quello che ci metti a scriverlo sul foglio. Cronometra anche il foglio, almeno una
volta. È il confronto che conta.

### 3.2 L'app si apre in meno di 1,5 s con la cache calda

**Cache calda** vuol dire: app già aperta almeno una volta oggi, aperta dall'icona sulla
schermata home, non dal browser.

**Come misurarlo.** Cronometro dal tap sull'icona a quando i conti aperti sono **leggibili** —
non a quando compare lo scheletro grigio. Cinque prove, si tiene la peggiore.

Fai anche la prova cattiva: **primo avvio del mattino**, telefono appena acceso, wifi che si sta
ancora agganciando. Non è nel criterio, ma è il momento in cui l'app viene aperta davvero, ed è
il momento peggiore. Annota il numero anche se è brutto.

### 3.3 Una giornata intera in modalità aereo si sincronizza senza duplicati e senza perdite

Questa è la prova più importante della settimana ed è anche quella che si rimanda. **Fissala
adesso, su un giorno preciso** — un giorno di lavoro vero, non la domenica pomeriggio.

**Come si fa.** Modalità aereo dal primo caffè fino a chiusura. Si lavora normalmente. Il foglio
si tiene come sempre. A fine giornata, prima di riattaccare la rete:

1. Guarda l'indicatore in alto: deve dire quante operazioni sono in coda. **Scrivi quel numero.**
2. Conta le righe sul foglio della giornata. **Scrivi quel numero.**
3. Riattiva la rete e guarda la coda svuotarsi. Se qualcosa va in rosso, **non toccare niente**:
   fotografa la schermata con l'elenco di ciò che non è arrivato. Quella foto vale più di
   qualunque descrizione a parole.
4. A coda vuota, confronta i saldi dell'app con il foglio, cliente per cliente.

**Passa se:** i saldi coincidono, e nessun cliente ha una consumazione contata due volte.

**Attenzione a una cosa.** La coda parte quando il browser si accorge che la rete è tornata. Se
riattivi la rete con l'app chiusa, la coda non parte: va riaperta. Non è un difetto da annotare,
è come funziona un service worker — ma se ti aspettavi il contrario, annotalo come attrito,
perché vuol dire che l'app non te lo sta dicendo abbastanza chiaramente.

### 3.4 Due dispositivi sullo stesso conto non producono incoerenze

Serve un secondo telefono, anche uno vecchio.

**La prova minima**, da fare una volta in un momento calmo:

| # | Telefono A | Telefono B | Cosa deve succedere |
|---|---|---|---|
| 1 | Apre il conto di Mario | — | — |
| 2 | Batte un caffè | Apre lo stesso conto | B vede il caffè |
| 3 | Batte una brioche | Batte un'acqua | Entrambi i prodotti finiscono sul conto |
| 4 | — | Chiude il conto a credito | A si accorge che il conto è chiuso |
| 5 | Prova a battere ancora | — | **Qui si guarda cosa fa.** Annota qualunque cosa faccia |

Il passo 5 è quello interessante e non ha un esito previsto: serve a scoprire cosa succede, non
a confermare cosa dovrebbe succedere.

**La prova cattiva**, se hai voglia: stessa sequenza con il telefono B in modalità aereo, che
torna online dopo che A ha chiuso il conto.

### 3.5 I saldi dell'app coincidono con il foglio

**Ogni sera**, non a fine settimana. Sette confronti da due minuti battono un confronto da
un'ora, perché quando la divergenza salta fuori ti ricordi ancora la giornata che l'ha prodotta.

Il confronto sta in fondo alla scheda di carta. Se un saldo non torna, **prima annota la
differenza in euro**, poi cerca il perché. La cifra esatta è il dato; la spiegazione può
arrivare dopo.

### 3.6 La lista degli attriti, con priorità

È il prodotto finito di questa settimana ed è l'input di T-19. Vedi §4.

---

## 4. Come si annota un attrito

Un attrito è **qualunque momento in cui hai pensato "uffa"**. Non solo i difetti: anche le cose
che funzionano ma sono scomode, anche le cose che ti hanno solo fatto esitare.

Sulla scheda ci sono tre colonne, e servono tutte e tre.

**Cosa è successo.** Una riga sola, con le parole tue. "Ho battuto due caffè invece di uno" è
perfetto. "Problema di UX nella griglia" non serve a niente fra una settimana.

**Quanto pesa.** Una crocetta in una delle tre colonne. Serve a T-19 per decidere cosa si tocca:

| Colonna | Quando | Esempio |
|---|---|---|
| **Sbagliato** | Un numero sbagliato, un dato perso, o l'ho dovuto fare sul foglio | Il saldo di Mario era di 3 € più basso del vero |
| **Lento** | L'ho fatto con l'app, ma più lentamente del foglio, o ho ripetuto un gesto | Ho aperto il pannello varianti per sbaglio, terza volta oggi |
| **Fastidio** | Dà noia, ma non mi ha rallentato | Il verde del pagamento è troppo acceso al buio |

**La stanghetta.** Ogni volta che lo stesso attrito ricapita, una stanghetta accanto a quello
già scritto — non una riga nuova. Alla fine della settimana la colonna delle stanghette è
l'ordine di lavoro di T-19: `05-ROADMAP.md` dice **"in ordine di frequenza"**, ed è quella la
frequenza.

Un **lento** con nove stanghette vale più di uno **sbagliato** capitato una volta sola. Lo
sbagliato lo sistemi lo stesso, perché sono soldi di qualcuno — ma è il lento ripetuto che ti fa
tornare al foglio.

---

## 5. I criteri arretrati da spuntare per strada

Diverse caselle di task già chiusi sono rimaste vuote perché **non si verificano a tavolino**:
serviva il telefono vero e il banco vero. Questa settimana è il momento. Non richiedono prove
apposta, solo di guardare la cosa giusta la prima volta che capita.

| Da dove | Cosa guardare | Quando capita |
|---|---|---|
| T-10 | Con il filtro "Tutti", i primi 9 riquadri si vedono senza scorrere | La prima volta che apri la griglia |
| T-10 | Il **▾** delle varianti è 44 px, non 56. **Ti si apre per sbaglio?** | Ogni volta che batti un cappuccino |
| T-11 | Un cliente che ha già un conto aperto ti porta dentro quel conto, non ne crea un altro | Prima o poi succede da solo |
| T-11 | Il conto si apre anche senza rete | Nella giornata in aereo |
| T-12 | Due tap sullo stesso prodotto danno `×2` su una riga sola | Il primo cliente che prende due caffè |
| T-12 | La **✕** sparisce dopo un minuto, e dopo c'è "Storna" | La prima volta che sbagli a battere |
| T-13 | Il pannello pagamento funziona senza rete | Nella giornata in aereo |
| T-14 | Lo storico avvisa che serve la rete, invece di restare vuoto | Nella giornata in aereo |
| T-17 | Su Android compare la richiesta di installazione | Al primo avvio sul telefono nuovo |
| T-17 | Su iPhone "Aggiungi a schermata Home" dà un'app senza barra del browser | Idem |

Il **▾ a 44 px** è dichiarato in `05-ROADMAP.md` T-10 come *"da riesaminare nel collaudo T-18"*.
È l'unica violazione consapevole di `04-UX-MOBILE.md` §1 e questa settimana è il suo processo:
se il pannello varianti ti si apre per sbaglio più di due o tre volte, il disegno va cambiato.
Annotalo in **lento** con le stanghette, che è esattamente il dato che serve per decidere.

Restano fuori due cose che **non si fanno dietro il banco**: Lighthouse (T-17) va lanciato sul
sito pubblicato, da fermo, e il riordino del listino (T-16) non esiste ancora.

---

## 6. La sera, cinque minuti

In ordine, tutte le sere:

1. **Riconcilia** i saldi col foglio (§3.5). Prima di tutto il resto, finché la giornata è fresca.
2. **Rileggi le tue stanghette** e aggiungi quello che ti eri dimenticato di scrivere. Succede
   sempre: nella fila non si annota.
3. **Guarda l'indicatore** in alto a destra. Se è rosso, c'è roba non arrivata: risolvila stasera,
   non domani, e annota che cos'era.
4. **Non aprire l'editor.** Regola §2.

---

## 7. Come finisce

Alla fine della settimana hai in mano: sette schede compilate, cinque cronometraggi, una giornata
in aereo riconciliata, e una lista di attriti con le stanghette.

Da lì si apre T-19, si mettono gli attriti in ordine di stanghette, e si lavora dall'alto. Il
foglio **continua a girare anche durante T-19** e si abbandona solo quando il collaudo si ripete
per tre giorni senza attriti gravi nuovi.

Se questa settimana finisce con l'app abbandonata e il foglio ripreso in mano, **non è un
fallimento del collaudo: è il suo risultato**, ed è arrivato al costo di una settimana invece che
di sei mesi. La lista degli attriti dice cosa serve perché non ricapiti.

---

**Documento precedente:** `07-LISTINO.md` · **Task:** `05-ROADMAP.md` T-18
