/**
 * Esegue tutte le migrazioni su un Postgres vero, in memoria, e verifica che
 * facciano quello che dicono. Non tocca il database di produzione.
 *
 * Perché esiste. Il 7 agosto una migrazione è stata modificata dopo essere
 * stata applicata e il push è fallito (09-DIARIO.md). Il 8 agosto la prima
 * versione di 0016 perdeva il primo pagamento della prima chiusura, e non
 * l'ha trovata nessuno leggendola: l'ha trovata questo script. Una migrazione
 * si legge, ma finché non gira non si sa cosa fa.
 *
 * Uso:  npm run verifica:migrazioni
 *
 * PGlite è Postgres compilato in WebAssembly: gira in Node, senza installare
 * niente e senza server. Non è Supabase — auth.uid() e i ruoli sono finti,
 * qui sotto — quindi non prova le policy RLS, che vanno provate sul progetto
 * vero. Prova tutto il resto: schema, vincoli, trigger, viste, colonne
 * calcolate, e i conti.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRAZIONI = path.join(RADICE, 'supabase', 'migrations');

/** Fase 2 e 3 non ancora riscritte: non si eseguono (05-ROADMAP.md T-02). */
const NON_ESEGUIRE = new Set(['0006_fase3_magazzino.sql']);

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error(
    "\nManca @electric-sql/pglite.\n" +
      '  npm install -D @electric-sql/pglite\n\n' +
      'È una dipendenza di sviluppo: non finisce mai nel pacchetto che gira sul telefono.\n'
  );
  process.exit(1);
}

const db = await PGlite.create();

// ── Finte Supabase ────────────────────────────────────────────────────────
// PGlite è Postgres nudo: i ruoli e lo schema `auth` li crea Supabase, non le
// nostre migrazioni. auth.uid() legge una variabile di sessione, così i test
// possono cambiare utente.
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select current_setting('test.uid', true)::uuid $$;
`);

// ── 1. Tutte le migrazioni girano, in ordine ──────────────────────────────
console.log('\nMIGRAZIONI');
const file = fs
  .readdirSync(MIGRAZIONI)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const f of file) {
  if (NON_ESEGUIRE.has(f)) {
    console.log(`  --  ${f}  (fase successiva, non si esegue)`);
    continue;
  }
  try {
    // pgcrypto non c'è in PGlite; gen_random_uuid() è nel nucleo di Postgres.
    const sql = fs.readFileSync(path.join(MIGRAZIONI, f), 'utf8');
    await db.exec(sql.replace(/create extension[^;]*;/gi, ''));
    console.log(`  ok  ${f}`);
  } catch (e) {
    console.error(`\n  FALLITA  ${f}\n  ${e.message}\n`);
    process.exit(1);
  }
}

// ── 2. Fanno quello che dicono ────────────────────────────────────────────
let passati = 0;
let falliti = 0;

const uno = async (sql) => (await db.query(sql)).rows[0];

function eq(nome, atteso, avuto) {
  if (String(atteso) === String(avuto)) {
    console.log(`  ok  ${nome}`);
    passati++;
  } else {
    console.log(`  KO  ${nome} — atteso ${atteso}, avuto ${avuto}`);
    falliti++;
  }
}

async function deveFallire(nome, sql, frammento) {
  try {
    await db.exec(sql);
    console.log(`  KO  ${nome} — è passato, e non doveva`);
    falliti++;
  } catch (e) {
    if (e.message.includes(frammento)) {
      console.log(`  ok  ${nome}`);
      passati++;
    } else {
      console.log(`  KO  ${nome} — messaggio inatteso: ${e.message}`);
      falliti++;
    }
  }
}

console.log('\nLISTINO');
eq('63 prodotti a catalogo', 63, (await uno('select count(*) n from prodotti')).n);
eq('36 riquadri nella griglia', 36, (await uno('select count(*) n from v_griglia_prodotti')).n);
eq(
  'Bitter con aggiunta a 3,00',
  300,
  (await uno("select prezzo_cent p from prodotti where nome_base='Bitter' and variante='con aggiunta'")).p
);

console.log('\nI MOVIMENTI SONO IMMUTABILI (DEC-03)');
const utente = await uno("insert into auth.users (email) values ('barista@bar.it') returning id");
await db.exec(`select set_config('test.uid', '${utente.id}', false)`);
const cliente = await uno("insert into clienti (nome) values ('Mario') returning id");
const conto = await uno(
  `insert into conti (cliente_id, op_id) values ('${cliente.id}', gen_random_uuid()) returning id`
);
await db.exec(`insert into righe_conto (conto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${conto.id}', 'Caffè', 120, 1, gen_random_uuid())`);
await db.exec(`insert into pagamenti (cliente_id, importo_cent, metodo, op_id)
  values ('${cliente.id}', 120, 'contanti', gen_random_uuid())`);

await deveFallire('l\u2019importo di un pagamento non si tocca', 'update pagamenti set importo_cent = 1', 'non si modifica');
await deveFallire('nemmeno il metodo', "update pagamenti set metodo = 'carta'", 'non si modifica');
await deveFallire('una riga non si modifica', 'update righe_conto set prezzo_unitario_cent = 1', 'non si modifica');
await deveFallire('un pagamento non si cancella', 'delete from pagamenti', 'non si cancellano');

console.log('\nLA SPUNTA DELLO SCONTRINO: SOLO IL TITOLARE (0017)');
// Il trigger crea_profilo_utente ha gia' fatto 'titolare' il primo utente.
await deveFallire(
  'un barista non la tocca',
  "update profili set ruolo = 'barista' where id = '" + utente.id + "'; update pagamenti set scontrino_battuto = true",
  'Solo il titolare'
);
await db.exec(`update profili set ruolo = 'titolare' where id = '${utente.id}'`);
await db.exec('update pagamenti set scontrino_battuto = true');
eq('la spunta cambia', true, (await uno('select scontrino_battuto s from pagamenti limit 1')).s);
eq(
  'e lascia detto chi e quando',
  true,
  (await uno('select scontrino_corretto_il is not null and scontrino_corretto_da is not null t from pagamenti limit 1')).t
);
await db.exec('update pagamenti set scontrino_corretto_il = null, scontrino_corretto_da = null, scontrino_battuto = true');
eq(
  'un update che non cambia la spunta non segna niente',
  null,
  (await uno('select scontrino_corretto_il i from pagamenti limit 1')).i
);

console.log('\nCHIUSURA DI TURNO — l\'esempio di 02-MODELLO-DATI §4.2');
eq(
  'fondo cassa a 80,00',
  8000,
  (await uno("select (valore)::int v from impostazioni where chiave='fondo_cassa_cent'")).v
);
eq(
  'il primo turno comprende il primo pagamento',
  120,
  (await uno('select incassato_contanti_cent c from v_turno_corrente')).c
);

const chiusura = await uno(`insert into chiusure_turno
  (iniziato_il, fondo_cassa_cent, contato_cent, incassato_contanti_cent, incassato_carta_cent, chiuso_da, op_id)
  values (now() - interval '7 hours', 8000, 35500, 27650, 9600, '${utente.id}', gen_random_uuid())
  returning atteso_cent, differenza_cent, ritirato_cent`);
eq('atteso nel cassetto 356,50', 35650, chiusura.atteso_cent);
eq('differenza −1,50', -150, chiusura.differenza_cent);
eq('da ritirare 275,00', 27500, chiusura.ritirato_cent);

await deveFallire(
  'una chiusura non si modifica',
  'update chiusure_turno set contato_cent = 99999',
  'non si modifica'
);

console.log('\nANNULLARE UNA CHIUSURA');
const collega = await uno("insert into auth.users (email) values ('collega@bar.it') returning id");
await db.exec(`select set_config('test.uid', '${collega.id}', false)`);
await deveFallire(
  'un collega non annulla la chiusura di un altro',
  'delete from chiusure_turno',
  'solo una chiusura fatta da te'
);

await db.exec(`select set_config('test.uid', '${utente.id}', false)`);
await db.exec(`insert into chiusure_turno (iniziato_il, fondo_cassa_cent, contato_cent,
  incassato_contanti_cent, chiuso_da, op_id)
  values (now() - interval '1 hour', 8000, 8000, 0, '${utente.id}', gen_random_uuid())`);
await deveFallire(
  'non si annulla se ne è già stata fatta una più recente',
  'delete from chiusure_turno where contato_cent = 35500',
  'più recente'
);

console.log('\nLA GIORNATA È LA SOMMA DEI TURNI');
const giornata = await uno('select * from v_riepilogo_giornata');
eq('due turni', 2, giornata.n_turni);
eq('incassato in contanti', 27650, giornata.incassato_contanti_cent);
eq('differenza della giornata', -150, giornata.differenza_cent);

console.log(`\n${passati} verificati, ${falliti} falliti\n`);
process.exit(falliti ? 1 : 0);
