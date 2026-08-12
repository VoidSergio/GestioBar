# Diario di bordo

> **Si aggiunge in fondo. Non si riscrive e non si riordina.**
>
> È l'unico documento del progetto che non può invecchiare, perché ogni voce è datata e
> racconta un fatto: i fatti restano veri anche quando il codice cambia. Tutti gli altri
> documenti descrivono com'è il sistema **adesso**, e quando non lo aggiorni mentono. Questo no.
>
> Serve a una cosa sola: **impedire che lo stesso errore ricapiti**. Un `git revert` cancella il
> fatto ma non la lezione, e la lezione è la parte che valeva.

---

## Cosa ci va e cosa no

**Ci va** una cosa andata storta: un numero sbagliato, una migrazione fallita, un dato perso,
una schermata che ha detto una bugia, un'ora persa dietro a una causa che non era quella.

**Non ci va** una funzione fatta — quella sta nella roadmap — né una decisione presa, che sta in
`01-VISIONE-E-DECISIONI.md`. Se non è andato storto niente, non è una voce di diario.

**Il formato**, quattro righe:

```
## GG mese AAAA — titolo in una riga

**Cosa si è visto.** Il sintomo, come si è presentato.
**Perché.** La causa vera, non la prima plausibile.
**Cosa si è fatto.** La correzione.
**La regola.** Che cosa non va rifatto. Se ha una casa altrove, il rimando.
```

La riga più importante è **Perché**, ed è quella che si è tentati di saltare perché quando
scrivi la voce la causa ti sembra ovvia. Fra tre mesi non lo sarà.

---

## 6 agosto 2026 — il saldo di un cliente era diverso in due schermate

**Cosa si è visto.** L'elenco clienti mostrava 4,20 €, la scheda dello stesso cliente 11,00 €.

**Perché.** `useConfermaConto` chiamava `invalidateQueries` subito dopo aver accodato
l'operazione. La rilettura partiva prima che la scrittura arrivasse al server, tornava il saldo
vecchio, e TanStack lo marcava fresco per cinque minuti. La scheda, che sta su un'altra chiave di
cache, non veniva toccata affatto.

**Cosa si è fatto.** `aggiornaSaldoInCache()` aggiorna a mano entrambe le query con la variazione
giusta, senza rileggere. La lettura vera arriva quando la coda si svuota: `avviaSync` invalida
tutto dopo ogni operazione riuscita.

**La regola.** Mai `invalidateQueries` subito dopo `accoda()`. Il saldo si legge da un posto solo
ma sta in due cache, e chi lo muove le tocca entrambe. In `03-ARCHITETTURA.md` §4.3 e in cima a
`CLAUDE.md`.

---

## 6 agosto 2026 — la migrazione 0010 non era idempotente

**Cosa si è visto.** Rilanciando la migrazione si prendeva un errore 42710 a metà strada, con le
prime policy create e le altre no.

**Perché.** `create policy` non ha una forma `if not exists`.

**Cosa si è fatto.** Ogni `create` preceduto dal suo `drop if exists`.

**La regola.** Una migrazione va scritta perché la si possa rilanciare. Nessuno la esegue una
volta sola: la si esegue, fallisce a metà per un altro motivo, e la si riesegue.

---

## 6 agosto 2026 — l'app dava la colpa alla rete senza sapere che fosse la rete

**Cosa si è visto.** Con la connessione attiva, la schermata Scontrini diceva "serve la
connessione".

**Perché.** Il server rispondeva benissimo: rispondeva che `v_scontrini` non esiste, perché la
migrazione 0011 non era stata eseguita. Ogni lettura mostrava la stessa frase per qualunque
errore, e gli hook facevano `throw new Error(error.message)` buttando via il codice del
database — proprio quello che distingue i casi. Il messaggio mandava a controllare il modem
invece del database.

**Cosa si è fatto.** `ErroreLettura` conserva il codice e `spiegaErroreLettura()` riconosce
quattro cause: rete, struttura mancante (con l'istruzione di eseguire le migrazioni), permesso
negato, e sconosciuta — che riporta il messaggio vero invece di inventarsi una spiegazione.

**La regola.** Un messaggio d'errore che indovina la causa è peggio di uno che ammette di non
saperla: manda a cercare nel posto sbagliato. Vale anche per i messaggi in italiano
comprensibile — comprensibile non vuol dire inventato.

---

## 7 agosto 2026 — modificare una migrazione già applicata ha bloccato il push

**Cosa si è visto.** Aggiunto "Bitter con aggiunta" al listino e provato a eseguire la
migrazione su Supabase: errore. Il prodotto è stato poi aggiunto dall'app, da Altro → Listino,
che ha funzionato.

**Perché.** Il prodotto era stato scritto dentro `0004_listino.sql`, un file **già applicato in
remoto**. Supabase confronta il contenuto delle migrazioni registrate: cambiarne una fa fallire
il push successivo per disallineamento di cronologia. Non era un problema del prodotto né del
listino, era il file sbagliato.

**Cosa si è fatto.** Il commit è stato annullato con `git revert` e `0004_listino.sql` riportato
identico a com'era stato applicato. Il prodotto era però rimasto solo nel database, aggiunto
dall'app: il repository non ricostruiva più il listino vero, contro un criterio di T-02. È stato
riscritto come `0014_bitter_con_aggiunta.sql`, idempotente, sul modello di `0012`.

**La regola.** Una migrazione già applicata non si modifica. Un prodotto aggiunto dall'app va
rispecchiato in un file **nuovo**. In `CLAUDE.md`, sezione "Cosa non fare mai".

**La coda della storia.** Il revert aveva cancellato il fatto insieme al codice: nel repository
non restava traccia dell'errore, e chi fosse arrivato dopo — persona o agente — avrebbe potuto
rifarlo identico. È il motivo per cui questo diario esiste, ed è la sua prima voce scritta il
giorno stesso.

---

## 8 agosto 2026 — `00-INDICE.md` era indietro di tre settimane

**Cosa si è visto.** L'indice diceva *"App vera (conti, clienti, crediti): da costruire, T-07 in
poi"* mentre erano fatti tutti i task fino a T-17, app pubblicata e 216 test verdi. `CLAUDE.md`
dava T-16 e T-17 per fatti, la roadmap li dava "quasi".

**Perché.** Lo stato del progetto è scritto in tre posti — indice, roadmap, `CLAUDE.md` — e
aggiornarli non fa parte di nessun task. Chiuso un task si aggiorna quello che si ha davanti agli
occhi, e gli altri due restano indietro.

**Cosa si è fatto.** I tre allineati a mano, ricostruendo lo stato vero dal `git log`.

**La regola.** Nessuna ancora, ed è una scelta: aggiungere un passo di manutenzione a ogni task è
un costo che si paga tutte le volte, per un problema che si paga di rado. Ma se ricapita, la voce
qui sotto sarà la seconda, e a quel punto la regola si scrive.

---

## 8 agosto 2026 — l'app si ferma per qualche secondo — **APERTA**

> Voce aperta: il sintomo è confermato, la causa no. Si chiude quando è misurata, non quando
> sembra spiegata. Scritta adesso perché un'ipotesi non annotata si riscopre da capo.

**Cosa si è visto.** Usando l'app sui telefoni, ogni tanto sembra bloccarsi: qualche secondo di
nulla, poi riparte. Per il resto funziona.

**Ipotesi, da verificare.** `proxy.ts` gira prima di ogni richiesta e chiama
`supabase.auth.getUser()`, che **non legge il cookie: interroga il server di Supabase**, in
Irlanda. Il commento nel codice dice che fidarsi del cookie non basta, e per un controllo di
sicurezza sarebbe vero — ma quella chiamata sta su una rotta il cui unico scopo è **decidere se
mandare al login**, e il login è un fatto di interfaccia: i dati sono protetti da RLS sul
database, non da questo redirect. Nel frattempo il service worker (`public/sw.js`) tratta le
navigazioni con la rete per prima, quindi ogni cambio di schermata fa il giro completo
telefono → Netlify → Irlanda → indietro, prima che compaia qualsiasi cosa. Sul wifi del bar sono
i secondi che si vedono.

**La prova che distingue.** È una domanda sola: **il blocco capita quando cambi schermata, o
anche restando dentro la stessa a battere prodotti?**

- Solo cambiando schermata → è `proxy.ts`, e la correzione è togliere il giro di rete dalla
  strada critica.
- Anche battendo prodotti dentro il conto → è altrove, e il primo sospetto diventa
  `salvaCache()` in `lib/offline/cache-query.ts`, che serializza tutta la cache a ogni
  cambiamento con un secondo di attesa.

**Perché è annotata prima di essere risolta.** È il primo attrito trovato prima ancora che T-18
cominciasse, e tocca il criterio che conta più di tutti: se l'app è più lenta del foglio, perde.
Va misurata durante il collaudo con le stanghette, non corretta al volo — la regola di
`08-COLLAUDO.md` §2 vale anche per chi scrive il codice.

**Aggiornamento dell'8 agosto:** confermato dal titolare che il rallentamento capita **solo
cambiando schermata**, mai restando dentro la stessa a battere prodotti. L'ipotesi `proxy.ts`
regge; `salvaCache()` è scagionato. La correzione non è "fidarsi del cookie" ma `getClaims()`,
che verifica la firma del token in locale con WebCrypto invece di interrogare il server: richiede
che il progetto usi chiavi di firma asimmetriche, da verificare in dashboard. Rinviata per
decisione del titolare: prima la sicurezza.

---

## 8 agosto 2026 — i movimenti si potevano modificare, e nessuno se n'era accorto

**Cosa si è visto.** Audit di sicurezza chiesto dal titolare prima di aprire la Fase 2. Le
policy della Fase 1 sono `for all to authenticated using (true)`: `for all` comprende anche
`update`. Su `righe_conto` e `pagamenti` un `update pagamenti set importo_cent = 1` sarebbe
passato.

**Perché.** La cancellazione era stata protetta con cura — `trg_blocca_cancellazione_riga` con la
finestra dei 60 secondi, `trg_blocca_cancellazione_pagamento` senza eccezioni — e la modifica no.
Probabilmente perché di cancellare c'era il bisogno esplicito (la ✕ entro il minuto), mentre di
modificare non c'era bisogno di nessuno: e quando una cosa non serve a nessuno, non si pensa a
vietarla.

**Cosa si è fatto.** `0015_immutabilita_movimenti.sql`: un `before update` su entrambe le tabelle
che solleva un'eccezione. Verificato prima che l'app non ne avesse bisogno — su queste due
tabelle `lib/offline/invio.ts` fa solo `insert` e `delete`. Le altre `update` restano permesse,
perché non sono movimenti: `conti.stato`, `clienti.attivo`, il listino.

**La regola.** Una regola sui soldi che vale solo finché il codice è corretto non è una regola, è
una consuetudine. DEC-03 stava scritto in tre documenti ed era applicato da nessuna parte per
metà dei casi. Quando si scrive una decisione sul denaro, la domanda da farsi è: *chi la
impedisce?* Se la risposta è "l'app", non è impedita.

**Da rifare alla Fase 2.** Le stesse due domande su `movimenti_cassa` e sulle chiusure di turno:
si cancellano? si modificano? Una chiusura di turno è la dichiarazione di una persona su quanto
c'era nel cassetto — se si riscrive dopo, non dichiara più niente.

---

## 8 agosto 2026 — il divieto di modifica era troppo largo, e ha bloccato una correzione vera

**Cosa si è visto.** Il titolare ha segnato come scontrinato un conto che non lo era, e i conti
degli scontrini non tornavano più. Correggerlo era impossibile: il trigger scritto la mattina
stessa (voce qui sopra) vietava **ogni** `update` su `pagamenti`.

**Perché.** La regola di 0015 era giusta e il confine no. DEC-03 parla di **movimenti**: quanto,
a chi, quando, con che metodo. `scontrino_battuto` non è il movimento — è un'annotazione su un
gesto fiscale fatto o non fatto, e le annotazioni si sbagliano. Il divieto è stato scritto
guardando la colonna `importo_cent`, che è quella che fa paura, e applicato a tutta la riga.

Con il divieto totale l'unico rimedio sarebbe stato stornare il pagamento e rifarlo: **due
movimenti finti nell'estratto conto di un cliente per sistemare un booleano**. Cioè sporcare
proprio il documento che DEC-03 esiste per tenere pulito.

**Cosa si è fatto.** `0017_correzione_scontrino.sql`. Il trigger confronta vecchio e nuovo campo
per campo: passa solo `scontrino_battuto`, tutto il resto solleva eccezione. Due colonne nuove
registrano chi ha corretto e quando, così una correzione non è mai silenziosa. Su richiesta del
titolare, la modifica è ristretta al ruolo `titolare` con una policy — e il controllo è ripetuto
nel trigger, perché RLS che vieta non dà errore ma zero righe toccate, e l'app direbbe "fatto"
senza aver fatto niente.

**La regola.** Prima di vietare, chiedersi *che cosa esattamente* si sta proteggendo. "I
movimenti sono immutabili" non vuol dire "le righe di quelle tabelle sono immutabili": una riga
contiene il fatto e le annotazioni sul fatto, e solo il primo è di pietra. Un divieto troppo
largo non si vede subito — si vede il giorno in cui impedisce una cosa giusta, e a quel punto la
tentazione è aggirarlo con qualcosa di peggio.

**Nota di metodo.** Fra lo sbaglio e la correzione sono passate meno di sei ore, e questo è il
caso migliore. Se il divieto fosse arrivato durante la settimana di collaudo, la voce sarebbe
stata "l'app non mi lascia correggere" in una casella *lento* con cinque stanghette.

---

## 8 agosto 2026 — la registrazione era aperta a chiunque, da sempre

**Cosa si è visto.** Nella dashboard Supabase, **Authentication → Sign In / Providers → User
Signups**, la voce *"Allow new users to sign up"* risultava **accesa**. L'app è pubblicata su
Netlify da giorni. Chiunque conoscesse l'indirizzo poteva registrarsi, confermare la propria
mail, entrare, e leggere e scrivere tutto: clienti, conti, debiti, pagamenti.

**Perché.** È il valore predefinito di Supabase, e nessuno lo aveva spento perché nessuno lo
aveva nominato: `06-SETUP-SUPABASE.md` accompagnava passo passo dalla registrazione alle
migrazioni al primo utente, e questa voce non c'era. Un passo che non è scritto in una guida
scritta bene sembra un passo che non esiste.

La causa più profonda però è un'altra, ed è di progetto. Le policy della Fase 1 sono
`for all to authenticated using (true)`, scelta consapevole e motivata nei commenti di
`0003_sicurezza.sql`: lavora una persona sola, stringere le regole adesso vorrebbe dire scriverle
su un'ipotesi. Il ragionamento è giusto **ma poggia su una condizione che non era scritta da
nessuna parte**: che gli account li crei il titolare. Finché quella condizione resta implicita,
nessuno la verifica — e infatti non è stata verificata per giorni.

**Cosa si è fatto.** Registrazione spenta. Aggiunto `06-SETUP-SUPABASE.md` §5.1, con dentro anche
il legame con gli avvisi *"RLS Policy Always True"* del Security Advisor: non sono errori, sono
quella scelta, e sono accettabili **solo** a registrazione chiusa. Controllato l'elenco utenti
per vedere se qualcuno si fosse registrato.

**La regola.** Quando una semplificazione è accettabile *a condizione che*, la condizione va
scritta accanto alla semplificazione, non tenuta a mente. Un commento che dice "per ora va bene
così" deve dire anche **cosa lo rende vero**, altrimenti resta vero solo finché qualcuno se lo
ricorda.

**Il seguito.** Le migrazioni `0003` e `0010` sono già applicate e non si toccano (voce del 7
agosto). La condizione vive quindi nella documentazione, non nel codice — il che è meno solido di
quanto vorrei. A T-40, quando le policy si stringeranno per ruolo, va tolta la dipendenza da
un'impostazione della dashboard.

---

## 12 agosto 2026 — il vincolo dei tre tap era misurato dal punto sbagliato

**Cosa si è visto.** Prima segnalazione dal banco: *«devo poter selezionare i prodotti appena
apro l'app»*. Detta come lamentela sulla lentezza, ma l'app non era lenta a rispondere: era
lenta ad **arrivare**. Aperta, mostrava l'elenco dei conti aperti; per battere un caffè servivano
il **+**, poi il cliente, poi il prodotto.

**Perché.** Il conto dei tap tornava — `04-UX-MOBILE.md` §3 e §5 lo verificavano riga per riga,
tre tap, vincolo rispettato — ma contava la cosa sbagliata. Misurava la strada per registrare
*a un cliente*, e la trattava come se fosse la strada per registrare. Sono due cose diverse, e
quella frequente è la seconda: uno che paga e se ne va non ha bisogno di essere nessuno. Due
tap su tre servivano a rispondere a una domanda — "a chi?" — che nella maggior parte della
giornata non ha risposta e non serve.

L'errore non è nel numero, è nel punto da cui si è cominciato a contare. Un criterio verificabile
può essere verificato benissimo e misurare la cosa sbagliata; nessun controllo automatico se ne
accorge, perché il criterio passa.

Sotto c'era anche un'inversione di ordine presa dal software e non dal mestiere: in un bar
l'ordinazione arriva prima del nome. Sul foglio di carta — che `CLAUDE.md` indica come il vero
concorrente — non si scrive un nome prima di segnare un caffè.

**Cosa si è fatto.** La schermata di apertura è diventata la griglia prodotti su un conto al
banco sempre pronto; l'elenco dei conti aperti è diventato una striscia di etichette in cima. Il
"a chi?" si chiede alla fine, e solo quando il conto resta a debito. Si è potuto fare senza
toccare niente di registrato perché la bozza è locale fino alla conferma (DEC-08): cambiare
intestatario a metà strada non riscrive nessuna riga.

**La regola.** Un criterio che conta i tap deve dire **da dove si comincia a contare e in quale
caso**. "Tre tap per registrare un caffè" non è un criterio finché non si specifica se quel
caffè va a qualcuno. E quando un flusso chiede un dato, la domanda da farsi non è "quanto costa
chiederlo" ma "in quale frazione dei casi serve": un dato che serve nel dieci per cento delle
volte non si chiede all'inizio.

---

## 12 agosto 2026 — la spunta dello scontrino stava dove nessuno la guardava

**Cosa si è visto.** Seconda segnalazione dallo stesso giro: *«il tasto incassa mi deve far
scorrere verso giù per vedere la scritta scontrino battuto»*.

**Perché.** La casella "scontrino battuto" stava in mezzo al pannello di pagamento, sotto il
campo dell'importo. Il campo aveva `autoFocus`, quindi la tastiera di sistema si apriva da sola e
si prendeva metà schermo: la spunta finiva sotto la tastiera, e con lei CONFERMA. Per arrivarci
bisognava scorrere **con la tastiera aperta**, che con una mano sola e le dita bagnate è il
gesto peggiore che ci sia.

La spunta ricordava l'ultima scelta (`04-UX-MOBILE.md` §6), cosa giusta e voluta. Ma ricordata e
invisibile insieme fanno un guaio: la scelta resta quella dell'ultima volta e nessuno la
controlla, perché per controllarla bisogna andare a cercarla. Una preferenza ricordata deve
essere **più** visibile di una da scegliere ogni volta, non meno.

Errore di disegno a monte, e vale la pena scriverlo: si era ottimizzato il numero di tocchi
(zero, la spunta è ricordata) ignorando il costo di **vedere**. Un comando che non costa tocchi
ma costa uno scorrimento per essere letto non è gratis.

**Cosa si è fatto.** La scelta è diventata due tasti Sì/No da 56 px, prima cosa in cima al
pannello, quello scelto pieno di colore e con un ✓ — in penombra due tinte si confondono, un
segno di spunta no. La memoria dell'ultima scelta resta, ma adesso si vede.

La tastiera di sistema è sparita del tutto: al suo posto un tastierino di dodici tasti dentro il
pannello (`components/comune/tastierino.tsx`). Il pannello è in tre fasce — scontrino e importo
fermi in alto, tastierino e CONFERMA fermi in basso, informazioni in mezzo: l'unica parte che
può scorrere. La regola di disegno è una sola: **non si scorre per confermare.**

**La regola.** Prima di dare `autoFocus` a un campo dentro un pannello, guardare cosa copre la
tastiera quando si apre. Se copre l'azione principale, il pannello è sbagliato — non l'autofocus.
E una preferenza ricordata va messa dove si legge senza cercarla, altrimenti smette di essere una
preferenza e diventa un valore predefinito che nessuno rivede.

---

## 12 agosto 2026 — un conto segnato a credito a nessuno

**Cosa si è visto.** Dal banco: *«è capitato di assegnare a credito a una persona ma non lo ha
assegnato»*. Senza altri dettagli, perché non c'era niente da vedere: il conto risultava chiuso,
la merce era uscita, e il saldo di quella persona non era salito di un centesimo. Nessun errore,
nessun avviso. Soldi spariti in silenzio.

**Perché.** Due cause, sovrapposte.

La prima è una copia vecchia. Premendo **A CREDITO** su un conto senza intestatario si apriva
"a chi?", si assegnava il cliente e si chiudeva subito dopo. Ma `assegnaCliente` restituisce un
oggetto nuovo — le bozze sono immutabili — mentre `chiudi()` continuava a leggere la variabile
`bozza` della chiusura di render, cioè **la bozza di prima dell'assegnazione**. Quella senza
cliente. `useConfermaConto` riceveva `clienteId: null`, registrava un conto intestato a nessuno
e saltava del tutto l'aggiornamento del saldo, perché è dentro un `if (bozza.clienteId)`.

La seconda è che niente si opponeva. Un conto a credito senza intestatario è una contraddizione
— non è un debito, sono soldi che escono e non compaiono da nessuna parte — e non c'era **nessun
posto** in cui quella contraddizione fosse scritta. Il database la accetta (`cliente_id` è
opzionale, e deve esserlo: i conti al banco esistono). L'interfaccia la impediva solo *per come
era disposta*, e una regola che vive nella disposizione dei pulsanti dura finché nessuno tocca
i pulsanti. Nella stessa versione il pannello "a chi?" mostrava anche la voce **Banco** quando la
domanda era "a chi lo segno?": sceglierla registrava esattamente lo stesso conto a nessuno, per
una strada diversa.

C'era anche un terzo effetto, riportato come *«qualche bug quando faccio un'assegnazione»*: dando
un nome al conto in corso, quello spariva dallo schermo. La schermata di apertura ricavava il
conto da mostrare con "la bozza senza cliente", ricalcolandolo a ogni render. Nell'istante
dell'assegnazione quella bozza smetteva di essere senza cliente, non veniva più trovata, e la
schermata apriva un conto vuoto e ci si spostava sopra — con l'ordinazione appena intestata che
scompariva davanti agli occhi. Il conto non era perso (stava nella striscia in cima), ma dal
banco non si poteva sapere.

**Cosa si è fatto.** `useAssegnaCliente` restituisce la bozza aggiornata e non più solo il suo
id, e `chiudi()` prende la bozza come parametro invece di leggerla dalla chiusura: chi chiude
deve passare quella che ha in mano *adesso*. Il divieto è diventato una funzione con dei test
intorno, `puoAndareACredito` in `lib/dominio/bozza.ts`, usata come rete di sicurezza in
`aCredito`: se per qualunque strada ci si arrivasse senza intestatario, si chiede chi è invece
di far sparire dei soldi. La voce **Banco** non compare quando la domanda è "a chi lo segno?".
E il conto in corso della schermata di apertura è diventato uno stato che si tiene, non una
conseguenza che si ricalcola: resta quello finché esiste, comunque si chiami.

**La regola.** Con dati immutabili, **il risultato di una modifica va passato, non ripescato**.
Dopo un `await` che ha cambiato qualcosa, ogni variabile della chiusura di render è di prima:
sembra aggiornata perché ha il nome giusto, e non lo è.

E la seconda, che vale più della prima: **una regola sui soldi non può vivere nella disposizione
dell'interfaccia.** Se "un conto a credito ha sempre un intestatario" è vero, deve stare in una
funzione pura con dei test, dove nessun riordino di pulsanti la può aggirare. Finché stava solo
nel fatto che il tasto apriva un pannello, bastava una strada nuova — e la strada nuova l'aveva
aggiunta lo stesso commit.

---
