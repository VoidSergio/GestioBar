import type { NextRequest } from 'next/server';
import { aggiornaSessione } from '@/lib/supabase/sessione';

/**
 * Gira prima di ogni richiesta.
 * In Next 16 questo file si chiama `proxy.ts`: `middleware.ts` è deprecato.
 */
export default async function proxy(request: NextRequest) {
  return aggiornaSessione(request);
}

export const config = {
  matcher: [
    /*
     * Tutte le rotte tranne:
     * - file statici di Next (_next/static, _next/image)
     * - icone, manifest e immagini
     * Filtrarli evita di interrogare Supabase per ogni icona caricata.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icone/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
