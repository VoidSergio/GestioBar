'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Il database locale sul dispositivo.
 *
 * Due depositi:
 *  - `cache`  → copia dei dati letti dal server, per far funzionare l'app senza rete
 *  - `coda`   → operazioni da inviare, riempita in T-09
 *
 * Il numero di versione va alzato ogni volta che cambia la struttura:
 * `upgrade` viene eseguito solo quando il numero cresce.
 */
const VERSIONE = 1;
const NOME = 'gestionale-bar';

export interface SchemaLocale extends DBSchema {
  cache: {
    key: string;
    value: { chiave: string; contenuto: unknown; salvatoIl: number };
  };
  coda: {
    key: string;
    value: { opId: string; creataIl: number; contenuto: unknown };
    indexes: { 'per-data': number };
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
    },
  });

  return apertura;
}
