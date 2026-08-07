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

const VERSIONE = 'bar-v1';
const GUSCIO = `guscio-${VERSIONE}`;
const RISORSE = `risorse-${VERSIONE}`;

/** La pagina da mostrare se non c'è né rete né una copia della schermata. */
const OFFLINE = '/offline';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(GUSCIO)
      .then((cache) => cache.addAll([OFFLINE, '/manifest.json']))
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

  try {
    const risposta = await fetch(richiesta);

    // Si conserva solo una schermata vera.
    //
    // `redirected` è il controllo che conta: le pagine riservate rimandano a
    // /login quando la sessione è scaduta, e quella risposta arriva qui con
    // l'indirizzo di partenza. Metterla in cache vorrebbe dire mandare al
    // login anche chi è già entrato — e per giunta `cache.put` su una
    // risposta reindirizzata solleva un errore in alcuni browser.
    if (risposta.ok && risposta.type === 'basic' && !risposta.redirected) {
      cache.put(richiesta, risposta.clone());
    }
    return risposta;
  } catch {
    const copia = await cache.match(richiesta);
    if (copia) return copia;

    const ripiego = await cache.match(OFFLINE);
    if (ripiego) return ripiego;

    throw new Error('Nessuna copia disponibile.');
  }
}
