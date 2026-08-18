'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ErroreLettura } from '@/lib/dominio/errori';
import type {
  Articolo,
  Composizione,
  Fornitore,
  Giacenza,
  MovimentoMagazzino,
  TipoMovimentoMagazzino,
  UnitaMisura,
} from '@/lib/supabase/tipi';

/**
 * Il magazzino (T-30 … T-36).
 *
 * PERCHÉ NON PASSA DALLA CODA OFFLINE. Stessa eccezione del listino
 * (`use-listino.ts`): si carica merce da fermi, quando arriva il fornitore,
 * non mentre c'è fila. Farlo offline vorrebbe dire gestire due inventari
 * decisi su due dispositivi, per un guadagno che è zero.
 *
 * L'unica cosa che succede al banco — lo scarico automatico alla vendita — non
 * passa da qui: la fa il database quando la riga di conto arriva
 * (`0020_magazzino.sql`). Così funziona anche offline, senza che l'app debba
 * saperne niente.
 */

export const CHIAVE_GIACENZE = ['giacenze'] as const;

export function useGiacenze() {
  return useQuery({
    queryKey: CHIAVE_GIACENZE,
    queryFn: async (): Promise<Giacenza[]> => {
      const { data, error } = await supabaseBrowser().from('v_giacenze').select('*');
      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFornitori() {
  return useQuery({
    queryKey: ['fornitori'],
    queryFn: async (): Promise<Fornitore[]> => {
      const { data, error } = await supabaseBrowser()
        .from('fornitori')
        .select('*')
        .eq('attivo', true)
        .order('nome');
      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Lo storico di un articolo: da dove viene la giacenza di adesso. */
export function useMovimenti(articoloId: string, quanti = 30) {
  return useQuery({
    queryKey: ['movimenti-magazzino', articoloId, quanti],
    queryFn: async (): Promise<MovimentoMagazzino[]> => {
      const { data, error } = await supabaseBrowser()
        .from('movimenti_magazzino')
        .select('*')
        .eq('articolo_id', articoloId)
        .order('creato_il', { ascending: false })
        .limit(quanti);
      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 60 * 1000,
    placeholderData: (precedente) => precedente,
  });
}

function invalidaMagazzino(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: CHIAVE_GIACENZE });
  void queryClient.invalidateQueries({ queryKey: ['movimenti-magazzino'] });
}

export function useCreaArticolo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      nome: string;
      unita: UnitaMisura;
      scortaMinimaMilli: number;
      fornitoreId: string | null;
    }) => {
      const { error } = await supabaseBrowser().from('articoli').insert({
        nome: dati.nome,
        unita: dati.unita,
        scorta_minima_milli: dati.scortaMinimaMilli,
        fornitore_id: dati.fornitoreId,
      });
      if (error) throw new ErroreLettura(error.message, error.code);
    },
    onSuccess: () => invalidaMagazzino(queryClient),
  });
}

export function useModificaArticolo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      id: string;
      campi: Partial<Pick<Articolo, 'nome' | 'scorta_minima_milli' | 'attivo' | 'fornitore_id'>>;
    }) => {
      const { error, count } = await supabaseBrowser()
        .from('articoli')
        .update(dati.campi, { count: 'exact' })
        .eq('id', dati.id);
      if (error) throw new ErroreLettura(error.message, error.code);
      // RLS che vieta non dà errore: restituisce zero righe toccate.
      if (count === 0) throw new Error('Il magazzino lo cambia il titolare.');
    },
    onSuccess: () => invalidaMagazzino(queryClient),
  });
}

/**
 * Registra un movimento.
 *
 * Il segno lo mette `conSegno` in `lib/dominio/magazzino.ts` prima di
 * arrivare qui: il database ha un vincolo che rifiuta un carico negativo, e
 * fargli rifiutare qualcosa che si poteva evitare vuol dire mostrare un
 * errore tecnico a chi sta scaricando un bancale.
 */
export function useRegistraMovimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: {
      articoloId: string;
      tipo: TipoMovimentoMagazzino;
      quantitaMilli: number;
      causale?: string;
      costoUnitarioCent?: number | null;
    }) => {
      const { error } = await supabaseBrowser().from('movimenti_magazzino').insert({
        articolo_id: dati.articoloId,
        tipo: dati.tipo,
        quantita_milli: dati.quantitaMilli,
        causale: dati.causale ?? null,
        costo_unitario_cent: dati.costoUnitarioCent ?? null,
      });
      if (error) throw new ErroreLettura(error.message, error.code);
    },
    onSuccess: () => invalidaMagazzino(queryClient),
  });
}

/* ------------------------------------------------- la distinta base */

/** Quali prodotti consumano questo articolo, e quanto. */
export function useComposizioniDi(articoloId: string) {
  return useQuery({
    queryKey: ['composizioni', articoloId],
    queryFn: async (): Promise<Composizione[]> => {
      const { data, error } = await supabaseBrowser()
        .from('composizioni')
        .select('*')
        .eq('articolo_id', articoloId);
      if (error) throw new ErroreLettura(error.message, error.code);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSalvaComposizione() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: Composizione) => {
      const { error } = await supabaseBrowser().from('composizioni').upsert(dati);
      if (error) throw new ErroreLettura(error.message, error.code);
    },
    onSuccess: (_r, dati) =>
      queryClient.invalidateQueries({ queryKey: ['composizioni', dati.articolo_id] }),
  });
}

export function useTogliComposizione() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dati: { prodottoId: string; articoloId: string }) => {
      const { error } = await supabaseBrowser()
        .from('composizioni')
        .delete()
        .eq('prodotto_id', dati.prodottoId)
        .eq('articolo_id', dati.articoloId);
      if (error) throw new ErroreLettura(error.message, error.code);
    },
    onSuccess: (_r, dati) =>
      queryClient.invalidateQueries({ queryKey: ['composizioni', dati.articoloId] }),
  });
}

/* --------------------------------------------- lo scarico automatico */

const CHIAVE_SCARICO = 'scarico_automatico';

export function useScaricoAutomatico() {
  const queryClient = useQueryClient();

  const stato = useQuery({
    queryKey: ['impostazione', CHIAVE_SCARICO],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabaseBrowser()
        .from('impostazioni')
        .select('valore')
        .eq('chiave', CHIAVE_SCARICO)
        .maybeSingle();
      if (error) throw new ErroreLettura(error.message, error.code);
      return data?.valore === 'si';
    },
    staleTime: 10 * 60 * 1000,
  });

  const cambia = useMutation({
    mutationFn: async (acceso: boolean) => {
      const { error, count } = await supabaseBrowser()
        .from('impostazioni')
        .update({ valore: acceso ? 'si' : 'no' }, { count: 'exact' })
        .eq('chiave', CHIAVE_SCARICO);
      if (error) throw new ErroreLettura(error.message, error.code);
      if (count === 0) throw new Error('Questa impostazione la cambia il titolare.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['impostazione', CHIAVE_SCARICO] });
      invalidaMagazzino(queryClient);
    },
  });

  return { acceso: stato.data ?? false, caricato: !stato.isPending, cambia };
}
