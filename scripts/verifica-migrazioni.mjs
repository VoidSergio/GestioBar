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

/**
 * File sostituiti da altri: restano nel repository perché sono citati nei
 * documenti, ma non contengono più niente da eseguire.
 * `0006` → `0020_magazzino.sql`.
 */
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
//
// Per provare il divieto serve qualcuno che titolare non sia. Prima questa
// prova retrocedeva `utente` a barista e poi lo rimetteva a posto: da 0019
// non si puo' piu' — nessuno cambia il proprio ruolo, e l'ultimo titolare
// attivo non si retrocede. Il divieto e' giusto, quindi si cambia la prova:
// si registra un secondo utente, che nasce barista.
const aiuto = await uno("insert into auth.users (email) values ('aiuto@bar.it') returning id");
await db.exec(`select set_config('test.uid', '${aiuto.id}', false)`);
await deveFallire(
  'un barista non la tocca',
  'update pagamenti set scontrino_battuto = true',
  'Solo il titolare'
);
await db.exec(`select set_config('test.uid', '${utente.id}', false)`);
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


console.log("\nI REPORT (0018)");
// Una giornata inventata apposta, con dentro tutti i casi che si confondono:
// un conto pagato subito al banco, uno lasciato a credito, e un debito
// vecchio che rientra.
const anna = await uno("insert into clienti (nome) values ('Anna') returning id");

// 1. Banco: 2 caffè, pagati subito in contanti.
const banco = await uno(
  `insert into conti (op_id) values (gen_random_uuid()) returning id`
);
await db.exec(`insert into righe_conto (conto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${banco.id}', 'Caffè', 120, 2, gen_random_uuid())`);
await db.exec(`insert into pagamenti (conto_id, importo_cent, metodo, scontrino_battuto, op_id)
  values ('${banco.id}', 240, 'contanti', true, gen_random_uuid())`);

// 2. Anna: uno spritz da 5,00 lasciato a credito.
const contoAnna = await uno(
  `insert into conti (cliente_id, op_id) values ('${anna.id}', gen_random_uuid()) returning id`
);
await db.exec(`insert into righe_conto (conto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${contoAnna.id}', 'Spritz', 500, 1, gen_random_uuid())`);

// 3. Anna salda 3,00 di debito vecchio, con carta e senza conto collegato.
await db.exec(`insert into pagamenti (cliente_id, importo_cent, metodo, op_id)
  values ('${anna.id}', 300, 'carta', gen_random_uuid())`);

const oggi = await uno(
  "select * from v_giornata where giornata = (now() at time zone 'Europe/Rome')::date"
);

// Mario, più in alto, ha già un caffè da 1,20 e un pagamento da 1,20.
eq('venduto della giornata', 120 + 240 + 500, oggi.venduto_cent);
eq('incassato in contanti', 120 + 240, oggi.contanti_cent);
eq('incassato con carta', 300, oggi.carta_cent);
eq('credito rientrato: i pagamenti senza conto', 120 + 300, oggi.credito_rientrato_cent);
eq('incassato sui conti di oggi', 240, oggi.incassato_su_conti_cent);
eq('credito concesso: lo spritz di Anna e il caffè di Mario', 500 + 120, oggi.credito_concesso_cent);

// Le due identità che tengono in piedi tutta la vista.
eq(
  'incassato = sui conti + credito rientrato',
  oggi.incassato_cent,
  oggi.incassato_su_conti_cent + oggi.credito_rientrato_cent
);
eq(
  'venduto = sui conti + credito concesso',
  oggi.venduto_cent,
  oggi.incassato_su_conti_cent + oggi.credito_concesso_cent
);
// Due: quello del banco qui sopra e quello di Mario, che la prova sulla
// correzione della spunta ha lasciato battuto.
eq('gli scontrini battuti si contano', 2, oggi.n_scontrini);

console.log('\nGLI STORNI SI TOLGONO DA SOLI, SENZA FILTRI');
const rigaSpritz = await uno(
  `select id from righe_conto where descrizione = 'Spritz'`
);
await db.exec(`insert into righe_conto (conto_id, descrizione, prezzo_unitario_cent, quantita, storno_di, op_id)
  values ('${contoAnna.id}', 'Spritz', 500, -1, '${rigaSpritz.id}', gen_random_uuid())`);

const dopoStorno = await uno(
  "select * from v_giornata where giornata = (now() at time zone 'Europe/Rome')::date"
);
eq('lo spritz stornato esce dal venduto', 120 + 240, dopoStorno.venduto_cent);
eq(
  'e anche dal credito concesso',
  120,
  dopoStorno.credito_concesso_cent
);
eq(
  'lo Spritz sparisce da quello che esce, non resta a zero e nemmeno a uno',
  0,
  (await uno("select coalesce(sum(quantita), 0) q from v_venduto_prodotto where descrizione = 'Spritz'")).q
);

console.log('\nCHE COSA ESCE, E CHI CONSUMA');
eq(
  'tre caffè in tutto: due al banco e uno di Mario',
  3,
  (await uno("select sum(quantita) q from v_venduto_prodotto where descrizione = 'Caffè'")).q
);
eq(
  'il banco non ha un cliente e resta fuori dalla classifica',
  120,
  (await uno(`select consumato_sempre_cent c from v_classifica_clienti where nome = 'Mario'`)).c
);
eq(
  "Anna ha consumato zero: lo spritz è stato stornato",
  0,
  (await uno(`select consumato_sempre_cent c from v_classifica_clienti where nome = 'Anna'`)).c
);
eq(
  'ma ha pagato 3,00',
  300,
  (await uno(`select pagato_sempre_cent p from v_classifica_clienti where nome = 'Anna'`)).p
);
eq(
  'un cliente senza movimenti sta in classifica a zero, non manca',
  0,
  (await uno(`insert into clienti (nome) values ('Nuovo') returning id`)) &&
    (await uno(`select consumato_sempre_cent c from v_classifica_clienti where nome = 'Nuovo'`)).c
);
eq(
  'la somma della classifica coincide con il venduto ai clienti',
  (await uno(`select coalesce(sum(r.importo_cent), 0) v from righe_conto r
     join conti co on co.id = r.conto_id where co.cliente_id is not null`)).v,
  (await uno('select sum(consumato_sempre_cent) c from v_classifica_clienti')).c
);

console.log('\nA CHE ORA SI LAVORA');
eq(
  "le ore di punta contano gli stessi pezzi del venduto degli ultimi 90 giorni",
  (await uno("select sum(quantita) q from righe_conto where creato_il >= now() - interval '90 days'")).q,
  (await uno('select sum(pezzi) p from v_ore_di_punta')).p
);
eq(
  'il giorno della settimana è quello ISO: lunedì 1, domenica 7',
  (await uno("select extract(isodow from (now() at time zone 'Europe/Rome'))::int d")).d,
  (await uno('select min(giorno_settimana) g from v_ore_di_punta')).g
);


console.log("\nRUOLI (0019) — quello che si può provare senza Supabase");
// PGlite non ha la RLS di Supabase: le policy vanno provate sul progetto vero
// (06-SETUP-SUPABASE §5.2). I trigger invece girano qui, e sono loro che
// tengono i divieti che contano.

// `utente` è il primo registrato, quindi titolare; `collega` è barista.
eq(
  'il primo registrato è titolare',
  'titolare',
  (await uno(`select ruolo from profili where id = '${utente.id}'`)).ruolo
);
eq(
  'il secondo è barista',
  'barista',
  (await uno(`select ruolo from profili where id = '${collega.id}'`)).ruolo
);

await db.exec(`select set_config('test.uid', '${collega.id}', false)`);
await deveFallire(
  'un barista non si promuove da solo — era un buco aperto',
  `update profili set ruolo = 'titolare' where id = '${collega.id}'`,
  'solo il titolare'
);
// Su `aiuto`, che è barista: promuovere chi è già titolare non cambia
// niente, e un trigger che guarda il cambiamento non avrebbe motivo di
// scattare. Il divieto va provato dove il ruolo si muove davvero.
await deveFallire(
  'né promuove qualcun altro',
  `update profili set ruolo = 'titolare' where id = '${aiuto.id}'`,
  'solo il titolare'
);
await deveFallire(
  'né si disattiva un collega per conto suo',
  `update profili set attivo = false where id = '${utente.id}'`,
  'solo il titolare'
);

await db.exec(`select set_config('test.uid', '${utente.id}', false)`);
await deveFallire(
  'nemmeno il titolare cambia il proprio ruolo',
  `update profili set ruolo = 'barista' where id = '${utente.id}'`,
  'non si cambia da soli'
);
await deveFallire(
  "l'ultimo titolare attivo non si disattiva",
  `update profili set attivo = false where id = '${utente.id}'`,
  'almeno un titolare'
);

await db.exec(`update profili set ruolo = 'titolare' where id = '${collega.id}'`);
eq(
  'il titolare promuove un barista',
  'titolare',
  (await uno(`select ruolo from profili where id = '${collega.id}'`)).ruolo
);
await db.exec(`update profili set attivo = false where id = '${utente.id}'`);
eq(
  'con due titolari uno si può disattivare',
  false,
  (await uno(`select attivo from profili where id = '${utente.id}'`)).attivo
);
await db.exec(`update profili set attivo = true where id = '${utente.id}'`);
await db.exec(`update profili set ruolo = 'barista' where id = '${collega.id}'`);

await deveFallire(
  'un profilo non si cancella: si perderebbe chi ha battuto cosa',
  `delete from profili where id = '${collega.id}'`,
  'non si cancella'
);

console.log('\nCHI HA BATTUTO COSA (T-42)');
const contoFirmato = await uno(
  `insert into conti (op_id) values (gen_random_uuid()) returning id, creato_da`
);
eq('il conto porta la firma di chi lo apre', utente.id, contoFirmato.creato_da);

const rigaFirmata = await uno(`insert into righe_conto
  (conto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${contoFirmato.id}', 'Caffè', 120, 1, gen_random_uuid())
  returning creato_da`);
eq('e anche la riga', utente.id, rigaFirmata.creato_da);

const pagFirmato = await uno(`insert into pagamenti (conto_id, importo_cent, metodo, op_id)
  values ('${contoFirmato.id}', 120, 'contanti', gen_random_uuid()) returning creato_da`);
eq('e il pagamento', utente.id, pagFirmato.creato_da);

eq(
  "quello che il client manda esplicitamente non viene sovrascritto",
  collega.id,
  (await uno(`insert into pagamenti (conto_id, importo_cent, metodo, creato_da, op_id)
     values ('${contoFirmato.id}', 100, 'contanti', '${collega.id}', gen_random_uuid())
     returning creato_da`)).creato_da
);

eq(
  'il venduto di oggi risulta a nome di chi lo ha battuto',
  utente.id,
  (await uno(`select operatore_id from v_operatore_giornata
     where operatore_id = '${utente.id}'
       and giornata = (now() at time zone 'Europe/Rome')::date`)).operatore_id
);

console.log('\nI REPORT SONO PER IL TITOLARE');
await db.exec(`select set_config('test.uid', '${collega.id}', false)`);
eq('un barista non vede le giornate', 0, (await uno('select count(*) n from v_giornata')).n);
eq('né la classifica clienti', 0, (await uno('select count(*) n from v_classifica_clienti')).n);
eq('né che cosa esce', 0, (await uno('select count(*) n from v_venduto_prodotto')).n);
eq('né chi ha lavorato', 0, (await uno('select count(*) n from v_operatore_giornata')).n);

await db.exec(`select set_config('test.uid', '${utente.id}', false)`);
eq(
  'il titolare invece sì',
  true,
  (await uno('select count(*) > 0 n from v_giornata')).n
);


console.log("\nMAGAZZINO (0020)");
// Il titolare è `utente`. Torna lui perché le anagrafiche sono sue.
await db.exec(`select set_config('test.uid', '${utente.id}', false)`);

const fornitore = await uno(
  "insert into fornitori (nome) values ('Torrefazione') returning id"
);
const grani = await uno(`insert into articoli (nome, unita, scorta_minima_milli, fornitore_id)
  values ('Caffè in grani', 'kg', 2000, '${fornitore.id}') returning id`);
const latte = await uno(`insert into articoli (nome, unita, scorta_minima_milli)
  values ('Latte', 'l', 5000) returning id`);

eq(
  'un articolo nasce a zero, non manca dalle giacenze',
  0,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);
eq(
  'e si distingue "mai movimentato" da "finito"',
  true,
  (await uno(`select mai_movimentato m from v_giacenze where id = '${grani.id}'`)).m
);

console.log('\nCARICHI E SEGNI');
await db.exec(`insert into movimenti_magazzino (articolo_id, tipo, quantita_milli, costo_unitario_cent)
  values ('${grani.id}', 'carico', 5000, 1800)`);
eq(
  'il carico aumenta la giacenza della quantità esatta (T-32)',
  5000,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);

await deveFallire(
  'un carico negativo non si scrive: sparirebbe dentro una somma',
  `insert into movimenti_magazzino (articolo_id, tipo, quantita_milli)
     values ('${grani.id}', 'carico', -1000)`,
  'segno_coerente_col_tipo'
);
await deveFallire(
  'e nemmeno uno scarico positivo',
  `insert into movimenti_magazzino (articolo_id, tipo, quantita_milli)
     values ('${grani.id}', 'scarico', 1000)`,
  'segno_coerente_col_tipo'
);
await deveFallire(
  'un movimento non si modifica (DEC-03)',
  "update movimenti_magazzino set quantita_milli = 1",
  'non si modifica'
);
await deveFallire(
  'né si cancella',
  'delete from movimenti_magazzino',
  'non si modifica'
);

console.log('\nSOTTO SCORTA (T-35)');
await db.exec(`insert into movimenti_magazzino (articolo_id, tipo, quantita_milli, causale)
  values ('${grani.id}', 'scarico', -3500, 'prova')`);
eq(
  'giacenza 1,500 kg sotto una scorta minima di 2,000',
  true,
  (await uno(`select sotto_scorta s from v_giacenze where id = '${grani.id}'`)).s
);
eq(
  "l'articolo mai caricato resta fuori dal conteggio degli urgenti",
  true,
  (await uno(`select mai_movimentato m from v_giacenze where id = '${latte.id}'`)).m
);

console.log('\nSCARICO AUTOMATICO (T-33, T-34)');
const caffeProdotto = await uno(
  "select id from prodotti where nome_base = 'Caffè' and variante = 'normale'"
);
await db.exec(`insert into composizioni (prodotto_id, articolo_id, quantita_milli)
  values ('${caffeProdotto.id}', '${grani.id}', 7)`);

const contoMag = await uno(
  'insert into conti (op_id) values (gen_random_uuid()) returning id'
);
const primaSpento = (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g;
await db.exec(`insert into righe_conto (conto_id, prodotto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${contoMag.id}', '${caffeProdotto.id}', 'Caffè', 120, 2, gen_random_uuid())`);
eq(
  'da spento non tocca niente: è il valore di partenza',
  primaSpento,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);

await db.exec("update impostazioni set valore = 'si' where chiave = 'scarico_automatico'");
await db.exec(`insert into righe_conto (conto_id, prodotto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${contoMag.id}', '${caffeProdotto.id}', 'Caffè', 120, 2, gen_random_uuid())`);
eq(
  'due caffè scaricano 14 g di grani',
  primaSpento - 14,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);

const rigaDaStornare = await uno(`select id from righe_conto
  where prodotto_id = '${caffeProdotto.id}' order by creato_il desc limit 1`);
await db.exec(`insert into righe_conto (conto_id, prodotto_id, descrizione, prezzo_unitario_cent, quantita, storno_di, op_id)
  values ('${contoMag.id}', '${caffeProdotto.id}', 'Caffè', 120, -1, '${rigaDaStornare.id}', gen_random_uuid())`);
eq(
  'uno storno rimette dentro la merce, come rettifica e non come carico',
  primaSpento - 7,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);
eq(
  'e lo dice nella causale',
  true,
  (await uno(`select causale like 'Storno:%' c from movimenti_magazzino
     where tipo = 'rettifica' order by creato_il desc limit 1`)).c
);

console.log('\nIL MAGAZZINO NON PUÒ BLOCCARE LA CASSA');
// Una distinta base che punta a un articolo disattivato, o un vincolo che
// salta: la riga di conto deve entrare lo stesso.
await db.exec(`insert into composizioni (prodotto_id, articolo_id, quantita_milli)
  values ('${caffeProdotto.id}', '${latte.id}', 0 + 1)`);
await db.exec(`drop trigger trg_scarica_magazzino on righe_conto`);
await db.exec(`create or replace function scarica_magazzino() returns trigger
  language plpgsql security definer set search_path = '' as $$
  begin
    raise exception 'guasto finto';
  exception when others then return null;
  end; $$`);
await db.exec(`create trigger trg_scarica_magazzino after insert on righe_conto
  for each row execute function scarica_magazzino()`);

const prima = (await uno(`select count(*) n from righe_conto`)).n;
await db.exec(`insert into righe_conto (conto_id, prodotto_id, descrizione, prezzo_unitario_cent, quantita, op_id)
  values ('${contoMag.id}', '${caffeProdotto.id}', 'Caffè', 120, 1, gen_random_uuid())`);
eq(
  'con il magazzino guasto la vendita si registra lo stesso',
  Number(prima) + 1,
  (await uno('select count(*) n from righe_conto')).n
);

console.log('\nINVENTARIO (T-36)');
const giacenzaPrima = (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g;
// Contati 1,000 kg: la rettifica è la differenza, non il valore contato.
await db.exec(`insert into movimenti_magazzino (articolo_id, tipo, quantita_milli, causale)
  values ('${grani.id}', 'rettifica', ${1000 - Number(giacenzaPrima)}, 'Inventario')`);
eq(
  "dopo l'inventario la giacenza è quella contata",
  1000,
  (await uno(`select giacenza_milli g from v_giacenze where id = '${grani.id}'`)).g
);

console.log(`\n${passati} verificati, ${falliti} falliti\n`);
process.exit(falliti ? 1 : 0);
