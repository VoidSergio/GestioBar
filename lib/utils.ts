import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Unisce classi Tailwind risolvendo i conflitti. */
export function cn(...classi: ClassValue[]) {
  return twMerge(clsx(classi));
}

/** Identificativo per righe e operazioni, generato sul dispositivo (vedi 02-MODELLO-DATI.md §2). */
export function nuovoId(): string {
  return crypto.randomUUID();
}

/**
 * Tempo trascorso in forma breve: "adesso", "12 min fa", "1 h fa", "3 g fa".
 * Dietro al banco serve il tempo relativo, non l'orario.
 */
export function tempoTrascorso(data: string | Date, adesso: Date = new Date()): string {
  const quando = typeof data === 'string' ? new Date(data) : data;
  const secondi = Math.floor((adesso.getTime() - quando.getTime()) / 1000);

  if (secondi < 60) return 'adesso';

  const minuti = Math.floor(secondi / 60);
  if (minuti < 60) return `${minuti} min fa`;

  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} h fa`;

  const giorni = Math.floor(ore / 24);
  return giorni === 1 ? 'ieri' : `${giorni} g fa`;
}
