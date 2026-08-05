'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { VoceCoda } from '@/lib/dominio/coda';
import type { Bozza } from '@/lib/dominio/bozza';

/**
 * Il database locale sul dispositivo.
 *
 * Tre depositi:
 *  - `cache`  → copia dei dati letti dal server, per leggere senza rete
 *  - `coda`   → operazioni da inviare, che devono sopravvivere alla chiusura
 *               del browser: un caffè segnato alle 7 deve arrivare anche se
 *               il telefono si spegne prima che torni la linea
 *  - `bozze`  → i conti che stai componendo, non ancora confermati (DEC-08).
 *               Sopravvivono a telefono spento e schermo bloccato: è tutto il
 *               motivo per cui stanno qui invece che in memoria
 *
 * Il numero di versione va alzato ogni volta che cambia la struttura:
 * `upgrade` viene eseguito solo quando il numero cresce.
 */
const VERSIONE = 2;
const NOME = 'gestionale-bar';

export interface SchemaLocale extends DBSchema {
  cache: {
    key: string;
    value: { chiave: string; contenuto: unknown; salvatoIl: number };
  };
  coda: {
    key: string;
    value: VoceCoda;
    indexes: { 'per-data': number };
  };
  bozze: {
    key: string;
    value: Bozza;
    indexes: { 'per-apertura': number };
  };
}

let apertura: Promise<IDBPDatabase<SchemaLocale>> | null = null;

export function dbLocale() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB non disponibile: questo codice gira solo nel browser.');
  }

  apertura ??= openDB<SchemaLocale>(NOME, VERSIONE, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'chiave' });
      }
      if (!db.objectStoreNames.contains('coda')) {
        const coda = db.createObjectStore('coda', { keyPath: 'opId' });
        // L'ordine di invio è quello di creazione (03-ARCHITETTURA.md §4.4)
        coda.createIndex('per-data', 'creataIl');
      }
      if (!db.objectStoreNames.contains('bozze')) {
        const bozze = db.createObjectStore('bozze', { keyPath: 'id' });
        bozze.createIndex('per-apertura', 'apertaIl');
      }
    },
  });

  return apertura;
}
