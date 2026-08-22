import type { NextRequest } from 'next/server';
import { aggiornaSessione } from '@/lib/supabase/sessione';
import { MATCHER_PROXY } from '@/lib/dominio/rotte';

/**
 * Gira prima di ogni richiesta.
 * In Next 16 questo file si chiama `proxy.ts`: `middleware.ts` è deprecato.
 */
export default async function proxy(request: NextRequest) {
  return aggiornaSessione(request);
}

export const config = {
  /*
   * Il filtro vive in `lib/dominio/rotte.ts`, con i test.
   *
   * Stava qui, ed era un'espressione regolare in fondo a un file di
   * configurazione: il posto dove nessuno la guarda e niente la verifica. Ci
   * mancavano `sw.js` e `offline`, e quella dimenticanza faceva comparire ogni
   * tanto la pagina di errore del browser — `09-DIARIO.md`, 12 agosto.
   */
  matcher: [MATCHER_PROXY],
};
