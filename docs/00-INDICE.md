# Gestionale Bar — infrastruttura documentale

Sistema mobile-first per gestire conti aperti e clienti che pagano in ritardo.

---

## I documenti

| # | File | Cosa contiene | A chi serve |
|---|---|---|---|
| 01 | [`01-VISIONE-E-DECISIONI.md`](01-VISIONE-E-DECISIONI.md) | Il problema, il perimetro in fasi, le 7 decisioni architetturali con le alternative scartate, i rischi | **A te.** Leggilo per primo |
| 02 | [`02-MODELLO-DATI.md`](02-MODELLO-DATI.md) | Schema Postgres completo, SQL eseguibile, viste, sicurezza RLS | All'agente, e a te per capire cosa viene salvato |
| 03 | [`03-ARCHITETTURA.md`](03-ARCHITETTURA.md) | Stack, struttura cartelle, strategia offline, prestazioni, deploy | All'agente |
| 04 | [`04-UX-MOBILE.md`](04-UX-MOBILE.md) | Ogni schermata disegnata, i flussi, i messaggi, la palette | A entrambi |
| 05 | [`05-ROADMAP.md`](05-ROADMAP.md) | 44 task in 4 fasi, con criteri di accettazione verificabili | All'agente, e a te per seguire l'avanzamento |
| 06 | [`06-SETUP-SUPABASE.md`](06-SETUP-SUPABASE.md) | Guida passo passo, senza terminale, dalla registrazione al backup | **A te.** È il primo lavoro pratico |
| 07 | [`07-LISTINO.md`](07-LISTINO.md) | Il tuo listino reale con SQL pronto, il modello a varianti | A entrambi |
| 08 | [`08-COLLAUDO.md`](08-COLLAUDO.md) | Protocollo della settimana dietro il banco: come si misura ogni criterio di T-18, come si annota un attrito | **A te.** Si legge la sera prima di cominciare |
| — | [`scheda-collaudo.pdf`](scheda-collaudo.pdf) | La scheda di carta da fotocopiare sette volte e tenere dietro il banco | **A te.** È l'unica cosa che serve durante il servizio |
| — | [`CLAUDE.md`](CLAUDE.md) | Regole assolute per chi scrive il codice | All'agente, automaticamente |

---

## Il sistema in una pagina

**Cosa risolve.** Il cliente abituale dice "segna". A fine mese nessuno sa con certezza quanto deve, e chiedere imbarazza proprio perché non si è sicuri. Il sistema rende quel numero certo e immediato.

**Come è fatto.** Web app installabile sul telefono (PWA), dati su Postgres gestito da Supabase, funziona anche quando il wifi cade.

**Le quattro fasi.**

1. **Cuore** — clienti, listino, conti, pagamenti, crediti. È l'unica fase che conta davvero.
2. **Cassa** — incassi per metodo, chiusura giornaliera, report.
3. **Magazzino** — fornitori, giacenze, alert sotto scorta.
4. **Multi-utente** — ruoli, permessi, tracciabilità per i baristi.

**Il criterio di successo della Fase 1** non è "il codice è finito". È: *il foglio di carta viene abbandonato*.

---

## Le sette decisioni da conoscere

| | Decisione | In una riga |
|---|---|---|
| DEC-01 | Database gestito | Più dispositivi richiedono un punto centrale: non è una scelta di gusto |
| DEC-02 | Saldo calcolato, mai memorizzato | Un totale aggiornato a mano prima o poi diverge dalla realtà |
| DEC-03 | Movimenti immutabili, correzione con storni | Quando il cliente contesta, la domanda è "cosa è successo" |
| DEC-04 | Importi in centesimi interi | I decimali in JavaScript accumulano errori |
| DEC-05 | Prezzo congelato sulla riga | Aumentare il caffè non deve riscrivere i debiti di marzo |
| DEC-06 | Offline: leggi sempre, scrivi in coda | Il wifi del bar cade, l'app no |
| DEC-07 | PWA, non app da store | Aggiornare è un deploy, non un'approvazione |

---

## Da dove si comincia

1. Leggi `01-VISIONE-E-DECISIONI.md` per intero (10 minuti). Se qualcosa non ti convince, è il momento di dirlo.
2. Guarda le schermate in `04-UX-MOBILE.md` e verifica che corrispondano a come lavori davvero.
3. Controlla il listino in `07-LISTINO.md` e completa le voci mancanti (§4).
4. Esegui `06-SETUP-SUPABASE.md`: 20 minuti, nessun terminale.
5. Passa alla roadmap da T-01.

---

## Stato attuale

| Area | Stato |
|---|---|
| Progettazione | Completa |
| Listino (8 categorie) | 63 prodotti, 36 riquadri |
| Brioche, panini e voci residue | Da completare — `07-LISTINO.md` §5 |
| Migrazioni SQL | 14 file in `supabase/migrations/`, eseguite |
| Modulo denaro | Fatto, con controllo automatico della regola dei centesimi |
| Fase 0 e Fase 1 (T-01 → T-17) | Fatte — app pubblicata su Netlify, 216 test verdi |
| Il giro completo | Funziona: apri, batti, confermi, incassi o lasci a credito |
| **Adesso** | **T-18, la settimana dietro il banco** — `08-COLLAUDO.md` |

Per far partire il progetto: `npm install`, poi il `README.md` alla radice.
