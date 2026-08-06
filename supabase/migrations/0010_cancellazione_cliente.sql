-- Gestionale Bar — migrazione 0010
-- Cancellare un cliente: solo il titolare, e solo se non ha lasciato tracce
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   select policyname, cmd from pg_policies where tablename = 'clienti';
--     -- "scrittura autenticati"      ALL     (senza DELETE)
--     -- "cancellazione solo titolare" DELETE


-- ============================================================
-- 1. Perché la cancellazione è un caso a parte
-- ============================================================
-- Fino a qui la policy "scrittura autenticati" copriva `for all`, quindi
-- anche DELETE: qualunque barista poteva cancellare un cliente. Non era un
-- problema pratico solo perché l'app non offriva il pulsante.
--
-- Un cliente non è un dato come un altro: è la persona a cui sono intestati
-- dei soldi. Cancellarlo per sbaglio significa perdere il conto di quanto
-- deve, e in un bar quel numero non si ricostruisce a memoria.
--
-- Due protezioni, indipendenti:
--
--   a) il permesso: solo il titolare può cancellare (questa migrazione);
--   b) l'integrità: `conti.cliente_id references clienti(id)` senza
--      ON DELETE. Postgres rifiuta di cancellare un cliente che ha anche un
--      solo conto. Non serve aggiungere niente — c'è già dal 0001, ed è la
--      protezione che conta davvero, perché vale anche se un domani
--      qualcuno tocca le policy.
--
-- Quindi si può cancellare **solo un cliente senza nessun movimento**: un
-- doppione, un nome sbagliato, una prova. Per tutti gli altri l'app usa
-- `attivo = false`, che li toglie dagli elenchi lasciando intatto
-- l'estratto conto (DEC-03: i movimenti non si cancellano, si stornano).


-- ============================================================
-- 2. Le policy
-- ============================================================
-- La policy esistente copriva anche DELETE: si restringe a quello che serve
-- davvero, cioè leggere, inserire e aggiornare.
drop policy if exists "scrittura autenticati" on clienti;

create policy "lettura clienti" on clienti
  for select to authenticated using (true);

create policy "inserimento clienti" on clienti
  for insert to authenticated with check (true);

create policy "modifica clienti" on clienti
  for update to authenticated using (true) with check (true);

-- La disattivazione passa da "modifica clienti": è un UPDATE di `attivo`,
-- e resta alla portata di chiunque lavori al banco. È reversibile.
create policy "cancellazione solo titolare" on clienti
  for delete to authenticated
  using (ruolo_corrente() = 'titolare');


-- ============================================================
-- 3. Nota per la Fase 4
-- ============================================================
-- Quando arriveranno i baristi veri (T-40), le altre tre policy andranno
-- strette allo stesso modo. Oggi restano aperte perché lavora una persona
-- sola e stringerle adesso vorrebbe dire scrivere regole su un'ipotesi.
-- Questa invece si stringe subito perché il danno è irreversibile.
