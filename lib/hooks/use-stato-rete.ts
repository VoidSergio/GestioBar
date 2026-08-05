'use client';

import { useEffect, useState } from 'react';

export type StatoRete = 'online' | 'offline';

/**
 * Dice se il dispositivo è raggiungibile dalla rete.
 *
 * Usa `navigator.onLine` più gli eventi `online`/`offline`, che il browser
 * emette entro poche decine di millisecondi dal cambiamento.
 *
 * LIMITE NOTO: `navigator.onLine` dice solo se esiste un'interfaccia di rete
 * attiva, non se internet funziona davvero. Attaccato al wifi del bar con il
 * modem staccato, il browser continua a dirsi "online".
 *
 * Per l'indicatore va bene: il caso vero è il telefono che esce dalla portata
 * del wifi, e lì l'evento arriva. Il caso "wifi c'è ma internet no" viene
 * scoperto dalla coda di scrittura (T-09), che vede fallire l'invio e ritenta.
 * Aggiungere qui un battito periodico verso Supabase costerebbe una richiesta
 * ogni pochi secondi per tutta la giornata: non vale il guadagno.
 */
export function useStatoRete(): StatoRete {
  // Si parte da 'online': durante il rendering sul server `navigator` non
  // esiste, e mostrare "senza rete" per un istante a ogni caricamento sarebbe
  // un falso allarme.
  const [stato, setStato] = useState<StatoRete>('online');

  useEffect(() => {
    const aggiorna = () => setStato(navigator.onLine ? 'online' : 'offline');

    aggiorna();
    window.addEventListener('online', aggiorna);
    window.addEventListener('offline', aggiorna);

    return () => {
      window.removeEventListener('online', aggiorna);
      window.removeEventListener('offline', aggiorna);
    };
  }, []);

  return stato;
}
