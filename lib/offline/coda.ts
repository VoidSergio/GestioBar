'use client';

import type { Operazione, VoceCoda } from '@/lib/dominio/coda';
import { dbLocale } from './db';

/**
 * La coda delle scritture, su IndexedDB.
 *
 * Qui c'è solo il deposito: leggere, scrivere, cancellare. Le regole su
 * ordine, ritentativi e dipendenze stanno in `lib/dominio/coda.ts`, dove
 * si possono provare senza database.
 */

type Ascoltatore = (voci: VoceCoda[]) => void;
const ascoltatori = new Set<Ascoltatore>();

async function avvisa() {
  const voci = await leggiCoda();
  for (const a of ascoltatori) a(voci);
}

/** Si registra per sapere quando la coda cambia. Restituisce come smettere. */
export function ascoltaCoda(a: Ascoltatore): () => void {
  ascoltatori.add(a);
  void leggiCoda().then(a);
  return () => ascoltatori.delete(a);
}

export async function leggiCoda(): Promise<VoceCoda[]> {
  try {
    const db = await dbLocale();
    // L'indice restituisce già in ordine di creazione
    return await db.getAllFromIndex('coda', 'per-data');
  } catch {
    return [];
  }
}

export async function accoda(opId: string, operazione: Operazione): Promise<VoceCoda> {
  const voce: VoceCoda = {
    opId,
    operazione,
    creataIl: Date.now(),
    tentativi: 0,
    riprovaDopo: 0,
    stato: 'in_attesa',
  };

  const db = await dbLocale();
  await db.put('coda', voce);
  await avvisa();
  return voce;
}

export async function aggiornaVoce(voce: VoceCoda): Promise<void> {
  const db = await dbLocale();
  await db.put('coda', voce);
  await avvisa();
}

export async function rimuoviVoce(opId: string): Promise<void> {
  const db = await dbLocale();
  await db.delete('coda', opId);
  await avvisa();
}

/**
 * Rimette in attesa un'operazione fallita.
 * È l'unico modo per far ripartire qualcosa che si era fermato: la decisione
 * è di una persona, non del sistema.
 */
export async function riprova(opId: string): Promise<void> {
  const db = await dbLocale();
  const voce = await db.get('coda', opId);
  if (!voce) return;
  await db.put('coda', { ...voce, stato: 'in_attesa', tentativi: 0, riprovaDopo: 0 });
  await avvisa();
}

/**
 * Scarta un'operazione fallita.
 * Serve quando l'errore non è recuperabile — per esempio un conto che nel
 * frattempo è stato chiuso da un altro dispositivo.
 */
export async function scarta(opId: string): Promise<void> {
  await rimuoviVoce(opId);
}
