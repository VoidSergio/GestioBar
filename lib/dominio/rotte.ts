/**
 * Chi passa dal controllo di accesso e chi no.
 *
 * PERCHÉ QUESTE DUE RIGHE STANNO QUI E NON DENTRO `proxy.ts`.
 *
 * Il 12 agosto l'app ha cominciato a mostrare ogni tanto la pagina di errore
 * del browser. La causa erano due percorsi che passavano dal controllo di
 * accesso e non dovevano:
 *
 *   `/sw.js`    — da scollegati tornava un rimando a `/login`, cioè una pagina
 *                 HTML al posto di un file JavaScript. Il browser rifiutava di
 *                 registrare il service worker, e senza service worker ogni
 *                 singhiozzo della linea diventava un errore del browser.
 *
 *   `/offline`  — la pagina che deve comparire *quando il server non risponde*
 *                 stava dietro a un controllo che interroga il server. Il
 *                 service worker non riusciva a metterla in cache, e senza
 *                 quella l'ultima spiaggia era la pagina di errore del browser.
 *
 * Erano regole scritte dentro un'espressione regolare in fondo a un file di
 * configurazione, dove nessuno le guarda e niente le verifica. Qui hanno dei
 * test.
 */

/**
 * Raggiungibili senza aver fatto l'accesso.
 *
 * `/offline` non è una svista: è la pagina del "non c'è rete". Chiederle di
 * autenticarsi vorrebbe dire chiederle esattamente la cosa che in quel momento
 * non si può fare.
 */
export const ROTTE_PUBBLICHE = ['/login', '/offline'] as const;

export function rottaPubblica(percorso: string): boolean {
  return ROTTE_PUBBLICHE.some((p) => percorso.startsWith(p));
}

/**
 * Il filtro del proxy di Next: quali richieste **non** lo attraversano affatto.
 *
 * I file statici sono un'ottimizzazione — interrogare Supabase per ogni icona
 * caricata è lavoro buttato. `sw.js` e `offline` invece sono una correzione,
 * per il motivo scritto in cima a questo file.
 */
export const MATCHER_PROXY =
  '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline|icone/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)';

/**
 * Questo percorso attraversa il proxy?
 *
 * **È un'approssimazione, e va detto.** Next compila `MATCHER_PROXY` con la
 * sua sintassi dei percorsi, che non è esattamente un'espressione regolare di
 * JavaScript; qui la si prova come tale. Per la forma che usiamo — un solo
 * gruppo con una lista di esclusioni — le due cose coincidono, e vale la pena
 * perché permette di verificare con dei percorsi veri che `sw.js` e `offline`
 * restino fuori.
 */
export function passaDalProxy(percorso: string): boolean {
  return new RegExp(`^${MATCHER_PROXY}$`).test(percorso);
}
