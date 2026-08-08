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
