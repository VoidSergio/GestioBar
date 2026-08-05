/**
 * Regole pure sui clienti. Niente React, niente Supabase (CLAUDE.md).
 */
import type { SaldoCliente } from '@/lib/supabase/tipi';

export interface DatiNuovoCliente {
  nome: string;
  soprannome?: string;
  telefono?: string;
}

export type EsitoValidazione =
  | { valido: true; dati: { nome: string; soprannome: string | null; telefono: string | null } }
  | { valido: false; errore: string };

/**
 * Valida e ripulisce i dati di un cliente nuovo.
 *
 * L'unico campo obbligatorio è il nome: dietro al banco si registra qualcuno
 * mentre sta ordinando, e chiedere il telefono in quel momento significa non
 * registrarlo affatto. Si completa dopo, dalla scheda.
 */
export function validaNuovoCliente(dati: DatiNuovoCliente): EsitoValidazione {
  const nome = dati.nome.trim().replace(/\s+/g, ' ');

  if (nome.length === 0) {
    return { valido: false, errore: 'Serve almeno il nome.' };
  }
  if (nome.length > 60) {
    return { valido: false, errore: 'Il nome è troppo lungo: massimo 60 caratteri.' };
  }

  const soprannome = dati.soprannome?.trim().replace(/\s+/g, ' ') ?? '';
  if (soprannome.length > 40) {
    return { valido: false, errore: 'Il soprannome è troppo lungo: massimo 40 caratteri.' };
  }

  const telefono = dati.telefono?.trim() ?? '';
  if (telefono && !/^[+\d][\d\s./-]{5,24}$/.test(telefono)) {
    return { valido: false, errore: 'Il numero di telefono non sembra valido.' };
  }

  return {
    valido: true,
    dati: {
      nome,
      soprannome: soprannome || null,
      telefono: telefono || null,
    },
  };
}

/**
 * Prepara un testo per il confronto: minuscolo e senza accenti.
 *
 * Serve perché in un bar italiano i nomi hanno gli accenti e nessuno li
 * digita mentre cerca. Chi scrive "nicolo" deve trovare "Nicolò".
 */
export function normalizzaPerRicerca(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra i clienti su nome e soprannome.
 *
 * Il confronto è sull'inizio di una parola, non ovunque: chi digita "ros"
 * vuole "Mario Rossi", non "Ambrosini". Cercare in mezzo alle parole
 * riempirebbe l'elenco di risultati che nessuno cerca.
 */
export function filtraClienti<T extends { nome: string; soprannome: string | null }>(
  clienti: readonly T[],
  ricerca: string,
): T[] {
  const cercato = normalizzaPerRicerca(ricerca);
  if (!cercato) return [...clienti];

  return clienti.filter((c) => {
    const parole = normalizzaPerRicerca(`${c.nome} ${c.soprannome ?? ''}`).split(' ');
    return parole.some((p) => p.startsWith(cercato));
  });
}

/** Come si chiama il cliente a schermo: "Franco (Ciccio)" se ha un soprannome. */
export function etichettaCliente(c: { nome: string; soprannome: string | null }): string {
  return c.soprannome ? `${c.nome} (${c.soprannome})` : c.nome;
}

/**
 * Ordina l'elenco: prima chi deve soldi, dal debito più alto; poi gli altri
 * in ordine alfabetico.
 *
 * Il motivo è che questa schermata serve soprattutto a cercare qualcuno per
 * incassare. Chi è in pari lo si apre di rado.
 */
export function ordinaPerRilevanza(clienti: readonly SaldoCliente[]): SaldoCliente[] {
  return [...clienti].sort((a, b) => {
    const aDeve = a.saldo_cent > 0;
    const bDeve = b.saldo_cent > 0;
    if (aDeve !== bDeve) return aDeve ? -1 : 1;
    if (aDeve && bDeve) return b.saldo_cent - a.saldo_cent;
    return a.nome.localeCompare(b.nome, 'it');
  });
}
