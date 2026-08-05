'use client';

import type { Bozza } from '@/lib/dominio/bozza';
import { dbLocale } from './db';

/**
 * Deposito delle bozze su IndexedDB (DEC-08).
 *
 * Le regole su cosa si può fare a una bozza stanno in `lib/dominio/bozza.ts`.
 * Qui si legge e si scrive, niente altro.
 */

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
    return await db.getAllFromIndex('bozze', 'per-apertura');
  } catch {
    return [];
  }
}

export async function leggiBozza(id: string): Promise<Bozza | null> {
  try {
    const db = await dbLocale();
    return (await db.get('bozze', id)) ?? null;
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
