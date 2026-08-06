'use client';

import type { Bozza } from '@/lib/dominio/bozza';
import { dbLocale } from './db';

/**
 * Deposito delle bozze su IndexedDB (DEC-08).
 *
 * Le regole su cosa si può fare a una bozza stanno in `lib/dominio/bozza.ts`.
 * Qui si legge e si scrive, niente altro.
 */

/**
 * Le bozze scritte prima dell'orario per riga non hanno `battutaIl`.
 * Si ricade sull'apertura del conto: sbagliato di qualche minuto, ma è un
 * orario plausibile invece di un buco o di un `Invalid Date`.
 */
function normalizza(b: Bozza): Bozza {
  if (b.voci.every((v) => typeof v.battutaIl === 'number')) return b;
  return {
    ...b,
    voci: b.voci.map((v) => ({
      ...v,
      battutaIl: typeof v.battutaIl === 'number' ? v.battutaIl : b.apertaIl,
    })),
  };
}

type Ascoltatore = (bozze: Bozza[]) => void;
const ascoltatori = new Set<Ascoltatore>();

async function avvisa() {
  const bozze = await leggiBozze();
  for (const a of ascoltatori) a(bozze);
}

export function ascoltaBozze(a: Ascoltatore): () => void {
  ascoltatori.add(a);
  void leggiBozze().then(a);
  return () => ascoltatori.delete(a);
}

export async function leggiBozze(): Promise<Bozza[]> {
  try {
    const db = await dbLocale();
    const bozze = await db.getAllFromIndex('bozze', 'per-apertura');
    return bozze.map(normalizza);
  } catch {
    return [];
  }
}

export async function leggiBozza(id: string): Promise<Bozza | null> {
  try {
    const db = await dbLocale();
    const bozza = await db.get('bozze', id);
    return bozza ? normalizza(bozza) : null;
  } catch {
    return null;
  }
}

export async function salvaBozza(bozza: Bozza): Promise<void> {
  const db = await dbLocale();
  await db.put('bozze', bozza);
  await avvisa();
}

export async function eliminaBozza(id: string): Promise<void> {
  const db = await dbLocale();
  await db.delete('bozze', id);
  await avvisa();
}

/** C'è già una bozza aperta per questo cliente? Serve a non aprirne due. */
export async function bozzaDelCliente(clienteId: string): Promise<Bozza | null> {
  const bozze = await leggiBozze();
  return bozze.find((b) => b.clienteId === clienteId) ?? null;
}
