-- Gestionale Bar — migrazione 0008
-- Permessi sulle funzioni SECURITY DEFINER e indici sulle chiavi esterne
--
-- Esecuzione: SQL Editor di Supabase, una volta sola. È idempotente.
--
-- Chiude due delle tre famiglie di avvisi gialli del Security Advisor.
-- La terza ("RLS Policy Always True") è una scelta voluta: vedi in fondo.


-- ============================================================
-- 1. Chi può eseguire le funzioni SECURITY DEFINER
-- ============================================================
-- Una funzione SECURITY DEFINER gira con i permessi di chi l'ha creata,
-- cioè dell'amministratore. Postgres, per impostazione predefinita, concede
-- il permesso di esecuzione a PUBLIC: chiunque abbia la chiave anon poteva
-- chiamarle direttamente.
--
-- Nessuna delle due è pericolosa di per sé, ma non c'è motivo di lasciarle
-- aperte: una funzione che nessuno deve chiamare a mano non deve essere
-- chiamabile a mano.

-- crea_profilo_utente() è una funzione di trigger: la esegue il database
-- quando nasce un utente. I trigger NON controllano il permesso di esecuzione,
-- quindi togliendolo a tutti il trigger continua a funzionare e la funzione
-- diventa non invocabile dall'esterno.
revoke all on function crea_profilo_utente() from public, anon, authenticated;

-- ruolo_corrente() restituisce il ruolo di chi la chiama. Serve alle policy
-- della Fase 4. Un utente anonimo non ha un ruolo, quindi non le serve.
revoke all on function ruolo_corrente() from public, anon;
grant execute on function ruolo_corrente() to authenticated;


-- ============================================================
-- 2. Indici sulle chiavi esterne
-- ============================================================
-- Una chiave esterna senza indice costringe Postgres a scorrere l'intera
-- tabella figlia ogni volta che si tocca la riga padre, e rende lente le
-- join. Sei chiavi ne erano prive.

-- Utili subito: filtro per categoria nella griglia, statistiche di vendita
create index if not exists idx_prodotti_categoria
  on prodotti (categoria_id);

create index if not exists idx_righe_prodotto
  on righe_conto (prodotto_id);

-- Utili dalla Fase 4 in poi (report per operatore, "chi ha inserito cosa").
-- Si aggiungono adesso perché costano quasi nulla: qualche centinaio di
-- scritture al giorno non risente di un indice in più, e averli già pronti
-- evita una migrazione su dati veri più avanti.
create index if not exists idx_clienti_creato_da     on clienti (creato_da);
create index if not exists idx_conti_creato_da       on conti (creato_da);
create index if not exists idx_righe_creato_da       on righe_conto (creato_da);
create index if not exists idx_pagamenti_creato_da   on pagamenti (creato_da);


-- ============================================================
-- 3. "RLS Policy Always True" — perché resta così
-- ============================================================
-- L'advisor segnala che le policy usano `using (true)`, cioè non filtrano
-- nulla. È vero, ed è deliberato.
--
-- La riga completa è:
--     create policy "..." on tabella for all TO AUTHENTICATED using (true);
--
-- Il pezzo che conta è `to authenticated`: un utente anonimo non rientra e
-- non legge niente. La policy dice "chiunque abbia fatto il login può
-- operare", che in Fase 1 è esattamente il comportamento voluto — l'unico
-- utente sei tu, e il barista che arriverà deve poter fare le stesse cose.
--
-- In Fase 4 (task T-40) queste policy verranno sostituite da regole per
-- ruolo: il barista non leggerà i report economici, non modificherà il
-- listino, non cancellerà righe altrui. Solo allora l'avviso sparirà, e
-- sparirà perché sarà cambiato il requisito, non per far contento un
-- controllo automatico.
--
-- Restringere adesso significherebbe scrivere regole per ruoli che non
-- esistono ancora, e doverle riscrivere quando esisteranno.


-- ============================================================
-- Verifica
-- ============================================================
-- Permessi sulle due funzioni (non deve comparire "=X" per public):
--   select proname, proacl from pg_proc
--   where proname in ('crea_profilo_utente', 'ruolo_corrente');
--
-- Chiavi esterne ancora senza indice (deve restituire 0 righe):
--   select conrelid::regclass as tabella, conname
--   from pg_constraint c
--   where contype = 'f'
--     and connamespace = 'public'::regnamespace
--     and not exists (
--       select 1 from pg_index i
--       where i.indrelid = c.conrelid
--         and (i.indkey::smallint[])[0:array_length(c.conkey,1)-1] @> c.conkey
--     );
