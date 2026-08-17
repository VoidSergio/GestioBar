/**
 * Regole pure sui crediti e sull'estratto conto.
 * Niente React, niente Supabase (CLAUDE.md).
 */
import type { MovimentoEstrattoConto, SaldoCliente } from '@/lib/supabase/tipi';
import { formatEuro } from './denaro';

export interface MovimentoConSaldo extends MovimentoEstrattoConto {
  /** Quanto doveva il cliente subito dopo questo movimento. */
  saldoProgressivoCent: number;
}

export interface GiornoMovimenti {
  /** `2026-08-04`, usata come chiave */
  giorno: string;
  etichetta: string;
  movimenti: MovimentoConSaldo[];
}

/**
 * Calcola il saldo dopo ogni movimento e restituisce l'elenco dal più recente.
 *
 * PERCHÉ SI PARTE DAL SALDO ATTUALE E SI VA ALL'INDIETRO.
 *
 * L'istinto dice di sommare in avanti partendo da zero. Funziona solo se hai
 * in mano *tutti* i movimenti del cliente, e non è così: l'estratto conto è
 * paginato. Sommando in avanti dai movimenti caricati, il saldo mostrato in
 * cima è "la somma delle ultime N righe", che non è quello che deve il
 * cliente — e non coincide con il numero grande in testa alla schermata.
 * Due numeri diversi per la stessa cosa nella stessa schermata.
 *
 * Andando all'indietro dal saldo di `v_saldo_clienti`, la riga più recente
 * porta per costruzione il saldo vero, e ogni riga sotto dice quanto doveva
 * il cliente in quel momento. Il saldo resta una cosa sola, letta da un posto
 * solo (DEC-02).
 *
 * I pagamenti arrivano già con importo negativo dalla vista (02-MODELLO-DATI
 * §3.8), quindi la sottrazione funziona senza casi particolari.
 *
 * @param saldoAttualeCent quanto deve il cliente adesso, da `v_saldo_clienti`
 */
export function conSaldoProgressivo(
  movimenti: readonly MovimentoEstrattoConto[],
  saldoAttualeCent: number,
): MovimentoConSaldo[] {
  const dalPiuRecente = [...movimenti].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  let saldo = saldoAttualeCent;
  return dalPiuRecente.map((m) => {
    const conSaldo = { ...m, saldoProgressivoCent: saldo };
    // Tolto questo movimento, ecco quanto doveva prima: è il saldo della
    // riga successiva, che è quella immediatamente più vecchia.
    saldo -= m.importo_cent;
    return conSaldo;
  });
}

const FORMATO_GIORNO = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Oggi", "Ieri", oppure "venerdì 1 agosto". */
export function etichettaGiorno(data: Date, adesso: Date = new Date()): string {
  const g = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  if (g(data) === g(adesso)) return 'Oggi';

  const ieri = new Date(adesso);
  ieri.setDate(ieri.getDate() - 1);
  if (g(data) === g(ieri)) return 'Ieri';

  return FORMATO_GIORNO.format(data);
}

/** Chiave stabile per raggruppare, indipendente dal fuso di visualizzazione. */
function chiaveGiorno(data: Date): string {
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mese}-${giorno}`;
}

/**
 * Raggruppa i movimenti per giornata, dalla più recente.
 *
 * Un elenco di quaranta righe senza separatori è illeggibile; "Oggi" e "Ieri"
 * sono i due riferimenti che servono davvero quando si controlla un conto.
 */
export function raggruppaPerGiorno(
  movimenti: readonly MovimentoConSaldo[],
  adesso: Date = new Date(),
): GiornoMovimenti[] {
  const gruppi = new Map<string, GiornoMovimenti>();

  for (const m of movimenti) {
    const data = new Date(m.data);
    const chiave = chiaveGiorno(data);

    const esistente = gruppi.get(chiave);
    if (esistente) {
      esistente.movimenti.push(m);
    } else {
      gruppi.set(chiave, {
        giorno: chiave,
        etichetta: etichettaGiorno(data, adesso),
        movimenti: [m],
      });
    }
  }

  return [...gruppi.values()].sort((a, b) => b.giorno.localeCompare(a.giorno));
}

/**
 * L'ora di un movimento, `07:32`.
 *
 * Serve quando si guarda un giorno solo (T-27): lì la domanda non è più
 * "quanto deve" ma "che cosa ha preso, e quando" — il caffè delle sette e
 * quello delle undici raccontano due abitudini diverse, e in caso di
 * contestazione l'ora è l'unica cosa che decide.
 *
 * Ore e minuti locali, senza secondi: il secondo esatto non serve a nessuno
 * e allunga una colonna che sta in uno schermo stretto.
 */
export function oraDelMovimento(data: string): string {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Le due scorciatoie del pannello incasso.
 *
 * "Tutto" è il saldo intero; "solo l'ultimo conto" esiste soltanto se c'è
 * più di un conto in ballo — altrimenti sarebbe un pulsante che fa la stessa
 * cosa di quello accanto.
 */
export interface Scorciatoia {
  etichetta: string;
  importoCent: number;
}

export function scorciatoieIncasso(
  saldoCent: number,
  ultimoContoCent: number | null,
): Scorciatoia[] {
  const scorciatoie: Scorciatoia[] = [];

  if (ultimoContoCent !== null && ultimoContoCent > 0 && ultimoContoCent < saldoCent) {
    scorciatoie.push({
      etichetta: 'Solo ultimo conto',
      importoCent: ultimoContoCent,
    });
  }
  if (saldoCent > 0) {
    scorciatoie.push({ etichetta: 'Salda tutto', importoCent: saldoCent });
  }

  return scorciatoie;
}

/* ------------------------------------------- chiusura di un conto (T-13) */

export type EsitoChiusura =
  | { valido: false; errore: string }
  | {
      valido: true;
      /** conto corrente più debito precedente */
      dovutoCent: number;
      /** quanto si registra come pagamento: mai più del dovuto */
      importoCent: number;
      /** quanto va restituito al cliente, se ha dato di più */
      restoCent: number;
      /** quanto deve il cliente dopo questa chiusura */
      nuovoSaldoCent: number;
    };

/**
 * Verifica la chiusura di un conto pagato, in tutto o in parte.
 *
 * Differenza da `verificaIncasso`: lì si salda un debito già maturato, qui il
 * conto appena battuto **non è ancora registrato**. Il dovuto è quindi la
 * somma di due cose che l'utente deve vedere separate (04-UX-MOBILE §6): il
 * conto di adesso e quello che il cliente si trascinava dietro.
 *
 * Il di più non diventa acconto: diventa **resto da dare**. Tenere i soldi di
 * qualcuno senza dirlo non è un arrotondamento, è un ammanco.
 *
 * @param haCliente false per i conti "Banco", che non sono intestati a nessuno
 */
export function verificaChiusuraConto(dati: {
  totaleContoCent: number;
  debitoPrecedenteCent: number;
  importoDatoCent: number;
  haCliente: boolean;
}): EsitoChiusura {
  const { totaleContoCent, debitoPrecedenteCent, importoDatoCent, haCliente } = dati;

  if (!Number.isInteger(importoDatoCent)) {
    return {
      valido: false,
      errore: 'Importo non valido. Scrivi per esempio 12,50',
    };
  }
  if (totaleContoCent <= 0) {
    return { valido: false, errore: 'Il conto è vuoto.' };
  }
  if (importoDatoCent <= 0) {
    return { valido: false, errore: 'Inserisci quanto ti ha dato.' };
  }

  // Un acconto precedente abbassa il dovuto, ma non lo porta sotto il conto
  // di adesso a spese del cliente: se il saldo è negativo vale comunque.
  const dovutoCent = totaleContoCent + debitoPrecedenteCent;
  const importoCent = Math.min(importoDatoCent, dovutoCent);
  const restoCent = Math.max(0, importoDatoCent - dovutoCent);
  const nuovoSaldoCent = dovutoCent - importoCent;

  // Al banco non c'è nessuno a cui addebitare la differenza: il conto non è
  // intestato, quindi il debito non avrebbe un proprietario e sparirebbe.
  if (!haCliente && nuovoSaldoCent > 0) {
    return {
      valido: false,
      errore: 'Al banco non si può lasciare un debito. Intesta il conto a un cliente.',
    };
  }

  return { valido: true, dovutoCent, importoCent, restoCent, nuovoSaldoCent };
}

/**
 * Le scorciatoie del pannello di chiusura conto.
 * "Solo il conto" compare soltanto se c'è anche un debito precedente:
 * altrimenti farebbe la stessa cosa del pulsante accanto.
 */
export function scorciatoieChiusura(
  totaleContoCent: number,
  debitoPrecedenteCent: number,
): Scorciatoia[] {
  const dovuto = totaleContoCent + debitoPrecedenteCent;
  if (debitoPrecedenteCent <= 0 || dovuto <= totaleContoCent) {
    return [{ etichetta: 'Tutto', importoCent: totaleContoCent }];
  }

  return [
    { etichetta: 'Solo il conto', importoCent: totaleContoCent },
    { etichetta: 'Tutto', importoCent: dovuto },
  ];
}

export type EsitoIncasso =
  | { valido: false; errore: string }
  | {
      valido: true;
      importoCent: number;
      /** quanto resta da dare al cliente, se ha pagato più del dovuto */
      restoCent: number;
      /** quanto resterà a debito dopo questo incasso */
      residuoCent: number;
    };

/**
 * Verifica un incasso e calcola resto e residuo.
 *
 * Pagare più del dovuto non è un errore: capita quando il cliente dà un
 * biglietto tondo. Il di più diventa **resto da dare**, non un acconto —
 * trasformarlo in credito a favore senza dirlo sarebbe un modo silenzioso
 * di tenere i soldi di qualcuno.
 */
export function verificaIncasso(saldoCent: number, importoCent: number): EsitoIncasso {
  if (!Number.isInteger(importoCent)) {
    return { valido: false, errore: 'Importo non valido.' };
  }
  if (importoCent <= 0) {
    return { valido: false, errore: 'Inserisci quanto ti ha dato.' };
  }
  if (saldoCent <= 0) {
    return { valido: false, errore: 'Questo cliente non deve niente.' };
  }

  const eccedenza = Math.max(0, importoCent - saldoCent);

  return {
    valido: true,
    // Si registra solo quanto copre il debito: il resto torna in tasca al
    // cliente e non è un movimento del bar.
    importoCent: Math.min(importoCent, saldoCent),
    restoCent: eccedenza,
    residuoCent: Math.max(0, saldoCent - importoCent),
  };
}

/* --------------------------------------------- la schermata Crediti (T-15) */

/**
 * Il colore di una riga dell'elenco crediti.
 *
 * Dipende dall'**anzianità**, non dall'importo (04-UX-MOBILE §7). È una scelta
 * precisa: 5 € fermi da due mesi dicono che quel cliente non torna a pagare,
 * 80 € di ieri dicono soltanto che ieri ha bevuto molto. Il primo è un
 * problema, il secondo no.
 */
export type Anzianita = 'verde' | 'arancione' | 'rosso';

export const SOGLIA_ARANCIONE_GG = 15;
export const SOGLIA_ROSSO_GG = 45;

export function anzianitaDebito(giorniDebito: number | null): Anzianita {
  const giorni = giorniDebito ?? 0;
  if (giorni > SOGLIA_ROSSO_GG) return 'rosso';
  if (giorni > SOGLIA_ARANCIONE_GG) return 'arancione';
  return 'verde';
}

export type FiltroCrediti = 'tutti' | 'oltre30' | 'oltre60' | 'sopra_limite';

/** Solo chi deve davvero qualcosa: gli acconti e i pareggi non sono crediti. */
export function soloDebitori(clienti: readonly SaldoCliente[]): SaldoCliente[] {
  return clienti.filter((c) => c.saldo_cent > 0);
}

/**
 * Dal debito più vecchio al più recente.
 * A parità di giorni vince l'importo più alto: se due debiti hanno la stessa
 * età, conviene ricordarsi prima di quello che pesa.
 */
export function ordinaPerAnzianita(clienti: readonly SaldoCliente[]): SaldoCliente[] {
  return [...clienti].sort((a, b) => {
    const giorni = (b.giorni_debito ?? 0) - (a.giorni_debito ?? 0);
    return giorni !== 0 ? giorni : b.saldo_cent - a.saldo_cent;
  });
}

export function filtraCrediti(
  clienti: readonly SaldoCliente[],
  filtro: FiltroCrediti,
): SaldoCliente[] {
  switch (filtro) {
    case 'tutti':
      return [...clienti];
    case 'oltre30':
      return clienti.filter((c) => (c.giorni_debito ?? 0) > 30);
    case 'oltre60':
      return clienti.filter((c) => (c.giorni_debito ?? 0) > 60);
    case 'sopra_limite':
      // Senza limite impostato non si può stare sopra il limite.
      return clienti.filter(
        (c) => c.limite_credito_cent !== null && c.saldo_cent > c.limite_credito_cent,
      );
  }
}

/**
 * Quanto c'è da incassare in tutto.
 * Somma solo i saldi positivi: l'acconto di un cliente non riduce il credito
 * verso un altro, e sommarli algebricamente darebbe un totale più basso del
 * vero (DEC-02).
 */
export function totaleDaIncassare(clienti: readonly SaldoCliente[]): number {
  return clienti.reduce((somma, c) => somma + Math.max(c.saldo_cent, 0), 0);
}

/**
 * Il messaggio di sollecito, precompilato e da rileggere prima di mandarlo.
 *
 * Il tono conta più della funzione (CLAUDE.md, "Contesto sul dominio"): è un
 * promemoria fra persone che si conoscono, non un'azione di recupero crediti.
 * Niente scadenze, niente cifre in grassetto, niente "La invitiamo a".
 * Nessun invio è automatico: questa funzione prepara il testo, mandarlo è
 * sempre una decisione di una persona.
 */
export function messaggioSollecito(cliente: {
  nome: string;
  soprannome?: string | null;
  saldo_cent: number;
}): string {
  const come = cliente.soprannome?.trim() || cliente.nome.split(' ')[0] || cliente.nome;
  return `Ciao ${come}, quando passi il conto è di ${formatEuro(cliente.saldo_cent)}. Grazie!`;
}

/**
 * Il numero come lo vuole WhatsApp: solo cifre, prefisso incluso.
 * Restituisce null se il numero non è utilizzabile, così l'interfaccia può
 * nascondere il pulsante invece di aprire un'app su un numero rotto.
 */
export function numeroPerWhatsApp(telefono: string | null, prefisso = '39'): string | null {
  if (!telefono) return null;

  const cifre = telefono.replace(/\D/g, '');
  if (cifre.length < 6) return null;

  if (telefono.trim().startsWith('+')) return cifre;
  // Un numero italiano scritto senza prefisso: 347… diventa 39347…
  return cifre.startsWith(prefisso) ? cifre : `${prefisso}${cifre}`;
}
