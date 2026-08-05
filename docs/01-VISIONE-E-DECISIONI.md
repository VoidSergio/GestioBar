# Visione e decisioni di progetto

> Documento discorsivo. Serve a capire **perché** il sistema è fatto così.
> Le specifiche esecutive stanno in `02-MODELLO-DATI.md`, `03-ARCHITETTURA.md`, `05-ROADMAP.md`.

---

## 1. Il problema

Un bar ha un problema di memoria. Non di contabilità: di memoria.

Il cliente abituale entra, prende il caffè, dice "segna". Il barista si segna qualcosa su un foglio, o non se lo segna. A fine mese nessuno sa con certezza quanto deve Mario, e chiedere risulta imbarazzante proprio perché non si è sicuri. Il credito si perde per timidezza, non per cattiva fede.

Il sistema esiste per rendere quel numero **certo e immediato**. Tutto il resto — catalogo, cassa, magazzino — è contorno che serve a far funzionare quel numero.

Questa gerarchia va tenuta a mente in ogni decisione futura. Se una scelta rende il magazzino più elegante ma la registrazione di un caffè a credito più lenta, la scelta è sbagliata.

## 2. Chi lo usa e in che condizioni

| Aspetto | Realtà |
|---|---|
| Chi | Prima solo il titolare. In seguito i baristi. |
| Dove | In piedi, dietro il banco. |
| Con cosa | Telefono, spesso con una mano sola, spesso con le mani bagnate. |
| Quanto tempo ha | 3 secondi. Se ce ne vogliono 15, torna al foglio di carta. |
| Rete | Wifi del locale, non garantito. |

Il vincolo dei **3 secondi** è il vero requisito non funzionale del progetto. Va misurato, non sperato: registrare "un caffè a Mario" deve richiedere al massimo 3 tap dalla schermata iniziale.

## 3. Perimetro e fasi

Hai indicato di volere tutto: conti, catalogo, cassa, magazzino. È una visione corretta, ma costruirlo tutto insieme è il modo più affidabile per non finirlo mai. Il perimetro è quindi diviso in fasi, con il **modello dati progettato fin da subito per accoglierle tutte** — così le fasi successive aggiungono tabelle e schermate, non riscrivono quelle esistenti.

### Fase 1 — Il cuore (obiettivo: usabile in produzione)

- Anagrafica clienti (nome, soprannome, telefono)
- Catalogo prodotti (< 50 voci, griglia a tap singolo)
- Conto aperto per cliente, con righe di consumazione
- Pagamenti, anche parziali
- Saldo progressivo e storico completo per cliente
- Vista "chi mi deve soldi", ordinata per anzianità del debito

**Criterio di uscita dalla Fase 1:** il titolare la usa per due settimane senza tornare al foglio di carta.

### Fase 2 — Cassa e chiusura giornaliera

- Incassi divisi per metodo (contanti, carta, credito)
- Flag "scontrino battuto" per la quadratura
- Report di fine giornata: incassato, credito concesso, credito rientrato
- Storico chiusure

### Fase 3 — Magazzino e fornitori

- Anagrafica fornitori
- Giacenze e movimenti (carico, scarico, rettifica)
- Legame prodotto venduto → scarico automatico (opzionale, configurabile)
- Alert sotto scorta

### Fase 4 — Multi-utente reale

- Ruoli titolare/barista con permessi differenziati
- Tracciabilità: chi ha aperto, modificato, incassato
- Report per operatore

## 4. Cosa il sistema NON fa

Dichiararlo esplicitamente evita derive future.

- **Non è un registratore di cassa fiscale.** Non emette scontrini, non parla con l'Agenzia delle Entrate, non gestisce corrispettivi telematici. Calcola un totale, tu lo batti sul registratore. Il sistema registra solo se lo scontrino è stato battuto, per quadrare a fine giornata.
- **Non è un software di contabilità.** Niente fatture, niente registri IVA, niente bilanci. Se serve, si esporta in CSV per il commercialista.
- **Non gestisce le paghe né i turni.**
- **Non è un sistema di prenotazione o di ordinazione da parte del cliente.**
- **Non fa servizio ai tavoli.** I conti sono legati alle persone, non ai tavoli. Se in futuro servisse, il modello dati lo permette (campo `tavolo` opzionale sul conto), ma la UX non è progettata per quello.

## 5. Decisioni architetturali

Ogni decisione è riportata con l'alternativa scartata e il motivo, così che tra sei mesi si capisca il ragionamento anche se il contesto è cambiato.

### DEC-01 — Database gestito (Supabase) invece di soluzioni senza server

**Decisione:** i dati vivono in un Postgres ospitato da Supabase.

**Perché:** più dispositivi che devono vedere gli stessi dati e lo stesso storico richiedono per forza un punto centrale — due telefoni non si sincronizzano da soli. Un file su un drive condiviso si corrompe non appena due persone scrivono insieme; un foglio di calcolo condiviso degrada e non regge i vincoli di integrità di un saldo contabile.

**Perché Supabase e non un server proprio:** non c'è niente da installare né da tenere acceso. È Postgres standard, quindi non c'è lock-in: un export porta via tutto.

**Costo:** piano gratuito ampiamente sufficiente (500 MB ≈ centinaia di migliaia di consumazioni).

**Rischio accettato:** dipendenza da un fornitore esterno. Mitigato dal backup settimanale automatico su file (vedi `06-SETUP-SUPABASE.md`) e dal fatto che lo schema è Postgres puro, migrabile ovunque.

### DEC-02 — Il saldo non si memorizza, si calcola

**Decisione:** non esiste una colonna `saldo` nella tabella clienti che viene aggiornata a ogni operazione. Il saldo è la somma degli addebiti meno la somma dei pagamenti, calcolata da una vista del database.

**Perché:** un saldo memorizzato e aggiornato "a mano" è la fonte numero uno di errori contabili. Basta un'operazione fallita a metà, una doppia esecuzione dovuta a un tap ripetuto su rete lenta, o una modifica fatta da due dispositivi insieme, e il numero diverge dalla realtà senza che nessuno se ne accorga. Un saldo calcolato non può divergere: se le righe sono giuste, il saldo è giusto per costruzione.

**Alternativa scartata:** saldo denormalizzato con trigger. Più veloce da leggere, ma introduce esattamente la classe di bug che questo sistema esiste per evitare.

**Quando riconsiderarla:** se con decine di migliaia di righe per cliente la lettura diventasse lenta. Non accadrà prima di anni; a quel punto si aggiunge una vista materializzata, senza cambiare la logica applicativa.

### DEC-03 — Le operazioni sono immutabili, si correggono con storni

**Decisione:** una riga di consumazione o un pagamento non si cancellano né si modificano. Si annullano creando un movimento contrario, che resta visibile nello storico.

**Perché:** quando un cliente contesta un importo, la domanda è "cosa è successo", non "qual è il totale". Uno storico che si può riscrivere non risponde a quella domanda, e soprattutto non protegge il titolare quando saranno i baristi a inserire i dati. La tracciabilità è la ragione per cui il cliente si fida del numero.

**Eccezione pratica:** entro 60 secondi dall'inserimento, e solo se il conto non è stato ancora chiuso, la riga può essere eliminata davvero. Serve a correggere il tap sbagliato senza sporcare lo storico di storni banali. Oltre quel limite, solo storno.

### DEC-04 — Prezzi in centesimi, mai in decimali

**Decisione:** tutti gli importi sono numeri interi che rappresentano centesimi. 1,20 € si scrive `120`.

**Perché:** i numeri con virgola in JavaScript non rappresentano esattamente i decimali. `0.1 + 0.2` non fa `0.3`. Su un conto con centinaia di righe l'errore si accumula e produce saldi che finiscono con `,0000001`. Con gli interi il problema non esiste.

**Conseguenza operativa:** la conversione a euro avviene solo al momento di mostrare il numero, mai nei calcoli. Esiste una sola funzione di formattazione in tutto il progetto.

### DEC-05 — Il prezzo si congela sulla riga

**Decisione:** quando un prodotto viene aggiunto a un conto, il suo prezzo viene copiato nella riga. Non si legge dal catalogo al momento del pagamento.

**Perché:** se ad aprile aumenti il caffè da 1,10 a 1,20, i caffè che Mario ha preso a marzo devono restare a 1,10. Senza questa regola, ogni ritocco di listino riscriverebbe retroattivamente tutti i debiti aperti — un disastro di fiducia.

**Stesso principio** per il nome del prodotto: se rinomini o elimini una voce di listino, lo storico deve restare leggibile.

### DEC-06 — Offline: leggere sempre, scrivere in coda

**Decisione:** l'app funziona anche senza rete. Le letture usano una copia locale dei dati; le scritture vengono messe in coda sul dispositivo e inviate appena la rete torna.

**Perché:** il wifi di un bar cade. Se l'app si blocca quando cade, il barista torna al foglio e il sistema è morto. La coda di scrittura è la parte che rende il sistema affidabile in condizioni reali.

**Come si evitano i conflitti:** ogni operazione è additiva (aggiungi una riga, aggiungi un pagamento) e porta un identificativo generato dal dispositivo. Due baristi che aggiungono righe allo stesso conto offline non entrano in conflitto: al ritorno della rete si sommano entrambe le righe, che è il comportamento corretto. L'identificativo garantisce che un reinvio non crei duplicati.

**Rinviato alla Fase 3:** le giacenze di magazzino, che invece un conflitto vero ce l'hanno. Vengono trattate come movimenti additivi con riconciliazione, non come un contatore da decrementare.

### DEC-07 — Web app installabile (PWA), non app da store

**Decisione:** l'app si apre nel browser e si può "installare" sulla schermata home del telefono.

**Perché:** aggiornarla significa fare un deploy, non attendere l'approvazione di uno store. Aggiungere un barista significa mandargli un link. Funziona su Android e iPhone con lo stesso codice.

**Limite accettato:** niente accesso diretto a stampanti bluetooth o lettori NFC. Se in futuro servisse la stampa comande, si valuta un ponte separato.

## 6. Rischi principali

| Rischio | Impatto | Come lo si affronta |
|---|---|---|
| L'app è più lenta del foglio di carta | Il sistema viene abbandonato | Vincolo dei 3 tap misurato su ogni schermata critica; test con l'uso reale prima di aggiungere funzioni |
| Il titolare inserisce i dati, i baristi no | Dati parziali e inaffidabili | Fase 4 con tracciabilità; ma soprattutto Fase 1 così semplice da non avere scuse |
| Ambizione di perimetro | Progetto mai finito | Fasi con criteri di uscita espliciti; il magazzino non si tocca prima che i conti siano in uso da settimane |
| Perdita dati | Grave | Backup automatico settimanale su file; Supabase ha già i suoi backup |
| Dispositivo perso o rubato | Accesso ai dati clienti | Login obbligatorio, sessione con scadenza, nessun dato sensibile oltre nome e telefono |

## 7. Dati personali

Il sistema tratta nome, soprannome e telefono di persone fisiche. È un trattamento di dati personali soggetto al GDPR, anche se minimo.

Regole minime adottate:

- Si raccoglie solo ciò che serve a identificare il cliente e contattarlo per il saldo. Niente indirizzi, niente date di nascita, niente note libere su abitudini o comportamenti.
- Il cliente ha diritto di chiedere l'esportazione o la cancellazione dei suoi dati. Il sistema prevede una funzione di anonimizzazione che sostituisce i dati identificativi mantenendo i totali contabili.
- L'accesso è protetto da login individuale.

Questo documento non è una consulenza legale: se il locale non ha già un'informativa privacy, va predisposta a parte.

---

**Prossimo documento:** `02-MODELLO-DATI.md`
