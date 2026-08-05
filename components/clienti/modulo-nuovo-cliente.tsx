'use client';

import { useEffect, useState } from 'react';
import { useCreaCliente } from '@/lib/hooks/use-clienti';
import { validaNuovoCliente } from '@/lib/dominio/clienti';

interface Props {
  /** Se l'utente stava cercando qualcuno che non esiste, il nome è già scritto. */
  nomeIniziale?: string;
  onChiudi: () => void;
  onCreato: () => void;
}

export function ModuloNuovoCliente({ nomeIniziale = '', onChiudi, onCreato }: Props) {
  const [nome, setNome] = useState(nomeIniziale);
  const [soprannome, setSoprannome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  const crea = useCreaCliente();

  useEffect(() => {
    const conTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', conTasto);
    return () => document.removeEventListener('keydown', conTasto);
  }, [onChiudi]);

  function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    // Si valida prima di chiamare il server: un messaggio immediato vale più
    // di un giro sulla rete per sentirsi dire che manca il nome.
    const esito = validaNuovoCliente({ nome, soprannome, telefono });
    if (!esito.valido) {
      setErrore(esito.errore);
      return;
    }

    crea.mutate(
      { nome, soprannome, telefono },
      {
        onSuccess: onCreato,
        onError: (e) => setErrore(e instanceof Error ? e.message : 'Salvataggio non riuscito.'),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="absolute inset-0 bg-black/60"
      />

      <form
        onSubmit={invia}
        className="relative w-full rounded-t-3xl bg-[var(--color-superficie)] px-5 pb-sicura pt-3"
      >
        <div className="flex justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-bordo)]" />
        </div>

        <h2 className="pb-1 pt-4 text-lg font-semibold">Nuovo cliente</h2>
        <p className="pb-4 text-sm text-[var(--color-testo-tenue)]">
          Basta il nome. Il resto si aggiunge quando c&apos;è tempo.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-[var(--color-testo-tenue)]">Nome</span>
          {/* Il pannello si apre proprio per scrivere qui: la tastiera deve
              comparire da sola, altrimenti è un tap in più ogni volta. */}
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoCapitalize="words"
            autoCorrect="off"
            className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--color-testo-tenue)]">Soprannome</span>
            <input
              value={soprannome}
              onChange={(e) => setSoprannome(e.target.value)}
              autoCapitalize="words"
              autoCorrect="off"
              className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--color-testo-tenue)]">Telefono</span>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              inputMode="tel"
              className="h-14 rounded-xl border border-[var(--color-bordo)] bg-[var(--color-sfondo)] px-4 outline-none focus:border-[var(--color-accento)]"
            />
          </label>
        </div>

        {errore && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[var(--color-debito)]/40 bg-[var(--color-debito)]/10 px-4 py-3 text-sm text-[var(--color-debito)]"
          >
            {errore}
          </p>
        )}

        <div className="mt-4 flex gap-3 pb-4">
          <button
            type="button"
            onClick={onChiudi}
            className="h-14 flex-1 rounded-xl border border-[var(--color-bordo)] text-[var(--color-testo-tenue)]"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={crea.isPending}
            className="h-14 flex-[2] rounded-xl bg-[var(--color-accento)] text-lg font-semibold text-[var(--color-sfondo)] active:brightness-90 disabled:opacity-60"
          >
            {crea.isPending ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  );
}
