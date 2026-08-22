-- Gestionale Bar — migrazione 0021
-- Togliere il divieto di cancellare un profilo, che bloccava anche Supabase
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Verifica dopo l'esecuzione: prova a cancellare un utente appena creato da
-- Authentication → Users. Deve riuscire.


-- ============================================================
-- Che cosa era andato storto
-- ============================================================
-- `0019_ruoli.sql` ha messo un trigger su `profili` che vieta la
-- cancellazione, con questo ragionamento: un profilo cancellato lascia orfane
-- le righe che ha battuto, quindi si disattiva e non si cancella. Il
-- ragionamento resta giusto. Il posto era sbagliato.
--
-- `profili.id` è `references auth.users(id) on delete cascade`. Quindi
-- cancellare un utente dalla dashboard di Supabase non tocca solo `auth.users`:
-- fa scendere una cascata su `profili`, che sveglia il trigger, che solleva
-- un'eccezione, che fa fallire tutta l'operazione. Sulla dashboard compare
-- **"Database error deleting user"**, che non dice niente e non lascia via
-- d'uscita: da lì un utente creato per sbaglio non si toglie più.
--
-- La protezione vera però esisteva già, e non l'avevo vista: `conti`,
-- `righe_conto`, `pagamenti` e `clienti` hanno tutte `creato_da uuid
-- references profili(id)` **senza `on delete`**, cioè con il comportamento
-- predefinito, che è rifiutare. Un profilo che ha battuto anche una sola riga
-- è già intoccabile per vincolo di chiave esterna.
--
-- Il trigger quindi non aggiungeva nessuna protezione. Aggiungeva solo il caso
-- "un profilo che non ha mai fatto niente non si cancella", che non serve a
-- nessuno e che blocca l'unica strada per rimediare a un invito sbagliato.
--
-- La regola che resta, ed è quella che conta: **chi ha lavorato si disattiva,
-- non si cancella.** Adesso la fa rispettare il database dove va fatta
-- rispettare — sui dati, non sull'anagrafica.

drop trigger if exists trg_blocca_cancellazione_profilo on profili;
drop function if exists blocca_cancellazione_profilo();


-- ============================================================
-- Che cosa succede adesso
-- ============================================================
-- Cancellando un utente da Supabase:
--
--   • se non ha mai battuto niente  → si cancella, profilo compreso;
--   • se ha battuto anche una riga  → la cancellazione fallisce sul vincolo di
--                                     chiave esterna, e va disattivato dalla
--                                     schermata Persone.
--
-- Il secondo caso mostra ancora un messaggio poco chiaro sulla dashboard di
-- Supabase — quello lo scrive Supabase, non noi. Ma è il caso giusto in cui
-- fallire, ed è scritto in `06-SETUP-SUPABASE.md` §5.3.
