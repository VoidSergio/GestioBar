/**
 * I report: periodi, somme e classifiche.
 *
 * Tutto quello che sta qui è puro. Le viste del database (0018) restituiscono
 * una riga per giornata, una per prodotto e giornata, una per cliente: mettere
 * insieme un periodo è aritmetica, e l'aritmetica sui soldi si tiene dove si
 * può testare senza montare React né una connessione.
 *
 * NIENTE DIVISIONI. Gli importi restano interi in centesimi dall'inizio alla
 * fine (DEC-04); le uniche medie che compaiono sono su conteggi di pezzi, e
 * anche quelle si arrotondano all'intero.
 */

import type { Giornata, OraDiPunta, RigaClassifica, VendutoProdotto } from '@/lib/supabase/tipi';

/* ------------------------------------------------------------ i periodi */

export type Periodo = 'oggi' | 'ieri' | 'settimana' | 'mese';

export const PERIODI: ReadonlyArray<{ valore: Periodo; etichetta: string }> = [
  { valore: 'oggi', etichetta: 'Oggi' },
  { valore: 'ieri', etichetta: 'Ieri' },
  { valore: 'settimana', etichetta: 'Settimana' },
  { valore: 'mese', etichetta: 'Mese' },
];

/**
 * Una giornata scritta come la legge il database: `2026-08-12`.
 *
 * Si costruisce dalle componenti locali e **non** da `toISOString()`, che
 * converte in UTC: alle due di notte del 12 agosto, ora italiana, quella
 * funzione scriverebbe `2026-08-11` e il report della giornata mostrerebbe
 * i numeri di ieri. È lo stesso motivo per cui le viste fissano il fuso a
 * `Europe/Rome` invece di ereditarlo dalla sessione.
 */
export function comeGiorno(d: Date): string {
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
}

export interface Intervallo {
  /** primo giorno compreso, `2026-08-12` */
  da: string;
  /** ultimo giorno compreso */
  a: string;
  etichetta: string;
}

/**
 * Da che giorno a che giorno.
 *
 * "Settimana" è **la settimana in corso da lunedì**, non gli ultimi sette
 * giorni: al banco "come sta andando la settimana" vuol dire quella, e un
 * totale che comprende mezzo lunedì scorso non si confronta con niente.
 * Stessa logica per il mese.
 */
export function intervallo(periodo: Periodo, adesso: Date = new Date()): Intervallo {
  const oggi = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());

  switch (periodo) {
    case 'oggi':
      return { da: comeGiorno(oggi), a: comeGiorno(oggi), etichetta: 'Oggi' };

    case 'ieri': {
      const ieri = new Date(oggi);
      ieri.setDate(ieri.getDate() - 1);
      return { da: comeGiorno(ieri), a: comeGiorno(ieri), etichetta: 'Ieri' };
    }

    case 'settimana': {
      // getDay(): 0 = domenica. La settimana comincia di lunedì.
      const scarto = (oggi.getDay() + 6) % 7;
      const lunedi = new Date(oggi);
      lunedi.setDate(lunedi.getDate() - scarto);
      return { da: comeGiorno(lunedi), a: comeGiorno(oggi), etichetta: 'Questa settimana' };
    }

    case 'mese': {
      const primo = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      return { da: comeGiorno(primo), a: comeGiorno(oggi), etichetta: 'Questo mese' };
    }
  }
}

/* --------------------------------------------------------- i soldi */

export interface TotaliPeriodo {
  vendutoCent: number;
  incassatoCent: number;
  contantiCent: number;
  cartaCent: number;
  altroCent: number;
  incassatoSuContiCent: number;
  creditoConcessoCent: number;
  creditoRientratoCent: number;
  /** Di quanto è cresciuto il credito in giro: concesso meno rientrato. */
  variazioneCreditoCent: number;
  pezzi: number;
  nConti: number;
  nScontrini: number;
  nSenzaScontrino: number;
  giorniConMovimenti: number;
}

export const TOTALI_VUOTI: TotaliPeriodo = {
  vendutoCent: 0,
  incassatoCent: 0,
  contantiCent: 0,
  cartaCent: 0,
  altroCent: 0,
  incassatoSuContiCent: 0,
  creditoConcessoCent: 0,
  creditoRientratoCent: 0,
  variazioneCreditoCent: 0,
  pezzi: 0,
  nConti: 0,
  nScontrini: 0,
  nSenzaScontrino: 0,
  giorniConMovimenti: 0,
};

/** Somma le giornate di un periodo. */
export function sommaGiornate(giornate: readonly Giornata[]): TotaliPeriodo {
  const t = { ...TOTALI_VUOTI };

  for (const g of giornate) {
    t.vendutoCent += g.venduto_cent;
    t.incassatoCent += g.incassato_cent;
    t.contantiCent += g.contanti_cent;
    t.cartaCent += g.carta_cent;
    t.altroCent += g.altro_cent;
    t.incassatoSuContiCent += g.incassato_su_conti_cent;
    t.creditoConcessoCent += g.credito_concesso_cent;
    t.creditoRientratoCent += g.credito_rientrato_cent;
    t.pezzi += g.pezzi;
    t.nConti += g.n_conti;
    t.nScontrini += g.n_scontrini;
    t.nSenzaScontrino += g.n_senza_scontrino;
    t.giorniConMovimenti += 1;
  }

  t.variazioneCreditoCent = t.creditoConcessoCent - t.creditoRientratoCent;
  return t;
}

/**
 * Come si legge la differenza fra quello che è uscito e quello che è entrato.
 *
 * È la frase che evita la telefonata delle undici di sera: una giornata da
 * 400 € di consumazioni con 250 € in cassa **non ha un ammanco**, ha 150 €
 * di credito concesso in più di quello rientrato.
 */
export function spiegaVariazioneCredito(variazioneCent: number): string {
  if (variazioneCent > 0) return 'il credito in giro è cresciuto';
  if (variazioneCent < 0) return 'il credito in giro è calato';
  return 'il credito in giro non si è mosso';
}

/* ----------------------------------------------------- che cosa esce */

export interface RigaVenduto {
  descrizione: string;
  quantita: number;
  importoCent: number;
}

/** Somma le vendite di più giornate per nome di prodotto, dalla più venduta. */
export function raggruppaVenduto(righe: readonly VendutoProdotto[]): RigaVenduto[] {
  const per = new Map<string, RigaVenduto>();

  for (const r of righe) {
    const suo = per.get(r.descrizione);
    if (suo) {
      suo.quantita += r.quantita;
      suo.importoCent += r.importo_cent;
    } else {
      per.set(r.descrizione, {
        descrizione: r.descrizione,
        quantita: r.quantita,
        importoCent: r.importo_cent,
      });
    }
  }

  return (
    [...per.values()]
      // Uno stornato del tutto arriva a zero: nell'elenco di quello che esce
      // non ci va, perché non è uscito.
      .filter((r) => r.quantita !== 0)
      .sort((a, b) => b.quantita - a.quantita || a.descrizione.localeCompare(b.descrizione, 'it'))
  );
}

/**
 * Il rovescio: quello che a catalogo c'è e non è uscito nel periodo.
 *
 * Occupa un riquadro nella griglia e allunga la ricerca a tutti. Il confronto
 * è sul nome completo, perché è quello che finisce sulla riga (DEC-05).
 */
export function prodottiFermi(
  aCatalogo: readonly string[],
  venduto: readonly RigaVenduto[],
): string[] {
  const usciti = new Set(venduto.map((v) => v.descrizione));
  return aCatalogo.filter((n) => !usciti.has(n)).sort((a, b) => a.localeCompare(b, 'it'));
}

/* ----------------------------------------------------- la classifica */

export type ChiaveClassifica = 'consumato_mese_cent' | 'consumato_sempre_cent';

/**
 * La classifica dei clienti, dal più alto, senza chi è a zero.
 *
 * Chi non ha consumato niente nel periodo non è ultimo: è **fuori**. Una
 * classifica con in fondo trenta nomi a 0,00 € non si legge, e soprattutto
 * fa sembrare che manchi qualcosa a chi la guarda.
 */
export function classifica(
  righe: readonly RigaClassifica[],
  chiave: ChiaveClassifica,
  quanti = 15,
): RigaClassifica[] {
  return [...righe]
    .filter((r) => r[chiave] > 0)
    .sort((a, b) => b[chiave] - a[chiave] || a.nome.localeCompare(b.nome, 'it'))
    .slice(0, quanti);
}

/**
 * Chi non si vede da un po'.
 *
 * È l'informazione che nessuno ha e che vale più di una classifica: le
 * classifiche mostrano chi c'è, non chi manca. Un cliente che veniva ogni
 * mattina e non passa da tre settimane è una domanda da farsi, non un numero
 * da guardare.
 *
 * Chi non è mai passato non conta: non è sparito, non è mai arrivato.
 */
export interface ClienteSparito {
  cliente: RigaClassifica;
  giorni: number;
}

export function clientiSpariti(
  righe: readonly RigaClassifica[],
  daGiorni = 21,
  adesso: Date = new Date(),
): ClienteSparito[] {
  const spariti: ClienteSparito[] = [];

  for (const r of righe) {
    if (!r.attivo || !r.ultima_consumazione_il) continue;

    const giorni = Math.floor(
      (adesso.getTime() - new Date(r.ultima_consumazione_il).getTime()) / 86_400_000,
    );
    if (giorni >= daGiorni) spariti.push({ cliente: r, giorni });
  }

  return spariti.sort((a, b) => b.giorni - a.giorni);
}

/* ------------------------------------------------------ ore di punta */

export const GIORNI_SETTIMANA = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;

export interface CellaOraria {
  giornoSettimana: number;
  ora: number;
  pezzi: number;
}

export interface GrigliaOraria {
  celle: CellaOraria[];
  /** La prima e l'ultima ora in cui succede qualcosa: fuori non si disegna. */
  primaOra: number;
  ultimaOra: number;
  /** Il massimo, per dare la scala al colore. */
  massimoPezzi: number;
  punta: CellaOraria | null;
}

/**
 * Prepara la griglia ore × giorni.
 *
 * Disegna solo le ore in cui il bar lavora davvero: un locale che apre alle
 * cinque e chiude alle nove di sera non ha bisogno di ventiquattro colonne,
 * e diciannove di quelle sarebbero vuote in ogni riga.
 */
export function grigliaOraria(righe: readonly OraDiPunta[]): GrigliaOraria {
  const celle = righe
    .filter((r) => r.pezzi > 0)
    .map((r) => ({ giornoSettimana: r.giorno_settimana, ora: r.ora, pezzi: r.pezzi }));

  if (celle.length === 0) {
    return { celle: [], primaOra: 7, ultimaOra: 20, massimoPezzi: 0, punta: null };
  }

  const ore = celle.map((c) => c.ora);
  let punta = celle[0]!;
  for (const c of celle) if (c.pezzi > punta.pezzi) punta = c;

  return {
    celle,
    primaOra: Math.min(...ore),
    ultimaOra: Math.max(...ore),
    massimoPezzi: punta.pezzi,
    punta,
  };
}

/** "giovedì alle 8" — l'ora di punta detta come la direbbe una persona. */
export function descriviPunta(punta: CellaOraria | null): string | null {
  if (!punta) return null;
  const giorni = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
  const nome = giorni[punta.giornoSettimana - 1];
  if (!nome) return null;
  return `${nome} verso le ${punta.ora}`;
}
