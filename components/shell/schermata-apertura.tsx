'use client';

import { SchermataConto } from '@/components/conto/schermata-conto';
import { useBanco } from '@/lib/hooks/use-bozze';

/**
 * Quello che si vede aprendo l'app.
 *
 * PERCHÉ NON È PIÙ L'ELENCO DEI CONTI APERTI.
 *
 * Lo era, e stava scritto in 04-UX-MOBILE.md §3. Il conto dei tocchi tornava
 * — home, `+`, il cliente, il prodotto: tre tocchi prima di registrare, come
 * promesso. Quello che non tornava è che due di quei tre tocchi servivano
 * *prima* di poter cominciare, e li si pagava anche quando non c'era nessun
 * nome da mettere: il cliente che paga e se ne va, che è la maggior parte
 * della giornata.
 *
 * Adesso la griglia è la prima cosa. Il conto al banco è già aperto, il primo
 * tocco è il prodotto, e il nome si chiede solo quando serve — cioè quando il
 * conto resta a debito. Il concorrente è il foglio di carta, e sul foglio non
 * si scrive un nome prima di segnare un caffè.
 *
 * I conti aperti a nome di qualcuno non sono spariti: stanno nella striscia
 * in cima, dove si leggono di sfuggita e si aprono con un tocco. Il credito
 * in giro — il numero per cui esiste il progetto — è sulla scheda Crediti,
 * ed è scritto nella barra in basso: si legge appena accesa l'app, senza
 * occupare mezzo schermo tutto il giorno.
 *
 * Questo componente non fa altro che trovare quel conto (o crearlo la prima
 * volta) e passarlo alla schermata di composizione.
 */
export function SchermataApertura() {
  const { id, caricato } = useBanco();

  // Un istante, il tempo di leggere IndexedDB. Niente scritte: comparirebbero
  // e sparirebbero prima di poterle leggere.
  if (!caricato || !id) {
    return <div className="h-dvh" aria-busy="true" />;
  }

  return <SchermataConto id={id} eHome />;
}
