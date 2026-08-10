-- Gestionale Bar — migrazione 0017
-- La spunta dello scontrino si può correggere. Il resto del pagamento no.
--
-- Esecuzione: SQL Editor di Supabase. È idempotente.
--
-- Verifica dopo l'esecuzione:
--   -- deve FUNZIONARE
--   update pagamenti set scontrino_battuto = false
--     where id = (select id from pagamenti limit 1);
--   -- devono FALLIRE
--   update pagamenti set importo_cent = 1 where id = (select id from pagamenti limit 1);
--   update pagamenti set metodo = 'carta' where id = (select id from pagamenti limit 1);

-- Perché si cambia una migrazione di due ore fa.
--
-- La 0015 ha vietato ogni `update` su `pagamenti`, per far rispettare DEC-03
-- dal database e non dall'app. La regola era giusta, il confine no: DEC-03
-- parla di **movimenti**, cioè quanto, a chi, quando e con che metodo. Se
-- accanto sia stato battuto uno scontrino non è il movimento — è
-- un'annotazione su un gesto fiscale fatto o non fatto, e le annotazioni si
-- correggono, perché sbagliarle è normale e nasconderle non aiuta nessuno.
--
-- Con il divieto totale, l'unico modo di correggere una spunta sarebbe stato
-- stornare il pagamento e rifarlo: due movimenti finti nell'estratto conto di
-- un cliente per sistemare un booleano. Il rimedio peggiore del male, e
-- proprio nel documento — l'estratto conto — che DEC-03 esiste per tenere
-- pulito.
--
-- Qui il divieto diventa preciso: passa la sola `scontrino_battuto`, tutto il
-- resto resta di pietra.

-- Chi ha corretto e quando. Una correzione silenziosa somiglia troppo a un
-- dato che non è mai stato sbagliato.
alter table pagamenti
  add column if not exists scontrino_corretto_il timestamptz,
  add column if not exists scontrino_corretto_da uuid references profili(id);

-- La correzione è del titolare, non di chi ha battuto.
-- Stessa logica della cancellazione dei clienti in 0010: si stringe subito
-- ciò il cui effetto è difficile da vedere. Una spunta sbagliata sposta un
-- numero che si guarda a fine mese, quando nessuno ricorda più la serata —
-- e chi ha sbagliato a battere è la persona con più fretta di sistemare.
--
-- Sta in due posti di proposito. La policy è l'autorizzazione vera. Il
-- controllo nel trigger serve al messaggio: RLS che vieta non solleva un
-- errore, restituisce zero righe toccate, e l'app direbbe "fatto" senza aver
-- fatto niente — la trappola già scritta in CLAUDE.md.

drop policy if exists "scrittura pagamenti"      on pagamenti;
drop policy if exists "lettura pagamenti"        on pagamenti;
drop policy if exists "inserimento pagamenti"    on pagamenti;
drop policy if exists "correzione solo titolare" on pagamenti;

create policy "lettura pagamenti" on pagamenti
  for select to authenticated using (true);

create policy "inserimento pagamenti" on pagamenti
  for insert to authenticated with check (true);

create policy "correzione solo titolare" on pagamenti
  for update to authenticated
  using (ruolo_corrente() = 'titolare')
  with check (ruolo_corrente() = 'titolare');

-- Nessuna policy per `delete`: senza, RLS lo nega. Il trigger di 0003 resta
-- come seconda serratura e come messaggio comprensibile.

create or replace function blocca_modifica_pagamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.ruolo_corrente() is distinct from 'titolare' then
    raise exception
      'Solo il titolare può correggere la spunta dello scontrino.';
  end if;

  -- Tutto quello che è il movimento deve restare identico.
  if new.id                is distinct from old.id
  or new.cliente_id        is distinct from old.cliente_id
  or new.conto_id          is distinct from old.conto_id
  or new.importo_cent      is distinct from old.importo_cent
  or new.metodo            is distinct from old.metodo
  or new.storno_di         is distinct from old.storno_di
  or new.creato_il         is distinct from old.creato_il
  or new.creato_da         is distinct from old.creato_da
  or new.op_id             is distinct from old.op_id
  or new.note              is distinct from old.note then
    raise exception
      'Un pagamento non si modifica: si corregge con uno storno. Solo la spunta dello scontrino si può cambiare.';
  end if;

  -- Se la spunta non cambia, non c'è niente da fare e non si segna niente:
  -- un `update` che non cambia nulla non è una correzione.
  if new.scontrino_battuto is not distinct from old.scontrino_battuto then
    return new;
  end if;

  new.scontrino_corretto_il := now();
  new.scontrino_corretto_da := auth.uid();
  return new;
end;
$$;

-- Era `before update ... execute function blocca_modifica_movimento()`.
-- Ora ha una funzione sua, perché le due tabelle non hanno più la stessa regola:
-- su `righe_conto` resta il divieto totale.
drop trigger if exists trg_blocca_modifica_pagamento on pagamenti;
create trigger trg_blocca_modifica_pagamento
  before update on pagamenti
  for each row execute function blocca_modifica_pagamento();

-- `blocca_modifica_movimento()` continua a servire a `righe_conto`: là non
-- c'è nessun campo che sia un'annotazione, sono tutti il movimento.
