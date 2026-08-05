'use client';

import { useEffect, useState } from 'react';
import { quanteFallite, quanteInAttesa, type VoceCoda } from '@/lib/dominio/coda';
import { ascoltaCoda } from '@/lib/offline/coda';

export interface StatoCoda {
  voci: VoceCoda[];
  inAttesa: number;
  fallite: number;
}

/** Stato della coda di scrittura, aggiornato a ogni cambiamento. */
export function useCoda(): StatoCoda {
  const [voci, setVoci] = useState<VoceCoda[]>([]);

  useEffect(() => ascoltaCoda(setVoci), []);

  return {
    voci,
    inAttesa: quanteInAttesa(voci),
    fallite: quanteFallite(voci),
  };
}
