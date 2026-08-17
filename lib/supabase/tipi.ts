/**
 * Tipi del database — Fase 1.
 *
 * NOTA: le righe sono `type`, non `interface`, e non è un vezzo.
 * In TypeScript un'interface non è assegnabile a `Record<string, unknown>`
 * (non ha una index signature implicita, perché potrebbe essere estesa dopo).
 * I tipi di supabase-js richiedono proprio quel vincolo: con le interface
 * l'inferenza collassa su `never` e ogni `select()` smette di essere tipizzato,
 * senza che nulla lo segnali finché non provi a leggere un campo.
 *
 * Scritti a mano seguendo docs/02-MODELLO-DATI.md §3.
 * Una volta creato il progetto Supabase si possono rigenerare automaticamente:
 *
 *   npx supabase gen types typescript --project-id IL_TUO_ID > lib/supabase/tipi.ts
 *
 * Finché non lo fai, questi tipi sono la fonte di verità per l'editor.
 *
 * Convenzione: i campi che finiscono con `_cent` sono INTERI in centesimi (DEC-04).
 */

export type Ruolo = 'titolare' | 'barista';
export type StatoConto = 'aperto' | 'chiuso';
export type MetodoPagamento = 'contanti' | 'carta' | 'bonifico' | 'altro';

export type Profilo = {
  id: string;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
  creato_il: string;
  aggiornato_il: string;
};

export type Cliente = {
  id: string;
  nome: string;
  soprannome: string | null;
  telefono: string | null;
  limite_credito_cent: number | null;
  note: string | null;
  attivo: boolean;
  anonimizzato: boolean;
  creato_il: string;
  creato_da: string | null;
  aggiornato_il: string;
};

export type Categoria = {
  id: string;
  nome: string;
  colore: string;
  ordine: number;
  attiva: boolean;
  creato_il: string;
};

export type Prodotto = {
  id: string;
  categoria_id: string | null;
  nome_base: string;
  variante: string;
  /** colonna calcolata dal database: nome_base + variante */
  nome: string;
  prezzo_cent: number;
  ordine: number;
  preferito: boolean;
  attivo: boolean;
  creato_il: string;
  aggiornato_il: string;
};

export type Conto = {
  id: string;
  numero: number;
  cliente_id: string | null;
  stato: StatoConto;
  tavolo: string | null;
  note: string | null;
  aperto_il: string;
  chiuso_il: string | null;
  creato_da: string | null;
  op_id: string;
};

export type RigaConto = {
  id: string;
  conto_id: string;
  prodotto_id: string | null;
  /** copiato dal prodotto al momento dell'inserimento (DEC-05) */
  descrizione: string;
  /** copiato dal prodotto al momento dell'inserimento (DEC-05) */
  prezzo_unitario_cent: number;
  /** negativa negli storni */
  quantita: number;
  /** colonna calcolata: quantita * prezzo_unitario_cent */
  importo_cent: number;
  storno_di: string | null;
  creato_il: string;
  creato_da: string | null;
  op_id: string;
};

export type Pagamento = {
  id: string;
  cliente_id: string | null;
  /** null = acconto generico, non riferito a un conto specifico */
  conto_id: string | null;
  importo_cent: number;
  metodo: MetodoPagamento;
  scontrino_battuto: boolean;
  note: string | null;
  storno_di: string | null;
  creato_il: string;
  creato_da: string | null;
  op_id: string;
};

/* ---------------------------------------------------------------- viste */

export type SaldoCliente = {
  id: string;
  nome: string;
  soprannome: string | null;
  telefono: string | null;
  limite_credito_cent: number | null;
  attivo: boolean;
  addebitato_cent: number;
  pagato_cent: number;
  /** positivo = deve soldi; negativo = ha un acconto */
  saldo_cent: number;
  primo_movimento_il: string | null;
  ultimo_pagamento_il: string | null;
  ultimo_movimento_il: string | null;
  /** giorni dall'ultimo pagamento; null se il cliente è in pari */
  giorni_debito: number | null;
};

export type ContoAperto = {
  id: string;
  numero: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_soprannome: string | null;
  tavolo: string | null;
  aperto_il: string;
  totale_cent: number;
  n_righe: number;
};

export type MovimentoEstrattoConto = {
  cliente_id: string;
  data: string;
  tipo: 'consumazione' | 'pagamento';
  descrizione: string;
  quantita: number;
  /** i pagamenti compaiono negativi, come in un estratto conto bancario */
  importo_cent: number;
  conto_numero: number | null;
  movimento_id: string;
  e_storno: boolean;
  /** su che conto sta la riga: serve per spostarla altrove */
  conto_id: string | null;
  /** zero sui pagamenti */
  prezzo_unitario_cent: number;
  /** quanti pezzi di questa riga sono già stati stornati o offerti ad altri */
  quantita_stornata: number;
};

/**
 * Una riga della vista scontrini. `tipo` distingue due cose che non vanno
 * sommate: i soldi entrati e la merce uscita a credito.
 */
export type MovimentoScontrino = {
  movimento_id: string;
  tipo: 'incasso' | 'a_credito';
  data: string;
  importo_cent: number;
  scontrino_battuto: boolean;
  /** null sulle righe a credito: non c'è stato nessun pagamento */
  metodo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_soprannome: string | null;
  conto_numero: number | null;
};

export type VarianteProdotto = {
  id: string;
  variante: string;
  prezzo_cent: number;
};

export type RiquadroGriglia = {
  nome_base: string;
  categoria: string | null;
  categoria_colore: string | null;
  categoria_ordine: number | null;
  ordine: number;
  preferito: boolean;
  /** prezzo della variante più economica: è quello mostrato sul riquadro */
  prezzo_da_cent: number;
  ha_varianti: boolean;
  /** ordinate per prezzo crescente */
  varianti: VarianteProdotto[];
};

/* ------------------------------------------------------------- cassa */

export type Impostazione = {
  chiave: string;
  valore: string;
  descrizione: string | null;
  aggiornato_il: string;
};

/**
 * Una chiusura di turno (0016_cassa_turni.sql).
 *
 * Gli importi sono memorizzati e non ricalcolati, contro l'abitudine di
 * DEC-02: non è un saldo, è la dichiarazione di una persona su quanto c'era
 * nel cassetto a un certo minuto. Il perché sta in 02-MODELLO-DATI §4.1.
 */
export type ChiusuraTurno = {
  id: string;
  iniziato_il: string;
  chiuso_il: string;
  fondo_cassa_cent: number;
  contato_cent: number;
  incassato_contanti_cent: number;
  incassato_carta_cent: number;
  incassato_altro_cent: number;
  variazione_credito_cent: number;
  /** calcolate dal database: fondo + contanti, contato − atteso, contato − fondo */
  atteso_cent: number;
  differenza_cent: number;
  ritirato_cent: number;
  causale: string | null;
  chiuso_da: string;
  op_id: string;
};

/** Il turno aperto adesso: quello che la schermata mostra prima del conteggio. */
export type TurnoCorrente = {
  iniziato_il: string;
  fondo_cassa_cent: number;
  incassato_contanti_cent: number;
  incassato_carta_cent: number;
  incassato_altro_cent: number;
  /** consumato a credito meno vecchi debiti rientrati */
  variazione_credito_cent: number;
  n_pagamenti: number;
};

export type RiepilogoGiornata = {
  giornata: string;
  n_turni: number;
  dalle: string;
  alle: string;
  incassato_contanti_cent: number;
  incassato_carta_cent: number;
  incassato_altro_cent: number;
  variazione_credito_cent: number;
  ritirato_cent: number;
  differenza_cent: number;
};

/* ------------------------------------------------------------ i report */

/**
 * Una giornata di calendario, letta dai movimenti (0018).
 *
 * I quattro numeri non si sommano fra loro. Le identità che li legano, e che
 * i controlli di `npm run verifica:migrazioni` verificano:
 *
 *   incassato = incassato_su_conti + credito_rientrato
 *   venduto   = incassato_su_conti + credito_concesso
 *
 * Quindi `venduto − incassato` non è un ammanco: è di quanto è cresciuto il
 * credito in giro.
 *
 * Va tenuta distinta da `RiepilogoGiornata`, che somma le **chiusure di
 * turno** — cioè quanto è stato dichiarato contando il cassetto. Questa
 * legge i movimenti, e il turno può scavalcare la mezzanotte.
 */
export type Giornata = {
  giornata: string;
  venduto_cent: number;
  pezzi: number;
  n_conti: number;
  incassato_cent: number;
  contanti_cent: number;
  carta_cent: number;
  altro_cent: number;
  incassato_su_conti_cent: number;
  credito_rientrato_cent: number;
  credito_concesso_cent: number;
  n_scontrini: number;
  n_senza_scontrino: number;
};

/**
 * Che cosa è uscito, per giornata e per nome.
 *
 * Il nome è quello congelato sulla riga (DEC-05): se un prodotto viene
 * rinominato, le vendite vecchie restano sotto il nome vecchio. È voluto —
 * l'alternativa sarebbe attribuire metà delle vendite a un nome che allora
 * non esisteva.
 */
export type VendutoProdotto = {
  giornata: string;
  descrizione: string;
  quantita: number;
  importo_cent: number;
};

/**
 * La classifica dei clienti (T-25).
 *
 * **Il banco non c'è, per costruzione**: i conti anonimi non hanno cliente.
 * Risponde a "chi fra i clienti che conosco consuma di più", non a "da dove
 * vengono i miei soldi".
 */
export type RigaClassifica = {
  cliente_id: string;
  nome: string;
  soprannome: string | null;
  attivo: boolean;
  consumato_mese_cent: number;
  consumato_sempre_cent: number;
  pezzi_sempre: number;
  pagato_mese_cent: number;
  pagato_sempre_cent: number;
  ultima_consumazione_il: string | null;
};

/**
 * Quanto ha lavorato ciascuno, per giornata (T-43).
 *
 * `operatore_id` e `operatore` sono `null` per tutto quello che è stato
 * battuto prima di `0019_ruoli.sql`: `creato_da` non veniva riempito da
 * nessuno. È una riga "senza nome", non un buco.
 */
export type OperatoreGiornata = {
  giornata: string;
  operatore_id: string | null;
  operatore: string | null;
  venduto_cent: number;
  n_conti: number;
  incassato_cent: number;
};

/** Quanto si lavora, per giorno della settimana e ora. `isodow`: 1 = lunedì. */
export type OraDiPunta = {
  giorno_settimana: number;
  ora: number;
  pezzi: number;
  importo_cent: number;
  n_conti: number;
};

/* ------------------------------------------------- schema per il client */

/**
 * `Relationships` e `CompositeTypes` sono obbligatori: senza, l'inferenza dei
 * tipi di supabase-js collassa su `never` e ogni `select()` smette di essere
 * tipizzato. Sono vuoti perché non usiamo join automatiche via PostgREST.
 */
export interface Database {
  public: {
    Tables: {
      profili: {
        Row: Profilo;
        Insert: Partial<Profilo> & { id: string; nome: string };
        Update: Partial<Profilo>;
        Relationships: [];
      };
      clienti: {
        Row: Cliente;
        Insert: Partial<Cliente> & { nome: string };
        Update: Partial<Cliente>;
        Relationships: [];
      };
      categorie: {
        Row: Categoria;
        Insert: Partial<Categoria> & { nome: string };
        Update: Partial<Categoria>;
        Relationships: [];
      };
      prodotti: {
        Row: Prodotto;
        Insert: Omit<Partial<Prodotto>, 'nome'> & { nome_base: string; prezzo_cent: number };
        Update: Omit<Partial<Prodotto>, 'nome'>;
        Relationships: [];
      };
      conti: {
        Row: Conto;
        Insert: Partial<Conto> & { op_id: string };
        Update: Partial<Conto>;
        Relationships: [];
      };
      righe_conto: {
        Row: RigaConto;
        Insert: Omit<Partial<RigaConto>, 'importo_cent'> & {
          conto_id: string;
          descrizione: string;
          prezzo_unitario_cent: number;
          quantita: number;
          op_id: string;
        };
        Update: Omit<Partial<RigaConto>, 'importo_cent'>;
        Relationships: [];
      };
      pagamenti: {
        Row: Pagamento;
        Insert: Partial<Pagamento> & { importo_cent: number; op_id: string };
        Update: Partial<Pagamento>;
        Relationships: [];
      };
      impostazioni: {
        Row: Impostazione;
        Insert: Partial<Impostazione> & { chiave: string; valore: string };
        Update: Partial<Impostazione>;
        Relationships: [];
      };
      chiusure_turno: {
        Row: ChiusuraTurno;
        // Le tre colonne calcolate le scrive il database: se comparissero
        // qui, un giorno qualcuno le manderebbe e Postgres rifiuterebbe.
        Insert: Omit<Partial<ChiusuraTurno>, 'atteso_cent' | 'differenza_cent' | 'ritirato_cent'> & {
          iniziato_il: string;
          fondo_cassa_cent: number;
          contato_cent: number;
          incassato_contanti_cent: number;
          chiuso_da: string;
          op_id: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      v_saldo_clienti: { Row: SaldoCliente; Relationships: [] };
      v_conti_aperti: { Row: ContoAperto; Relationships: [] };
      v_estratto_conto: { Row: MovimentoEstrattoConto; Relationships: [] };
      v_griglia_prodotti: { Row: RiquadroGriglia; Relationships: [] };
      v_scontrini: { Row: MovimentoScontrino; Relationships: [] };
      v_turno_corrente: { Row: TurnoCorrente; Relationships: [] };
      v_riepilogo_giornata: { Row: RiepilogoGiornata; Relationships: [] };
      v_giornata: { Row: Giornata; Relationships: [] };
      v_venduto_prodotto: { Row: VendutoProdotto; Relationships: [] };
      v_classifica_clienti: { Row: RigaClassifica; Relationships: [] };
      v_ore_di_punta: { Row: OraDiPunta; Relationships: [] };
      v_operatore_giornata: { Row: OperatoreGiornata; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
