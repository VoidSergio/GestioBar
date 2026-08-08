-- Gestionale Bar — migrazione 0015
-- I movimenti non si modificano: il divieto passa dal database, non dall'app
--
-- Esecuzione: SQL Editor di Supabase. È idempotente.
--
-- Verifica dopo l'esecuzione (devono fallire tutte e due):
--   update pagamenti set importo_cent = 1 where id = (select id from pagamenti limit 1);
--   update righe_conto set prezzo_unitario_cent = 1 where id = (select id from righe_conto limit 1);

-- Che cosa mancava.
-- DEC-03 dice che righe e pagamenti sono immutabili: si correggono con un
-- movimento di segno opposto, non modificandoli. La cancellazione era già
-- impedita dal database — trg_blocca_cancellazione_riga con la finestra dei
-- 60 secondi, trg_blocca_cancellazione_pagamento senza eccezioni. La modifica
-- no: le policy della Fase 1 sono `for all to authenticated using (true)`,
-- quindi un `update pagamenti set importo_cent = 1` passava.
--
-- In pratica non è mai successo, perché l'app su queste due tabelle fa solo
-- insert e delete (lib/offline/invio.ts). Ma è esattamente il ragionamento
-- che DEC-03 rifiuta: se la regola sui soldi vale solo finché il codice è
-- corretto, non è una regola, è una consuetudine. Un errore in un hook, o
-- chiunque abbia un accesso e sappia usare l'API, la aggirava in una riga.
--
-- Le altre update restano permesse perché non sono movimenti: `conti.stato`
-- che passa ad "chiuso", `clienti.attivo` per la disattivazione, e il listino.

create or replace function blocca_modifica_movimento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'Questo movimento non si modifica. Per correggerlo, registra uno storno.';
end;
$$;

drop trigger if exists trg_blocca_modifica_riga on righe_conto;
create trigger trg_blocca_modifica_riga
  before update on righe_conto
  for each row execute function blocca_modifica_movimento();

drop trigger if exists trg_blocca_modifica_pagamento on pagamenti;
create trigger trg_blocca_modifica_pagamento
  before update on pagamenti
  for each row execute function blocca_modifica_movimento();

-- Nota per la Fase 2.
-- Quando arriveranno movimenti_cassa e le chiusure di turno, valgono le stesse
-- due domande: si possono cancellare? si possono modificare? Una chiusura di
-- turno è una dichiarazione firmata da una persona su quanto c'era nel
-- cassetto. Se si può riscrivere dopo, non dichiara più niente.
