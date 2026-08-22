/*
 * Service worker del Gestionale Bar (T-17).
 *
 * PERCHÉ SCRITTO A MANO. `next-pwa` farebbe questo e altro, ma sarebbe una
 * dipendenza non prevista in 03-ARCHITETTURA.md §1, e soprattutto genera un
 * service worker che nessuno legge. Un service worker sbagliato non dà
 * errore: continua a servire una versione vecchia dell'app finché qualcuno
 * non se ne accorge. Meglio ottanta righe che si possono leggere in un
 * minuto.
 *
 * CHE COSA FA, E SOPRATTUTTO CHE COSA NON FA.
 *
 * Non mette in cache nessun dato. I dati stanno già in IndexedDB, messi lì
 * da TanStack Query (lib/offline/cache-query.ts), e le scritture passano
 * dalla coda: se questo file provasse a occuparsene, ci sarebbero due
 * sistemi a decidere qual è la verità.
 *
 * Si occupa solo di **far partire l'app senza rete**: il guscio, gli script
 * e gli stili. Aperta la schermata, i numeri li rimette la cache di
 * IndexedDB.
 *
 * Le chiamate a Supabase non le tocca: sono di un'altra origine e vanno
 * lasciate fallire, perché è dal fallimento che la coda capisce di dover
 * ritentare.
 */

const VERSIONE = 'bar-v2';

/**
 * Quanto si aspetta la rete prima di servire la copia in memoria.
 *
 * PERCHÉ ESISTE. `fetch` non ha una scadenza: se la richiesta non fallisce ma
 * non arriva — il caso normale del wifi debole, attaccato ma senza banda — il
 * service worker resta appeso finché non si arrende il browser, e nel
 * frattempo l'utente guarda uno schermo bianco. Poi compare la pagina di
 * errore del browser, che non è nostra e non spiega niente.
 *
 * Tre secondi e mezzo perché sotto quella soglia una linea lenta ma viva fa
 * ancora in tempo, e sopra si comincia a pensare che l'app sia bloccata.
 */
const ATTESA_MASSIMA_MS = 3500;
const GUSCIO = `guscio-${VERSIONE}`;
const RISORSE = `risorse-${VERSIONE}`;

/** La pagina da mostrare se non c'è né rete né una copia della schermata. */
const OFFLINE = '/offline';

/**
 * L'installazione non fallisce mai.
 *
 * Prima era `cache.addAll([...])`, che è atomica: **se una sola richiesta va
 * storta, l'installazione fallisce e il service worker non entra mai in
 * servizio**. E ne bastava una — `/offline` passava dal controllo di accesso e
 * da scollegati tornava un rimando a `/login`, che il Cache API si rifiuta di
 * conservare. Risultato: nessun service worker, nessun avvio senza rete, e a
 * ogni singhiozzo della linea la pagina di errore del browser.
 *
 * Adesso ogni risorsa si mette in cache per conto suo e chi non ce la fa non
 * porta giù le altre. Peggio avere una pagina di ripiego mancante che non
 * avere il service worker.
 */
async function riempiGuscio() {
  const cache = await caches.open(GUSCIO);

  await Promise.all(
    [OFFLINE, '/manifest.json'].map(async (percorso) => {
      try {
        // `reload` salta la cache HTTP del browser: all'aggiornamento dell'app
        // si vuole la versione nuova, non quella che il browser si è tenuto.
        const risposta = await fetch(percorso, { cache: 'reload' });
        if (risposta.ok && !risposta.redirected) await cache.put(percorso, risposta);
      } catch {
        // Rete assente durante l'installazione: si riproverà al prossimo
        // aggiornamento del service worker.
      }
    }),
  );
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    riempiGuscio()
      // Il nuovo service worker entra in servizio subito invece di aspettare
      // che si chiudano tutte le schede. Su un telefono al banco la scheda
      // non si chiude mai, e un aggiornamento che arriva "un giorno" non è
      // un aggiornamento.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) =>
        Promise.all(
          chiavi
            .filter((c) => !c.endsWith(VERSIONE))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;

  // Solo le letture. Un POST messo in cache e rigiocato sarebbe un caffè
  // addebitato due volte.
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);

  // Altra origine = Supabase. Non si tocca: la coda ha bisogno di vedere
  // fallire la richiesta per sapere che deve ritentare.
  if (url.origin !== self.location.origin) return;

  // Gli asset di Next hanno l'impronta del contenuto nel nome: se l'indirizzo
  // è lo stesso, il contenuto è lo stesso. Si servono dalla cache senza
  // nemmeno chiedere alla rete.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icone/')) {
    evento.respondWith(dallaCachePoiRete(richiesta, RISORSE));
    return;
  }

  // Le schermate: prima la rete, così online si vede sempre l'ultima
  // versione e un deploy non resta invisibile. La copia serve solo quando la
  // rete non c'è.
  if (richiesta.mode === 'navigate') {
    evento.respondWith(dallaRetePoiCache(richiesta));
  }
});

async function dallaCachePoiRete(richiesta, nomeCache) {
  const cache = await caches.open(nomeCache);
  const copia = await cache.match(richiesta);
  if (copia) return copia;

  const risposta = await fetch(richiesta);
  if (risposta.ok) cache.put(richiesta, risposta.clone());
  return risposta;
}

async function dallaRetePoiCache(richiesta) {
  const cache = await caches.open(GUSCIO);
  const copia = await cache.match(richiesta);

  const dallaRete = (async () => {
    const risposta = await fetch(richiesta);

    // Si conserva solo una schermata vera.
    //
    // `redirected` è il controllo che conta: le pagine riservate rimandano a
    // /login quando la sessione è scaduta, e quella risposta arriva qui con
    // l'indirizzo di partenza. Metterla in cache vorrebbe dire mandare al
    // login anche chi è già entrato — e per giunta `cache.put` su una
    // risposta reindirizzata solleva un errore in alcuni browser.
    if (risposta.ok && risposta.type === 'basic' && !risposta.redirected) {
      await cache.put(richiesta, risposta.clone()).catch(() => {});
    }
    return risposta;
  })();

  // C'è già una copia di questa schermata: alla rete si danno pochi secondi,
  // poi si serve quella. Meglio una schermata di un minuto fa, subito, che
  // una nuova fra quaranta secondi — al banco quei quaranta secondi non ci
  // sono. La versione nuova arriva comunque: la richiesta continua per conto
  // suo e aggiorna la cache per la volta dopo.
  if (copia) {
    const scaduta = new Promise((risolvi) => setTimeout(() => risolvi(null), ATTESA_MASSIMA_MS));
    const prima = await Promise.race([dallaRete.catch(() => null), scaduta]);
    return prima ?? copia;
  }

  // Niente in memoria: qui la rete è l'unica strada, e si aspetta.
  try {
    return await dallaRete;
  } catch {
    const ripiego = await cache.match(OFFLINE);
    return ripiego ?? rispostaSenzaRete();
  }
}

/**
 * L'ultima spiaggia, in italiano.
 *
 * Prima qui c'era `throw`: una promessa rifiutata dentro `respondWith` fa
 * comparire **la pagina di errore del browser** — "impossibile connettersi",
 * un pulsante Ricarica e nient'altro. Non è nostra, non dice cosa fare, e
 * soprattutto non dice la cosa che conta: che i conti battuti sono al sicuro
 * sul telefono e partiranno da soli.
 */
function rispostaSenzaRete() {
  return new Response(
    `<!doctype html><html lang="it"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Senza rete</title>
     <style>
       body{margin:0;min-height:100dvh;display:flex;flex-direction:column;
            align-items:center;justify-content:center;gap:12px;padding:0 32px;
            text-align:center;background:#0f172a;color:#f1f5f9;
            font-family:system-ui,sans-serif}
       p{margin:0;max-width:30rem;line-height:1.5}
       .tenue{color:#94a3b8;font-size:.9rem}
       a{margin-top:16px;display:flex;align-items:center;height:56px;padding:0 32px;
         border-radius:12px;background:#22d3ee;color:#0f172a;font-weight:600;
         text-decoration:none}
     </style></head><body>
     <p style="font-size:3rem">📶</p>
     <p style="font-size:1.25rem;font-weight:700">Non riesco a raggiungere il server</p>
     <p class="tenue">I conti che stai battendo sono al sicuro sul telefono: partiranno da soli
     appena torna la linea.</p>
     <a href="/">Riprova</a>
     </body></html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
