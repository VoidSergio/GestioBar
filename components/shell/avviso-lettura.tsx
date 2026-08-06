'use client';

import { spiegaErroreLettura } from '@/lib/dominio/errori';
import { useStatoRete } from '@/lib/hooks/use-stato-rete';

/**
 * Che cosa mostrare quando una lettura dal server non riesce.
 *
 * Sta in un componente solo perché la regola vale ovunque: **non si dà la
 * colpa alla rete senza sapere che è la rete.** Prima ogni schermata scriveva
 * "serve la connessione" per qualunque errore, e con la connessione attiva il
 * messaggio mandava a controllare il modem invece del problema vero.
 */

interface Props {
  errore: unknown;
  /** che cosa si stava leggendo: "Lo storico", "Questa schermata" */
  cosa?: string;
  /** una riga in più da tenere sempre, per esempio "il saldo resta aggiornato" */
  rassicurazione?: string;
  onRiprova?: () => void;
}

export function AvvisoLettura({ errore, cosa, rassicurazione, onRiprova }: Props) {
  const rete = useStatoRete();
  const spiegazione = spiegaErroreLettura(errore, { offline: rete === 'offline', cosa });

  return (
    <div className="px-8 py-10 text-center">
      <p className="text-sm text-[var(--color-testo-tenue)]">{spiegazione.titolo}</p>

      {spiegazione.dettaglio && (
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--color-testo-tenue)] opacity-80">
          {spiegazione.dettaglio}
        </p>
      )}

      {rassicurazione && (
        <p className="mt-2 text-xs text-[var(--color-testo-tenue)]">{rassicurazione}</p>
      )}

      {onRiprova && (
        <button
          type="button"
          onClick={onRiprova}
          className="mt-5 h-14 rounded-xl border border-[var(--color-bordo)] px-8 text-sm font-medium"
        >
          Riprova
        </button>
      )}
    </div>
  );
}
