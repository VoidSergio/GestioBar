'use client';

import {
  classificaErrore,
  dopoErroreDiDati,
  dopoErroreDiRete,
  prossimaDaInviare,
} from '@/lib/dominio/coda';
import { aggiornaVoce, leggiCoda, rimuoviVoce } from './coda';
import { inviaOperazione } from './invio';

/**
 * Il motore che svuota la coda.
 *
 * Prende un'operazione alla volta, in ordine di creazione, e la manda.
 * Una alla volta e non tutte insieme: se il conto e la sua riga partissero
 * in parallelo, la riga potrebbe arrivare prima del conto e fallire per
 * chiave esterna mancante.
 *
 * Le decisioni — quale operazione, quanto aspettare, se ritentare — stanno
 * in `lib/dominio/coda.ts`. Qui c'è solo l'esecuzione.
 */

let inCorso = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let avviato = false;

/** Chiamata dopo ogni operazione riuscita: serve a rinfrescare le schermate. */
type AlCambiamento = () => void;
let alCambiamento: AlCambiamento = () => {};

async function passata(): Promise<void> {
  if (inCorso) return;
  inCorso = true;

  try {
    // Ciclo finché c'è qualcosa di pronto. Il limite evita che un errore
    // ripetuto trasformi il ciclo in un giro infinito nella stessa passata.
    for (let i = 0; i < 100; i += 1) {
      const voci = await leggiCoda();
      const voce = prossimaDaInviare(voci);
      if (!voce) break;

      await aggiornaVoce({ ...voce, stato: 'in_invio' });

      const esito = await inviaOperazione(voce.opId, voce.operazione);

      if (esito.ok) {
        await rimuoviVoce(voce.opId);
        alCambiamento();
        continue;
      }

      const genere = classificaErrore(esito.codice, esito.messaggio);

      if (genere === 'gia_registrato') {
        // Il primo invio era arrivato, si è persa la risposta.
        // È un successo, non un errore (CLAUDE.md).
        await rimuoviVoce(voce.opId);
        alCambiamento();
        continue;
      }

      if (genere === 'rete') {
        await aggiornaVoce(dopoErroreDiRete(voce, esito.messaggio));
        break; // inutile insistere adesso: si riprova al prossimo giro
      }

      await aggiornaVoce(dopoErroreDiDati(voce, esito.messaggio));
    }
  } finally {
    inCorso = false;
  }

  await programmaProssima();
}

async function programmaProssima(): Promise<void> {
  if (timer) clearTimeout(timer);

  const voci = await leggiCoda();
  const inAttesa = voci.filter((v) => v.stato === 'in_attesa');
  if (inAttesa.length === 0) return;

  const primoMomento = Math.min(...inAttesa.map((v) => v.riprovaDopo));
  const fraQuanto = Math.max(primoMomento - Date.now(), 500);

  timer = setTimeout(() => void passata(), fraQuanto);
}

/**
 * Accende il motore. Da chiamare una volta sola, all'avvio dell'app.
 *
 * Riparte anche quando la rete torna e quando l'app torna in primo piano:
 * il caso tipico è il telefono messo in tasca in una zona senza campo e
 * ritirato fuori al banco.
 */
export function avviaSync(quandoCambia: AlCambiamento = () => {}): () => void {
  alCambiamento = quandoCambia;

  if (avviato) return () => {};
  avviato = true;

  const svegliati = () => void passata();

  window.addEventListener('online', svegliati);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') svegliati();
  });

  void passata();

  return () => {
    window.removeEventListener('online', svegliati);
    if (timer) clearTimeout(timer);
    avviato = false;
  };
}

/** Forza un tentativo immediato, per esempio dopo che l'utente ha aggiunto una riga. */
export function sollecitaSync(): void {
  void passata();
}
