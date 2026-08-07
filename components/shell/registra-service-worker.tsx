'use client';

import { useEffect } from 'react';

/**
 * Accende il service worker (T-17).
 *
 * Solo in produzione: in sviluppo un service worker che mette in cache il
 * guscio fa impazzire il ricaricamento a caldo, e si finisce per passare
 * mezz'ora a cercare un bug che è solo una versione vecchia servita dalla
 * cache.
 *
 * Non mostra niente e non chiede niente. La richiesta di installazione la
 * fa il browser da solo quando decide che l'app se la merita: manifest
 * valido, service worker attivo, https. Aggiungere un banner "installami"
 * sarebbe la prima cosa che un barista chiude senza leggere.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Dopo il caricamento: registrarlo subito ruba banda alle richieste che
    // servono a mostrare la prima schermata.
    const registra = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Modalità privata, permessi negati, http: l'app funziona lo stesso,
        // perde solo l'avvio senza rete. Non c'è niente da dire all'utente.
      });
    };

    if (document.readyState === 'complete') {
      registra();
      return;
    }

    window.addEventListener('load', registra);
    return () => window.removeEventListener('load', registra);
  }, []);

  return null;
}
