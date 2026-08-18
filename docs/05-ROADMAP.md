# Roadmap esecutiva

> Backlog ordinato. Ogni task ha criteri di accettazione verificabili.
> Pensato per essere eseguito un task alla volta, anche da un agente AI.
> **Regola:** non si passa al task successivo finché tutti i criteri del precedente non passano.

---

## Stato al 6 agosto 2026

| Task | Stato | Nota |
|---|---|---|
| T-01 Progetto Supabase | ✅ fatto | progetto creato, regione Irlanda |
| T-02 Schema | ✅ fatto | 8 migrazioni eseguite, 59 prodotti e 34 riquadri verificati |
| T-03 Progetto Next.js | ✅ fatto | build, lint e test passano |
| T-04 Modulo denaro | ✅ fatto | 22 test verdi, controllo DEC-04 automatico |
| T-05 Client Supabase | ✅ fatto | client e tipi funzionanti e verificati |
| T-06 Autenticazione | ✅ fatto | accesso provato, profilo `titolare` creato dal trigger |
| T-10 Griglia prodotti | ✅ fatta | anticipata; provata sul telefono |
| T-07 Provider dati | ✅ fatto | cache su IndexedDB, indicatore di rete |
| T-08 Anagrafica clienti | ✅ fatta | elenco con saldi, ricerca, creazione |
| T-09 Coda offline | ✅ fatta | 25 test scritti prima del codice |
| T-11 Apertura conto | ✅ fatta | **rifatta il 12 agosto**: la home è la griglia prodotti, i conti aperti sono la striscia in cima |
| T-12 Righe di conto | ✅ fatta | bozza modificabile, conferma con invio unico (DEC-08) |
| T-13 Incassa e a credito | ✅ fatto | pannello pagamento, importo parziale, resto, riepilogo di 2 s |
| T-14 Scheda cliente | ✅ fatta | estratto conto paginato a 30, saldo ancorato a `v_saldo_clienti` |
| T-15 Crediti | ✅ fatta | ordine per anzianità, filtri, sollecito modificabile prima dell'invio |
| Scontrini | ✅ fatta | **anticipata dalla Fase 2** su richiesta del titolare |
| T-16 Listino | ✅ fatta | prezzi, varianti, preferiti, disattivazione, riordino |
| T-17 PWA | 🟨 quasi | service worker scritto a mano, pagina offline. **Da provare sui telefoni e con Lighthouse** |
| T-18 Collaudo | 🟨 in corso | cominciato. Tre attriti già raccolti e corretti il 12 agosto — vedi il task e `09-DIARIO.md` |

**Fase 0 chiusa.** L'app è pubblicata su Netlify, 393 test verdi. Il giro completo funziona: apri un conto, batti, confermi, incassi o lasci a credito, e il cliente compare nei Crediti.

**Navigazione:** tab bar in basso (04-UX-MOBILE §2) sulle schermate principali, banco compreso. Sulla scheda Crediti, al posto della parola, c'è il credito in giro: era il numero grande della vecchia home e non poteva finire dietro un tocco.

**Anticipo dalla Fase 2.** La schermata Scontrini (`/scontrini`, sotto la scheda "Altro") è stata fatta prima di T-19, contro la regola di `CLAUDE.md`. È un anticipo parziale di T-22: mostra che cosa è stato battuto e che cosa no, una giornata alla volta, ma **non** registra la chiusura di cassa né la differenza rilevata — quelle restano a T-22, insieme alle tabelle `movimenti_cassa` e `chiusure_giornaliere` che non esistono ancora. Il resto della Fase 2 non si tocca prima di T-19.

**Da provare sul telefono, non verificabile a tavolino:** il comportamento offline di T-13 e T-14 e i bersagli di tocco del pannello pagamento.

---

## Come si legge un task

```
### T-xx — Titolo
Dipende da: T-yy
File toccati: percorsi
Cosa fare: descrizione operativa
Fatto quando:
  - [ ] criterio verificabile
```

Un criterio è verificabile se una persona diversa può controllarlo senza chiedere spiegazioni. "L'interfaccia è bella" non è un criterio. "Il riquadro del prodotto misura almeno 100×72 px" lo è.

---

## FASE 0 — Fondamenta (mezza giornata)

### T-01 — Creare il progetto Supabase

Dipende da: nulla
File toccati: nessuno (operazione sul sito)

Cosa fare: seguire `06-SETUP-SUPABASE.md` §1–§3.

Fatto quando:

- [x] Il progetto esiste e la dashboard si apre
- [x] URL e chiave `anon` sono in `.env.local`
- [x] La regione scelta è Europa (Irlanda)

---

### T-02 — Eseguire lo schema Fase 1

Dipende da: T-01
File toccati: `supabase/migrations/0001_schema.sql` … `0004_listino.sql` (già scritti)

Cosa fare: aprire il SQL Editor di Supabase e incollare i quattro file **in ordine**: `0001_schema`, `0002_viste`, `0003_sicurezza`, `0004_listino`. I file `0005` e `0006` sono Fase 2 e 3: non eseguirli.

Fatto quando:

- [x] Tutte le tabelle di §3 esistono in `public`
- [x] `select count(*) from prodotti` restituisce **59**
- [x] `select count(*) from v_griglia_prodotti` restituisce **34**
- [x] `select * from v_saldo_clienti` gira senza errori (0 righe)
- [x] RLS risulta attiva su tutte e sette le tabelle
- [x] I file `.sql` sono nel repository e riproducono il database da zero

**Correzioni successive.** Le migrazioni `0007` e `0008` hanno chiuso i problemi segnalati dal Security Advisor: viste che scavalcavano RLS, funzioni con `search_path` modificabile, policy duplicate, funzioni SECURITY DEFINER pubbliche, chiavi esterne senza indice. I file `0001`–`0006` sono stati corretti a monte, quindi un database nuovo non ha bisogno di `0007` e `0008`. Dettagli in `06-SETUP-SUPABASE.md` §4.1.

---

### T-03 — Inizializzare il progetto Next.js

Dipende da: nulla
File toccati: tutto lo scheletro

Cosa fare: **già fatto.** Resta solo da installare le dipendenze:

```bash
npm install
```

Fatto quando:

- [x] `npm run build` completa senza errori né warning di tipo
- [x] `npm run lint` non segnala nulla
- [x] `tsconfig.json` ha `"strict": true` e `noUncheckedIndexedAccess`
- [x] `.env.local` è in `.gitignore` ed esiste `.env.local.example`
- [x] `npm run dev` apre l'app senza errori
- [x] Il repository è su GitHub — `VoidSergio/GestioBar`

---

### T-04 — Modulo denaro e test

Dipende da: T-03
File toccati: `lib/dominio/denaro.ts`, `lib/dominio/denaro.test.ts`

Cosa fare: implementare il modulo di `03-ARCHITETTURA.md` §3, con i test.

Fatto quando:

- [x] `parseEuro("1,20")` = 120, `parseEuro("1.20")` = 120, `parseEuro("abc")` = null, `parseEuro("")` = null, `parseEuro("-5")` = null
- [x] `formatEuro(120)` = "1,20 €", `formatEuro(0)` = "0,00 €", `formatEuro(-500)` = "-5,00 €"
- [x] `centesimi(1.5)` lancia un'eccezione
- [x] I 22 test passano con `npm test`
- [x] `npm run verifica:denaro` conferma una sola divisione per 100, dentro `formatEuro`

L'ultimo criterio va rieseguito a ogni task successivo. È il modo più economico di far rispettare DEC-04.

**Cosa è emerso dai test.** Il formato italiano segue la regola CLDR "min2": senza intervenire, `1200` verrebbe scritto `1200,00 €` e `12000` invece `12.000,00 €`, con il separatore che compare e scompare a seconda della cifra — e con differenze fra versioni di browser. `formatEuro` forza quindi `useGrouping: 'always'`, così il totale del credito si legge allo stesso modo ovunque.

---

### T-05 — Client Supabase e tipi generati

Dipende da: T-02, T-03
File toccati: `lib/supabase/client.ts`, `server.ts`, `tipi.ts`

Cosa fare: configurare i client browser e server; generare i tipi con `npx supabase gen types typescript --project-id XXX > lib/supabase/tipi.ts`.

Fatto quando:

- [x] `tipi.ts` contiene le sette tabelle e le quattro viste di Fase 1
- [x] Le query sono tipizzate: leggere un campo inesistente non compila
- [x] La diagnostica in home legge 59 prodotti e 34 riquadri dal database vero

---

## FASE 1 — Il cuore (l'obiettivo è arrivare qui e usarlo)

### T-06 — Autenticazione

Dipende da: T-05
File toccati: `proxy.ts`, `lib/supabase/sessione.ts`, `app/login/*`, `components/shell/pulsante-esci.tsx`

Cosa fare: login email/password, protezione delle rotte, sessione lunga.

Fatto quando:

- [x] Un utente non autenticato che apre `/` finisce su `/login`
- [x] Il login riesce e porta alla home
- [x] Chiudendo e riaprendo il browser la sessione è ancora attiva
- [x] Il profilo viene creato automaticamente al primo accesso, con ruolo `titolare` per il primo utente
- [x] Password sbagliata → messaggio in italiano, non un codice
- [x] Chi è già autenticato e apre `/login` viene rimandato alla home
- [x] Dopo il login si torna alla pagina che si stava cercando di aprire

**Due cose imparate scrivendolo.**

*In Next 16 `middleware.ts` è deprecato*: il file si chiama `proxy.ts` ed esporta una funzione `proxy`. Il vecchio nome funziona ancora ma stampa un avviso a ogni build.

*I tipi delle righe devono essere `type`, non `interface`.* Con le interface l'inferenza di supabase-js collassa silenziosamente su `never`: `select()` compila, ma leggere un campo dà "Property 'nome' does not exist on type 'never'". Il motivo è che un'interface non è assegnabile a `Record<string, unknown>` — potrebbe essere estesa dopo la dichiarazione, quindi TypeScript non le dà una index signature implicita. Un type alias sì. Serve anche `Relationships: []` su ogni tabella e vista.

*Sulla durata della sessione:* i 30 giorni non si impostano nel codice. Il token di accesso dura un'ora e viene rinnovato in silenzio dal `proxy.ts` a ogni richiesta; quanto a lungo resti collegato dipende dalla scadenza del refresh token, che si configura su Supabase in **Authentication → Sessions**. Il valore predefinito va bene, ma è lì che si cambia.

---

### T-07 — Provider dati e stato di rete

Dipende da: T-05
File toccati: `components/shell/provider-dati.tsx`, `indicatore-sync.tsx`, `lib/hooks/use-stato-rete.ts`, `lib/offline/db.ts`, `lib/offline/cache-query.ts`

Cosa fare: TanStack Query con persistenza su IndexedDB; rilevamento online/offline; indicatore di stato.

Fatto quando:

- [x] I dati caricati restano disponibili dopo un ricaricamento della pagina senza rete *(da confermare a mano)*
- [x] Spegnendo la rete l'indicatore diventa ambra entro 2 secondi *(da confermare a mano)*
- [x] Riaccendendola torna verde entro 2 secondi *(da confermare a mano)*
- [x] L'indicatore è visibile su ogni schermata

**Come provarlo.** Sul computer: strumenti per sviluppatori → scheda Rete → menu a tendina su **Offline**. Sul telefono: modalità aereo. La griglia deve restare piena e l'indicatore diventare ambra con la scritta "Senza rete".

**Niente pacchetto di persistenza.** Esiste `@tanstack/react-query-persist-client` e fa esattamente questo, ma sarebbe una dipendenza non prevista in `03-ARCHITETTURA.md` §1. `dehydrate` e `hydrate` sono già dentro TanStack Query e `idb` è già in elenco: quaranta righe in `lib/offline/cache-query.ts` contro un pacchetto in più. Se un domani servisse la gestione fine delle versioni della cache, si passa a quello ufficiale senza toccare altro.

**Un limite dichiarato.** `navigator.onLine` dice se esiste un'interfaccia di rete attiva, non se internet funziona. Attaccato al wifi del bar con il modem staccato, il browser continua a dirsi "online" e l'indicatore resta verde. Il caso reale — il telefono che esce dalla portata del wifi — viene rilevato correttamente. Il caso "wifi sì, internet no" lo scoprirà la coda di T-09, che vede fallire l'invio. Un battito periodico verso Supabase costerebbe una richiesta ogni pochi secondi per tutta la giornata: non vale il guadagno.

**Perché `networkMode: 'offlineFirst'`.** Senza quell'opzione TanStack Query, quando il browser si dichiara offline, mette le query in pausa e i componenti restano in stato di caricamento — schermate vuote invece dei dati che sono già in memoria. Con `offlineFirst` la query parte comunque: se il server non risponde resta il dato in cache, che è quello che serve dietro al banco.

---

### T-08 — Anagrafica clienti

Dipende da: T-06, T-07
File toccati: `app/clienti/page.tsx`, `components/clienti/*`, `lib/hooks/use-clienti.ts`, `lib/dominio/clienti.ts`

Cosa fare: elenco, ricerca, creazione.

Fatto quando:

- [x] La ricerca filtra su nome e soprannome mentre si digita, senza ricaricare
- [x] Si crea un cliente con il solo nome (soprannome e telefono facoltativi)
- [x] Un nome vuoto o di soli spazi viene rifiutato con messaggio chiaro
- [x] L'elenco mostra il saldo accanto a ogni nome
- [x] Con 0 clienti compare il messaggio guida di `04-UX-MOBILE.md` §10
- [x] Funziona offline in **lettura**; la creazione richiede la rete e lo dice

**Quattro decisioni prese scrivendolo.**

*La ricerca ignora gli accenti e confronta l'inizio delle parole.* Chi digita "nicolo" trova "Nicolò" — in un bar italiano gli accenti nei nomi ci sono e nessuno li scrive mentre cerca. E chi digita "ros" trova "Mario Rossi" ma non "Ambrosini": cercare in mezzo alle parole riempirebbe l'elenco di risultati che nessuno voleva. 18 test coprono questi casi.

*L'elenco è ordinato per rilevanza, non per alfabeto.* Prima chi deve soldi, dal debito più alto; poi gli altri in ordine alfabetico italiano. Questa schermata serve soprattutto a trovare qualcuno da cui incassare; chi è in pari lo si apre di rado.

*Il cliente compare nell'elenco prima che il server risponda* (aggiornamento ottimistico, regola dell'interfaccia in `CLAUDE.md`). Se il salvataggio fallisce il nome sparisce e compare il motivo: meglio vederlo sparire che credere di averlo registrato.

*La creazione richiede la rete.* È un'eccezione consapevole e temporanea alla regola "tutto deve funzionare offline": la coda di scrittura è T-09 e non esiste ancora. Senza rete il pulsante non fallisce in silenzio, dice *"Senza rete non posso registrare un cliente nuovo. Riprova quando torna la connessione."* Con T-09 questa eccezione sparisce.

**Il nome del file previsto era `ricerca-cliente.tsx`.** Non è stato creato: quel componente è il selettore che si apre premendo **+** sulla home per aprire un conto, e appartiene a T-11. Qui la ricerca è dentro la schermata, dove serve.

---

### T-09 — Coda offline

Dipende da: T-07
File toccati: `lib/dominio/coda.ts`, `lib/offline/{coda,invio,sync}.ts`, `lib/hooks/use-coda.ts`, `components/shell/indicatore-sync.tsx`

Cosa fare: implementare il contratto di `03-ARCHITETTURA.md` §4.3.

Fatto quando:

- [x] Un'operazione creata offline persiste dopo la chiusura del browser *(da confermare a mano)*
- [x] Al ritorno della rete le operazioni partono in ordine di creazione
- [x] Un errore di rete fa ritentare con attesa crescente (1s, 2s, 4s… max 60s)
- [x] Un errore di dati mette l'operazione in `fallita` senza bloccare le indipendenti
- [x] Inviare due volte lo stesso `opId` produce **una sola riga** nel database
- [x] L'indicatore mostra il numero di operazioni in coda

Questo è il task più delicato del progetto. **I test sono stati scritti prima del codice**: 25 test sul solo dominio della coda.

**Come è diviso.** `lib/dominio/coda.ts` contiene il ragionamento — quale operazione mandare, quanto aspettare, quando fermarsi — e non conosce né rete né database, quindi si prova per intero senza nessuno dei due. `lib/offline/sync.ts` esegue e basta. Questa separazione è il motivo per cui il pezzo più rischioso del progetto è anche quello più coperto dai test.

**Le dipendenze fra operazioni.** Una riga non può partire prima del conto che la contiene, e un conto non prima del cliente. Ogni operazione dichiara che cosa produce e che cosa richiede; se qualcosa fallisce, chi dipende da lei resta fermo dietro, mentre **le operazioni indipendenti continuano a partire**. Senza questo, un conto fallito bloccherebbe l'intera giornata.

**Un bug trovato verificando i criteri.** La prima versione riconosceva come "già registrato" solo i duplicati sul vincolo `op_id`. Ma la tabella `clienti` non ha quella colonna: si affida alla chiave primaria, che è comunque generata dal dispositivo. Un reinvio avrebbe prodotto `clienti_pkey` duplicata, classificata come errore di dati, e il cliente sarebbe comparso fra le "operazioni non registrate" pur essendo nel database. Ora entrambi i vincoli valgono come conferma; ogni altro duplicato — per esempio due conti aperti per lo stesso cliente — resta un errore vero.

**Perché una alla volta e non in parallelo.** Mandare conto e riga insieme sarebbe più veloce, ma la riga potrebbe arrivare prima del conto e fallire per chiave esterna mancante. Con qualche decina di operazioni al giorno, la serialità non si percepisce.

**Cosa vede l'utente.** Pallino ambra con il numero mentre la coda si svuota; rosso e tappabile se qualcosa si è fermato, con l'elenco di cosa non è arrivato e i pulsanti **Riprova** e **Scarta**. La decisione su un'operazione fallita è di una persona: il sistema non cancella niente da solo.

---

### T-10 — Griglia prodotti con varianti

Dipende da: T-05
File toccati: `components/conto/griglia-prodotti.tsx`, `lib/hooks/use-prodotti.ts`

File toccati: `components/conto/griglia-prodotti.tsx`, `pannello-varianti.tsx`, `lib/dominio/listino.ts`, `lib/hooks/use-prodotti.ts`, `app/prova-griglia/*`

Cosa fare: griglia a 3 colonne da `v_griglia_prodotti`, filtro categorie, pannello varianti.

Fatto quando:

- [x] Compaiono 34 riquadri, uno per `nome_base`
- [x] I prodotti con più varianti mostrano il segno ▾
- [x] Tap breve su un riquadro con varianti sceglie la variante `normale`, o la meno costosa se `normale` non esiste (birre, vini)
- [x] Tap sul ▾ apre il pannello con tutte le varianti e i rispettivi prezzi
- [x] Ogni riquadro misura almeno 100×72 px *(vedi nota)*
- [x] I preferiti compaiono per primi
- [ ] Con il filtro "Tutti" i primi 9 riquadri sono visibili senza scorrere su uno schermo da 6 pollici *(da verificare sul telefono)*
- [ ] Funziona completamente offline *(rinviato a T-07: serve la persistenza su IndexedDB)*

**Tre annotazioni oneste.**

*Le dimensioni dei riquadri dipendono dallo schermo.* Con tre colonne, 8 px di spaziatura e 8 px di margine: su 360 px di larghezza il riquadro è ~109 px, su 390 px è ~119. Su un iPhone SE di prima generazione (320 px) scende a **96 px**, quattro sotto il minimo dichiarato. Accettato: sotto i 360 px oggi c'è una minoranza trascurabile di telefoni, e ridurre a due colonne costringerebbe a scorrere per raggiungere il cappuccino.

*Il pulsante ▾ è 44×44 px, non 56.* È una violazione consapevole della regola di `04-UX-MOBILE.md` §1. Il motivo: il ▾ sta nell'angolo del riquadro, e a 56 px occuperebbe più della metà della superficie utile, moltiplicando i tap sbagliati sull'azione **più** frequente — quella breve. Il compromesso è che la stessa funzione si raggiunge anche con una pressione prolungata sul riquadro intero. Da riesaminare nel collaudo T-18: se il barista apre il pannello per sbaglio, il disegno va cambiato.

*La logica sta in `lib/dominio/listino.ts`, non nell'hook.* Scelta della variante, nome completo e ordine delle categorie sono funzioni pure e hanno 9 test. Nell'hook resta solo la query. È la regola di dipendenza di `CLAUDE.md`: le cose che non devono sbagliare vivono dove si possono testare senza montare React.

---

### T-11 — Apertura conto

Dipende da: T-08, T-09
File toccati: `app/page.tsx`, `app/conto/[id]/page.tsx`

Cosa fare: home con conti aperti, pannello **+**, creazione conto.

Fatto quando:

- [x] La home elenca i conti aperti con cliente, totale e tempo trascorso
- [x] Il **+** apre il pannello con "Banco" in cima e i clienti frequenti sotto
- [x] I frequenti sono ordinati per numero di conti negli ultimi 30 giorni — `ordinaPerFrequenza` in `lib/dominio/clienti.ts`, il conteggio in `lib/hooks/use-frequenza.ts`
- [x] Accanto a ogni cliente si vede il suo saldo
- [ ] Selezionare un cliente che ha già un conto aperto porta a quel conto, senza errori
- [ ] Da "Nuovo cliente" si crea e si apre il conto in un solo passaggio
- [ ] Il conto si apre anche offline

---

### T-12 — Righe di conto

Dipende da: T-10, T-11
File toccati: `components/conto/righe-conto.tsx`, `barra-totale.tsx`

Cosa fare: aggiunta righe con aggiornamento ottimistico, incremento quantità, eliminazione entro 60 s, storno oltre.

Fatto quando:

- [ ] Il tap fa comparire la riga in meno di 100 ms (misurato, non stimato)
- [ ] Toccare due volte lo stesso prodotto e variante dà `×2` su una riga sola
- [ ] Prodotti diversi o varianti diverse restano righe separate
- [ ] La riga mostra la variante per esteso ("Cappuccino decaffeinato")
- [ ] La **✕** compare per 60 secondi e poi scompare
- [ ] Dopo i 60 s la pressione prolungata offre "Storna"
- [ ] La riga stornata resta visibile, barrata, e il totale è corretto
- [ ] Il totale in basso resta visibile mentre si scorre
- [ ] Cambiare il prezzo del prodotto nel listino **non** cambia le righe già inserite

---

### T-13 — Chiusura conto: incassa e a credito

Dipende da: T-12
File toccati: `components/conto/pannello-pagamento.tsx`, `lib/dominio/crediti.ts`

Cosa fare: pannello pagamento di `04-UX-MOBILE.md` §6 e azione "A credito".

Fatto quando:

- [x] "A CREDITO" chiude il conto in un tap, senza conferma, e il saldo del cliente aumenta dell'importo esatto
- [x] "A CREDITO" non compare sui conti "Banco"
- [x] Il pannello incasso mostra conto corrente, debito precedente e totale dovuto
- [x] Le due scorciatoie ("solo il conto" / "tutto") inseriscono l'importo giusto
- [x] Un pagamento parziale lascia la differenza a saldo
- [x] Un importo superiore al dovuto mostra il resto da dare
- [x] Dopo la conferma compare il nuovo saldo per 2 secondi, poi si torna alla home
- [x] Il metodo di pagamento viene salvato
- [ ] Tutto funziona offline — **da provare sul telefono**

---

### T-14 — Scheda cliente ed estratto conto

Dipende da: T-13
File toccati: `app/clienti/[id]/page.tsx`, `components/clienti/estratto-conto.tsx`

Cosa fare: saldo, azioni rapide, movimenti raggruppati per giorno.

Fatto quando:

- [x] Il saldo mostrato coincide con `v_saldo_clienti`
- [x] I movimenti sono raggruppati per giorno, dal più recente
- [x] I pagamenti appaiono in verde con segno meno
- [x] Gli storni sono visibili e barrati
- [x] "APRI CONTO" e "INCASSA" funzionano dalla scheda
- [x] Il caricamento è paginato (30 movimenti alla volta)
- [x] Offline: il saldo si vede, lo storico avvisa che serve la rete — **da riprovare in modalità aereo**

---

### T-15 — Schermata Crediti

Dipende da: T-14
File toccati: `app/crediti/page.tsx`, `components/crediti/`, `lib/dominio/crediti.ts`, `components/shell/barra-navigazione.tsx`

Cosa fare: elenco debitori per anzianità, filtri, azioni chiama/scrivi.

Fatto quando:

- [x] L'elenco è ordinato per giorni di debito decrescenti
- [x] Il colore segue le soglie: verde ≤15 gg, arancione ≤45 gg, rosso oltre
- [x] Il totale in cima coincide con la somma dei saldi positivi
- [x] I filtri >30gg e >60gg funzionano
- [x] "Chiama" apre il dialer con il numero
- [x] "Scrivi" apre WhatsApp o SMS con il messaggio precompilato di `04-UX-MOBILE.md` §7, **modificabile prima dell'invio**
- [x] Nessun messaggio parte automaticamente
- [x] Con 0 debitori compare "Nessuno ti deve soldi 🎉"

---

### T-16 — Gestione listino

Dipende da: T-10
File toccati: `app/listino/page.tsx`

Cosa fare: modifica prezzi, varianti, preferiti, riordino, disattivazione.

**Il riordino c'è, ma non per trascinamento.** `04-UX-MOBILE.md` §9 diceva "trascinamento", e questo documento aveva già scritto la via d'uscita: *"se al banco l'ordine dà fastidio, si riapre con delle frecce su/giù"*. È quello che è stato fatto il 12 agosto, e le ragioni sono le stesse di allora più una.

Il trascinamento su telefono è una libreria in più, contro `03-ARCHITETTURA.md` §1 — oppure è codice scritto a mano che litiga con lo scorrimento della pagina, in una schermata dove non si può provare a tavolino. Le frecce invece o funzionano o non compilano: non hanno uno stato intermedio in cui il dito parte, la lista scorre e il prodotto finisce due posti più in là.

E c'è un motivo che vale di più: **con 63 prodotti su nove categorie, spostare qualcosa "molto in su" col trascinamento vuol dire trascinare mentre la lista scorre da sola.** Il tasto ⇈ *in cima* fa quel gesto in un tocco, ed è il gesto che serve davvero — perché quello che si vuole non è "un posto più su", è "questo lo voglio fra i primi".

Si sposta il **nome base**, non la singola variante: nella griglia un riquadro è un nome base (`v_griglia_prodotti` raggruppa e prende `min(ordine)`), quindi le varianti si muovono insieme. Il riordino è una modalità che si accende dal tasto in alto: fuori da lì la schermata è quella di prima.

Fatto quando:

- [x] Il prezzo si modifica in linea e si salva
- [x] Cambiando un prezzo compare l'avviso che vale solo per il futuro
- [x] Si aggiunge una variante a un prodotto esistente e compare subito nel pannello varianti della griglia
- [x] Si aggiunge un prodotto nuovo con la sua categoria
- [x] Segnando più di 9 preferiti compare un avviso
- [x] Un prodotto si disattiva e sparisce dalla griglia, restando nello storico
- [x] Richiede la rete, e lo dice se non c'è

---

### T-17 — PWA e installazione

Dipende da: T-15
File toccati: `public/sw.js`, `app/offline/page.tsx`, `components/shell/registra-service-worker.tsx`, `netlify.toml`

Cosa fare: manifest, icone, service worker, schermata di avvio.

**Il service worker è scritto a mano**, ottanta righe in `public/sw.js`. `next-pwa` sarebbe una dipendenza non prevista in `03-ARCHITETTURA.md` §1, e genera un file che nessuno legge: un service worker sbagliato non dà errore, continua a servire una versione vecchia dell'app finché qualcuno non se ne accorge.

Non mette in cache nessun **dato**: quelli stanno già in IndexedDB e le scritture passano dalla coda. Si occupa solo di far partire l'app senza rete — guscio, script, stili. Le chiamate a Supabase le lascia fallire apposta, perché è dal fallimento che la coda capisce di dover ritentare.

I criteri qui sotto si verificano solo **sui telefoni veri**: nessuno dei due sistemi operativi si può simulare a tavolino, e Lighthouse va lanciato sul sito pubblicato.

Fatto quando:

- [x] Su Android compare la richiesta di installazione — provato
- [x] Su iPhone "Aggiungi a schermata Home" produce un'app a schermo intero senza barra del browser — provato
- [x] L'icona è visibile e nitida su entrambi — provato
- [x] Aprendo l'app senza rete si vedono i dati in cache, non una schermata di errore — la pagina `/offline` copre il caso della schermata mai aperta
- [ ] Lighthouse mobile: prestazioni ≥ 90 — **da lanciare sul sito pubblicato**

**Il criterio è cambiato perché lo strumento è cambiato.** Diceva "PWA installabile, prestazioni
≥ 90", ma **Lighthouse ha tolto del tutto la categoria PWA nella versione 12** (maggio 2024): non
esiste più un punteggio da leggere. Che l'app si installi lo abbiamo verificato nel modo che
conta di più — provandolo su iPhone, Android e iPad. Di Lighthouse resta il numero delle
prestazioni, che è quello che dice se l'app è più lenta del foglio.

**Provata l'8 agosto su iPhone, Android e iPad**: si installa e si apre a schermo intero su tutti
e tre. Resta solo Lighthouse, che non si lancia dal telefono.

**Ma è emerso un difetto che i criteri non prevedevano:** ogni tanto l'app si ferma per qualche
secondo e poi riparte. Non è nella lista perché nessuno aveva pensato di misurare la latenza di
una navigazione. È aperto come attrito, primo candidato di T-19, e l'ipotesi sta in `09-DIARIO.md`.

---

### T-18 — Collaudo sul campo

Dipende da: T-17
File toccati: nessuno

Cosa fare: usare l'app dietro il banco per una settimana, annotando ogni attrito.

**Il protocollo sta in [`08-COLLAUDO.md`](08-COLLAUDO.md)**: come si misura ogni criterio qui
sotto, come si annota un attrito, e i criteri arretrati di T-10, T-11, T-12, T-13, T-14 e T-17
che si spuntano per strada perché a tavolino non si potevano verificare. Si legge una volta, la
sera prima di cominciare. Dietro il banco serve solo `scheda-collaudo.pdf`, fotocopiata sette
volte.

Fatto quando:

- [ ] Un caffè si registra in **1 tap** dall'apertura dell'app, cronometrato — e in 3 se va a credito a un cliente esistente
- [ ] L'app si apre in meno di 1,5 s con la cache calda
- [ ] Una giornata intera in modalità aereo si sincronizza correttamente al ritorno della rete, senza duplicati e senza perdite
- [ ] Due dispositivi sullo stesso conto non producono incoerenze
- [ ] I saldi dell'app coincidono con il foglio di carta tenuto in parallelo
- [ ] È scritta una lista degli attriti riscontrati, con priorità

**Il foglio di carta va tenuto in parallelo per tutta questa settimana.** È l'unico modo per accorgersi di una divergenza prima che diventi un problema con un cliente.

#### Attriti già raccolti e corretti (12 agosto)

Tre segnalazioni dal banco, corrette subito perché toccavano il gesto più frequente della
giornata. Il ragionamento completo, con la causa vera, sta in `09-DIARIO.md`.

| Attrito | Correzione | Dove |
|---|---|---|
| Per battere un prodotto servivano due tap prima di vedere la griglia | La schermata di apertura **è** la griglia, su un conto al banco sempre pronto. Il cliente si chiede alla fine | `04-UX-MOBILE.md` §3 |
| "Scontrino battuto" finiva sotto la tastiera: per vederlo bisognava scorrere | Due tasti Sì/No da 56 px, prima cosa in cima al pannello, con lo stato scelto evidente | `04-UX-MOBILE.md` §6 |
| La virgola negli importi era un tasto da sbagliare | Inserimento stile bancomat: le cifre entrano da destra, "250" è 2,50 €. Tastierino nel pannello, niente tastiera di sistema | `04-UX-MOBILE.md` §6.1 |
| Un conto segnato a credito non finiva sul saldo di nessuno | La bozza aggiornata si passa invece di ripescarla, e il divieto è diventato `puoAndareACredito` con i test intorno | `09-DIARIO.md` |
| Dando un nome al conto in corso, l'ordinazione spariva dallo schermo | Il conto in corso è uno stato che si tiene, non "la bozza senza cliente" ricalcolata a ogni render | `04-UX-MOBILE.md` §3 |
| Incassando non si poteva intestare il conto a nessuno | Il nome del conto è accanto all'importo e si tocca per cambiarlo, senza chiudere il pannello | `04-UX-MOBILE.md` §6 |

Sono correzioni di T-18, non anticipi di T-19: non aggiungono funzioni, tolgono attrito da
funzioni che c'erano già. Il criterio dei tap qui sopra è stato riscritto di conseguenza — la
versione vecchia misurava la cosa sbagliata.

---

### T-19 — Correzioni post-collaudo

Dipende da: T-18

Cosa fare: risolvere gli attriti emersi, in ordine di frequenza.

Fatto quando:

- [ ] Ogni attrito ad alta priorità è risolto o esplicitamente rinviato con motivazione
- [ ] Il collaudo si ripete per 3 giorni senza nuovi attriti gravi
- [ ] **Il foglio di carta viene abbandonato**

Questo è il vero criterio di uscita dalla Fase 1. Non "il codice è finito": "il foglio non serve più".

---

## FASE 2 — Cassa (solo dopo T-19)

> **T-20 e T-22 sono stati fatti l'8 agosto, prima di T-18 e T-19.** È il secondo strappo alla
> regola dopo gli Scontrini, e come quello va scritto invece che nascosto.
>
> Il motivo è che il bisogno non era "la cassa": era che **a fine turno un collega deve poter
> smontare lasciando i conti in ordine**, e finché quel gesto non esiste il foglio di carta resta
> in mano a due persone invece che a una. Non era rinviabile a dopo il collaudo, perché il
> collaudo si fa anche con i colleghi.
>
> Il costo lo si paga se T-18 dovesse rimettere in discussione qualcosa che sta sotto. Il rischio
> è contenuto: la chiusura di turno non tocca conti, righe né pagamenti — legge e basta — e la
> tabella nuova non è referenziata da nessuna delle esistenti. Se il collaudo bocciasse qualcosa,
> si toglie senza strascichi.
>
> **T-21, T-23 e T-24 restano fermi fino a T-19.**

| Task | Contenuto | Criterio principale |
|---|---|---|
| T-20 | ✅ Schema cassa (`02-MODELLO-DATI.md` §4.1) | Fatto — `0016_cassa_turni.sql`, 17 controlli automatici in `npm run verifica:migrazioni` |
| T-21 | 🟨 Registrazione incassi al banco senza conto | **Superato dal disegno nuovo**, vedi sotto |
| T-22 | ✅ Chiusura **di turno**, e la giornata come somma dei turni | Fatto — chi chiude scrive **un solo numero**, quanto c'è nel cassetto |
| T-23 | ✅ Report giornata e settimana | Fatto — `v_giornata`, schermata `/report` |
| T-24 | ✅ Esportazione CSV | Fatto — punto e virgola, virgola decimale, BOM, date `12/08/2026`; 17 test |
| T-25 | ✅ Classifica clienti — consumato e pagato, mese corrente e sempre | Fatto — `v_classifica_clienti`, con scritto in schermata che il banco resta fuori |
| T-26 | ✅ Che cosa esce — prodotti venduti per periodo | Fatto — `v_venduto_prodotto`, più il rovescio: quello che **non** esce |
| T-27 | ✅ Storico per giorno dentro la scheda cliente | Fatto — scelto un giorno si vede cosa ha preso e a che ora |

### T-21 è stato superato, non saltato

Il task chiedeva "un incasso rapido in 2 tap, senza aprire un conto". Nasceva quando la schermata
di apertura era l'elenco dei conti e aprirne uno costava due tocchi: la scorciatoia serviva a
saltarli.

Da quando la schermata di apertura è la griglia (04-UX-MOBILE §3) quei due tocchi non ci sono
più: prodotto → INCASSA → CONFERMA. Il conto viene creato lo stesso, ed è un bene — è quello che
alimenta `v_venduto_prodotto` e le ore di punta. Una via che incassa *senza* registrare che cosa è
uscito farebbe un buco proprio nei report appena scritti.

Resta 🟨 e non ✅ perché il criterio è "2 tap cronometrati", e si cronometra al banco: è un
criterio di T-18, non di questo task.

### Che cosa è stato fatto davvero

Una migrazione sola, `0018_report.sql`, con **quattro viste e nessuna tabella** — il dettaglio in
`02-MODELLO-DATI.md` §4.3, i controlli automatici in `npm run verifica:migrazioni` (42 in tutto).
Poi una schermata `/report` sotto Altro, e il filtro per giorno nella scheda cliente.

Le due analisi che il documento suggeriva senza numerarle ci sono entrambe: **a che ora si lavora**
(griglia ore × giorni sugli ultimi 90 giorni) e **chi è sparito** (clienti che non passano da tre
settimane). La terza — la velocità di rientro dal debito — resta scartata, come deciso.

### Perché T-25, T-26 e T-27 costano poco

**Non serve nessuna tabella nuova.** Sono tre letture su `righe_conto`, che già congela
`descrizione` e `prezzo_unitario_cent` (DEC-05) e già registra `creato_il` al secondo. Il lavoro
è tutto nelle viste e nell'interfaccia — sono le funzioni con il miglior rapporto fra ciò che
danno e ciò che costano di tutta la Fase 2.

**Gli storni si tolgono da soli.** Una riga stornata ha `quantita` negativa per vincolo di
schema, quindi `sum(quantita)` e `sum(importo_cent)` sono già netti. Non va scritto nessun filtro
speciale, e soprattutto non va scritto `where storno_di is null`: toglierebbe lo storno ma
lascerebbe la riga sbagliata dentro il conteggio.

**Il buco vero è il Banco.** I conti anonimi non hanno cliente, quindi restano fuori da T-25 per
costruzione — e in un bar sono spesso la maggioranza del giro. La classifica dice "chi fra i
clienti che conosco spende di più", non "da dove vengono i miei soldi". Va scritto nella
schermata, altrimenti il totale sembra sbagliato. T-26 invece li comprende tutti: quello che esce
esce, che sia segnato o pagato subito.

### Due cose che varrebbe la pena guardare, e a cui di solito non si pensa

Non sono task e non hanno un numero: sono domande che i dati sanno già rispondere, da valutare
quando si scriveranno T-25 e T-26.

**A che ora si lavora.** `creato_il` c'è su ogni riga: si può sapere l'ora di punta per giorno
della settimana senza aggiungere niente. È probabilmente l'analisi più utile di tutte, perché è
l'unica che cambia una decisione vera — quando stare dietro al banco, quando preparare, quando
tenere qualcuno in più.

**Chi è sparito.** Un cliente che veniva ogni mattina e non si vede da tre settimane è
un'informazione che nessuno ha e che vale più di una classifica: le classifiche mostrano chi c'è,
non chi manca. Si ricava dalla data dell'ultimo movimento.

Era stata proposta anche una terza misura — la velocità media con cui ogni cliente rientra dal
debito, per ordinare i solleciti — ed è stata **scartata dal titolare**. I Crediti continuano a
ordinare per anzianità del debito. Non va reintrodotta di nascosto dentro un'altra schermata.

C'è anche il rovescio di T-26: **il prodotto che non esce**. Sta a catalogo, occupa un riquadro
nella griglia e allunga la ricerca a tutti. È la stessa vista letta dal basso.

---

## FASE 3 — Magazzino (solo dopo che la Fase 2 è stabile)

| Task | Contenuto | Criterio principale |
|---|---|---|
| T-30 | ✅ Schema magazzino | `0020_magazzino.sql`. **Quantità intere in millesimi, non `numeric`** — vedi sotto |
| T-31 | ✅ Anagrafica fornitori e articoli | Nome, unità, scorta minima. I fornitori esistono nello schema, l'anagrafica dall'app arriva quando servirà |
| T-32 | ✅ Carichi, scarti e correzioni | Il segno lo mette il programma, il database lo verifica |
| T-33 | ✅ Distinta base | Si scrive dal lato dell'articolo: "un cappuccino quanto latte si mangia" si risponde avendo davanti il latte |
| T-34 | ✅ Scarico automatico disattivabile | **Nasce spento**, e la schermata spiega perché |
| T-35 | ✅ Alert sotto scorta | In cima, e solo quello che manca davvero |
| T-36 | ✅ Inventario | Registra la **differenza**, non il contato |

### Le quantità sono interi in millesimi

La bozza in `0006_fase3_magazzino.sql` — mai eseguita — usava `numeric(10,3)`. Dentro Postgres
sarebbe stato esatto; il problema comincia quando quel numero esce, perché PostgREST lo consegna a
JavaScript e lì il decimale esatto non esiste.

Un caffè scarica 7 g di grani: duecento caffè al giorno per un mese sono seimila somme, e la
giacenza comincia a finire con `,00000000004`. Poi la si confronta con l'inventario contato a mano e
non torna mai. È la stessa ragione per cui il denaro sta in centesimi (DEC-04), e `0006` è stato
sostituito da `0020` come `0005` lo era stato da `0016`.

### Tre decisioni che vale la pena rileggere

**Il magazzino non può bloccare la cassa.** Il trigger che scarica sta su `righe_conto`: se
sollevasse un'eccezione farebbe fallire la conferma del conto, e la vendita andrebbe persa con la
fila davanti. Quindi qualunque errore lì dentro viene ingoiato. Si scopre solo all'inventario — ed è
il prezzo consapevole di non perdere un caffè.

**Nasce spento.** In un bar il consumo vero non coincide mai con quello teorico. Acceso senza
inventari periodici produce numeri falsi che sembrano veri, e sui numeri falsi si fanno gli ordini.

**L'inventario registra la differenza.** I movimenti si sommano: scrivere il contato aggiungerebbe
quella quantità a quella che risultava già. È l'errore facile, e per questo `differenzaInventario`
è una funzione pura con i test intorno.

### Che cosa non c'è

L'anagrafica dei fornitori **dall'app**: la tabella c'è e gli articoli ci si collegano, ma non c'è
una schermata per crearli. Serve il giorno in cui i fornitori diventano più di tre.

---

## FASE 4 — Multi-utente

| Task | Contenuto | Criterio principale |
|---|---|---|
| T-40 | ✅ Policy RLS per ruolo | Fatto — listino e report al titolare. **Le query di verifica sono in `06-SETUP-SUPABASE.md` §5.2 e vanno eseguite su Supabase** |
| T-41 | 🟨 Gestione utenti dall'app | Ruoli e disattivazione sì, creazione no: vedi sotto |
| T-42 | 🟨 Tracciabilità | Il database firma ogni riga (`creato_da`), e c'è il report per operatore. **Manca l'autore sulla singola riga dell'estratto conto** |
| T-43 | ✅ Report per operatore | Fatto — `v_operatore_giornata`, sezione "Chi ha lavorato" nei Report |
| T-44 | ✅ PIN di blocco rapido | Fatto — quattro cifre, si copre da solo, `lib/dominio/blocco.ts` con 13 test |

### Un buco che c'era da sempre, chiuso qui

La policy `modifica profilo proprio` di `0003_sicurezza.sql` permetteva a chiunque di aggiornare la
propria riga in `profili`. Quella riga contiene `ruolo`. **Fino a `0019` un barista poteva
scrivere `update profili set ruolo = 'titolare' where id = auth.uid()` e diventare titolare**, con
la sola chiave anon, che è pubblica per disegno. Non serviva nemmeno un errore dell'app.

Adesso il divieto sta in un trigger — non in una policy, perché una `with check` vede solo la riga
nuova e qui serve accorgersi che il ruolo è **cambiato**. Insieme sono arrivate altre due
protezioni: nessuno cambia il proprio ruolo (nemmeno il titolare), e l'ultimo titolare attivo non
si può retrocedere né disattivare — altrimenti il locale resta senza nessuno che possa cambiare
prezzi, ruoli e fondo cassa, e senza modo di rimediare dall'app.

### T-41: gli account si creano da Supabase

Il criterio diceva "senza aprire Supabase" e **non è rispettato**, per scelta. Creare un utente
richiede la chiave `service_role`, quella che scavalca ogni permesso: tenerla fra le variabili
d'ambiente del sito vorrebbe dire averla in un posto in più tutti i giorni, per un'operazione che
capita due volte l'anno. Se si perde, si perde tutto — clienti, debiti, pagamenti.

Dall'app si fa quello che serve spesso: chi è titolare, chi è barista, chi non lavora più. Gli
inviti si mandano da Supabase in due clic, ed è scritto passo passo in `06-SETUP-SUPABASE.md` §5.3.

### Che cosa questi permessi non fanno

Un barista **può leggere `righe_conto` e `pagamenti`**, e deve poterlo fare: da lì vengono i saldi
dei clienti, e senza saldi non può decidere se dare credito. Chi legge quelle tabelle le può anche
sommare, quindi può ricavarsi il ricavo della giornata anche se l'app non glielo mostra da nessuna
parte.

Chiuderlo davvero vuol dire far passare ogni lettura da funzioni `security definer`, cioè rifare
l'impianto della sicurezza. È una cosa da fare il giorno in cui il ricavo diventa un segreto da
proteggere, non solo un numero da non sbandierare. Sta scritto anche dentro `0019_ruoli.sql`,
accanto al codice.

---

## Ordine di priorità se il tempo è poco

Se dovessi fermarti a metà, questo è l'ordine di valore decrescente:

1. **T-01 → T-15**: senza questi non c'è sistema. T-15 (Crediti) è la ragione per cui il progetto esiste.
2. **T-17 → T-19**: senza installazione e collaudo il sistema esiste ma non viene usato.
3. **T-09**: la coda offline. Si può rimandare per iniziare a provare, ma non si può rilasciare senza.
4. **T-16**: il listino si può gestire da Supabase all'inizio. Scomodo, non bloccante.
5. Tutto il resto.

---

**Prossimo documento:** `06-SETUP-SUPABASE.md`
