/**
 * Regole pure sugli scontrini battuti e non battuti.
 * Niente React, niente Supabase (CLAUDE.md).
 *
 * A che cosa serve questa schermata: a fine turno il barista deve sapere se
 * i soldi in cassa trovano riscontro nel registratore. Il sistema **non è un
 * registratore fiscale** (01-VISIONE §2): non emette scontrini, registra solo
 * se sono stati battuti, per poter quadrare.
 */
import type { MovimentoScontrino } from '@/lib/supabase/tipi';

/* ------------------------------------------------------ la giornata */

/**
 * L'intervallo di una giornata, in istanti assoluti.
 *
 * I confini sono quelli **locali** del dispositivo, non UTC: la giornata di
 * un bar comincia quando si alza la serranda, e in Italia mezzanotte locale
 * non coincide con mezzanotte UTC. Calcolarlo qui e passare due istanti alla
 * query tiene la vista SQL libera da qualunque logica di fuso orario.
 *
 * Il turno che sfora la mezzanotte finisce nel giorno dopo. È voluto: un
 * "giorno commerciale" che comincia alle 5 del mattino sarebbe più fedele al
 * bar, ma renderebbe i totali difficili da confrontare con lo scontrino di
 * chiusura del registratore, che segue il giorno civile.
 */
export function intervalloGiornata(giorno: Date): { inizio: string; fine: string } {
  const inizio = new Date(giorno);
  inizio.setHours(0, 0, 0, 0);

  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 1);

  return { inizio: inizio.toISOString(), fine: fine.toISOString() };
}

/** Il giorno prima e il giorno dopo, per le due frecce. */
export function giornoSpostato(giorno: Date, giorni: number): Date {
  const spostato = new Date(giorno);
  spostato.setDate(spostato.getDate() + giorni);
  spostato.setHours(0, 0, 0, 0);
  return spostato;
}

export function eOggi(giorno: Date, adesso: Date = new Date()): boolean {
  return (
    giorno.getFullYear() === adesso.getFullYear() &&
    giorno.getMonth() === adesso.getMonth() &&
    giorno.getDate() === adesso.getDate()
  );
}

/* ------------------------------------------------------ il riassunto */

export interface RiassuntoScontrini {
  /** soldi entrati con lo scontrino battuto */
  scontrinatoCent: number;
  /** soldi entrati senza scontrino: è quello che non quadra */
  nonScontrinatoCent: number;
  /** merce uscita a credito: non è un ammanco, è un credito */
  aCreditoCent: number;
  /** tutto quello che è entrato, battuto o no */
  incassatoCent: number;
  nScontrinati: number;
  nNonScontrinati: number;
  nACredito: number;
}

/**
 * I tre numeri della giornata.
 *
 * `nonScontrinatoCent` e `aCreditoCent` restano separati e **non si sommano
 * mai**: il primo è un problema di cassa, il secondo è un credito che si
 * incasserà. Metterli insieme darebbe un numero che non significa niente e
 * che, per giunta, conterebbe due volte lo stesso caffè il giorno in cui il
 * cliente salda.
 */
export function riassumiScontrini(movimenti: readonly MovimentoScontrino[]): RiassuntoScontrini {
  const r: RiassuntoScontrini = {
    scontrinatoCent: 0,
    nonScontrinatoCent: 0,
    aCreditoCent: 0,
    incassatoCent: 0,
    nScontrinati: 0,
    nNonScontrinati: 0,
    nACredito: 0,
  };

  for (const m of movimenti) {
    if (m.tipo === 'a_credito') {
      r.aCreditoCent += m.importo_cent;
      r.nACredito += 1;
      continue;
    }

    r.incassatoCent += m.importo_cent;

    if (m.scontrino_battuto) {
      r.scontrinatoCent += m.importo_cent;
      r.nScontrinati += 1;
    } else {
      r.nonScontrinatoCent += m.importo_cent;
      r.nNonScontrinati += 1;
    }
  }

  return r;
}

/* ------------------------------------------------------ i gruppi */

export type GruppoScontrini = 'scontrinato' | 'non_scontrinato' | 'a_credito';

export function gruppoDi(m: MovimentoScontrino): GruppoScontrini {
  if (m.tipo === 'a_credito') return 'a_credito';
  return m.scontrino_battuto ? 'scontrinato' : 'non_scontrinato';
}

/** I movimenti di un gruppo, dal più recente: l'ultimo battuto è in cima. */
export function filtraPerGruppo(
  movimenti: readonly MovimentoScontrino[],
  gruppo: GruppoScontrini,
): MovimentoScontrino[] {
  return movimenti
    .filter((m) => gruppoDi(m) === gruppo)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

/** Totale per metodo di pagamento, per confrontarlo col registratore. */
export function perMetodo(movimenti: readonly MovimentoScontrino[]): Map<string, number> {
  const totali = new Map<string, number>();

  for (const m of movimenti) {
    if (m.tipo !== 'incasso') continue;
    const metodo = m.metodo ?? 'altro';
    totali.set(metodo, (totali.get(metodo) ?? 0) + m.importo_cent);
  }

  return totali;
}

/** "Franco", "Banco" se il conto non era intestato a nessuno. */
export function chiHaPagato(m: MovimentoScontrino): string {
  if (!m.cliente_nome) return 'Banco';
  return m.cliente_soprannome ? `${m.cliente_nome} (${m.cliente_soprannome})` : m.cliente_nome;
}
