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
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
  return [...clienti].sort(confrontoPerRilevanza);
}

/** Il confronto di `ordinaPerRilevanza`, riusato come spareggio altrove. */
function confrontoPerRilevanza(a: SaldoCliente, b: SaldoCliente): number {
  const aDeve = a.saldo_cent > 0;
  const bDeve = b.saldo_cent > 0;
  if (aDeve !== bDeve) return aDeve ? -1 : 1;
  if (aDeve && bDeve) return b.saldo_cent - a.saldo_cent;
  return a.nome.localeCompare(b.nome, 'it');
}

/**
 * Quanti conti ha aperto ciascun cliente, contati da un elenco di conti.
 *
 * Un `Record` e non una `Map` perché questo numero finisce nella cache su
 * IndexedDB, che passa da JSON: una Map si salverebbe come `{}` e la
 * frequenza sparirebbe a ogni riavvio, senza che niente lo segnali.
 */
export function contaConti(conti: readonly { cliente_id: string | null }[]): Record<string, number> {
  const conteggio: Record<string, number> = {};

  for (const c of conti) {
    if (!c.cliente_id) continue;
    conteggio[c.cliente_id] = (conteggio[c.cliente_id] ?? 0) + 1;
  }

  return conteggio;
}

/**
 * L'ordine del pannello "a chi?": prima chi viene più spesso.
 *
 * PERCHÉ NON È LO STESSO ORDINE DELL'ELENCO CLIENTI. Sono due domande
 * diverse. L'elenco serve a cercare qualcuno per incassare, e lì conta chi
 * deve di più. Qui invece si sta aprendo un conto, e conta chi è probabile
 * che sia la persona davanti: nel bar è quello che viene tutte le mattine,
 * non quello che deve di più. Con l'ordine sbagliato si finiva a digitare il
 * nome di uno che passa ogni giorno perché stava sotto a un debitore che si
 * vede una volta al mese.
 *
 * Chi non è passato nel periodo considerato non sparisce: scende sotto,
 * ordinato come nell'elenco clienti. È il caso del cliente nuovo, che ha
 * zero conti e va comunque trovato — ma dopo quelli veri.
 */
export function ordinaPerFrequenza<T extends SaldoCliente>(
  clienti: readonly T[],
  contiPerCliente: Readonly<Record<string, number>>,
): T[] {
  return [...clienti].sort((a, b) => {
    const quantiA = contiPerCliente[a.id] ?? 0;
    const quantiB = contiPerCliente[b.id] ?? 0;
    if (quantiA !== quantiB) return quantiB - quantiA;
    return confrontoPerRilevanza(a, b);
  });
}

/* ------------------------------------------- cancellare o disattivare */

export type Ruolo = 'titolare' | 'barista';

/**
 * Che cosa succede quando si chiede di togliere di mezzo un cliente.
 *
 * Non è la stessa cosa per tutti, ed è il punto: un cliente con dei
 * movimenti **non si cancella**. Cancellarlo vorrebbe dire buttare via la
 * storia dei suoi soldi, e in un bar quel numero non si ricostruisce a
 * memoria. Si disattiva: sparisce dagli elenchi, l'estratto conto resta.
 *
 * Un cliente senza nessun movimento invece non ha niente da perdere. È un
 * doppione, un nome scritto male, una prova: si cancella davvero, così
 * l'elenco resta pulito.
 *
 * Il database dice la stessa cosa per conto suo — `conti.cliente_id`
 * rifiuta la cancellazione di un cliente con conti — ma la decisione va
 * presa prima, per poterla spiegare all'utente invece di mostrargli un
 * errore di chiave esterna.
 */
export type AzioneRimozione =
  | { azione: 'cancella' }
  | { azione: 'disattiva'; motivo: string }
  | { azione: 'vietata'; motivo: string };

export function comeRimuovereCliente(dati: {
  ruolo: Ruolo | null;
  /** true se il cliente ha almeno una riga di conto o un pagamento */
  haMovimenti: boolean;
}): AzioneRimozione {
  if (dati.ruolo !== 'titolare') {
    return {
      azione: 'vietata',
      motivo: 'Solo il titolare può togliere un cliente dall’elenco.',
    };
  }

  if (dati.haMovimenti) {
    return {
      azione: 'disattiva',
      motivo:
        'Questo cliente ha dei movimenti registrati. Cancellarlo porterebbe via il suo estratto conto: sparisce dagli elenchi, ma la sua storia resta.',
    };
  }

  return { azione: 'cancella' };
}

/**
 * Un cliente ha lasciato tracce?
 *
 * Si guarda il totale addebitato e il totale pagato, non il saldo: un
 * cliente che ha consumato 50 € e ne ha pagati 50 ha saldo zero ma una
 * storia lunga, e cancellarlo la porterebbe via.
 */
export function haMovimenti(c: { addebitato_cent: number; pagato_cent: number }): boolean {
  return c.addebitato_cent !== 0 || c.pagato_cent !== 0;
}
