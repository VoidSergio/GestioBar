import type { Metadata } from 'next';
import { ProvaGriglia } from './prova-griglia';

export const metadata: Metadata = { title: 'Prova griglia — Gestionale Bar' };

/**
 * Schermata di prova per T-10.
 *
 * Serve a battere righe col pollice e cronometrare, prima che esistano
 * i conti veri. Le righe stanno solo in memoria: ricaricando spariscono,
 * niente tocca il database.
 *
 * Verrà eliminata quando arriverà il vero dettaglio conto (T-12).
 */
export default function PaginaProvaGriglia() {
  return <ProvaGriglia />;
}
