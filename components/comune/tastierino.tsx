'use client';

/**
 * Il tastierino degli importi.
 *
 * PERCHÉ NON LA TASTIERA DI SISTEMA.
 *
 * La tastiera del telefono si mangia metà schermo. In un pannello dove
 * bisogna anche vedere quanto è dovuto, scegliere il metodo e arrivare a
 * CONFERMA, quella metà schermo vuol dire scorrere con la tastiera aperta:
 * il gesto più scomodo che ci sia con una mano sola e le dita bagnate.
 *
 * E i suoi tasti sono piccoli, perché sono pensati per scrivere parole.
 * Qui servono dieci cifre, e servono grandi.
 *
 * Da quando l'inserimento è a centesimi da destra (`digitaCifre` in
 * lib/dominio/denaro.ts) la virgola non si digita più: restano dieci cifre,
 * il doppio zero e la cancellazione. Dodici tasti in una griglia fissa, che
 * sta sempre nello stesso posto — la memoria del pollice conta più della
 * lettura.
 *
 * Il tastierino non sa niente di importi: manda su i tasti premuti e basta.
 * Le regole stanno nel modulo denaro, dove ci sono i test.
 */

interface Props {
  onCifre: (cifre: string) => void;
  onCancella: () => void;
  /** Etichetta per chi legge con lo schermo: "Importo", "Contato in cassa"… */
  descrizione: string;
}

const CIFRE = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function Tastierino({ onCifre, onCancella, descrizione }: Props) {
  /**
   * Il tap non aspetta il rilascio del dito. Su mobile `click` arriva dopo
   * il `touchend`, e su una sequenza veloce di cifre quel ritardo si sente:
   * `pointerdown` fa comparire la cifra nell'istante in cui il dito tocca.
   */
  function premi(azione: () => void) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      azione();
      if (navigator.vibrate) navigator.vibrate(5);
    };
  }

  const stile =
    'flex h-14 items-center justify-center rounded-xl bg-[var(--color-superficie-alta)] ' +
    'text-2xl font-semibold tabular-nums select-none touch-manipulation active:brightness-125';

  return (
    <div
      role="group"
      aria-label={`Tastierino: ${descrizione}`}
      className="grid grid-cols-3 gap-2"
    >
      {CIFRE.map((c) => (
        <button key={c} type="button" onPointerDown={premi(() => onCifre(c))} className={stile}>
          {c}
        </button>
      ))}

      <button
        type="button"
        onPointerDown={premi(() => onCifre('00'))}
        aria-label="Due zeri"
        className={stile}
      >
        00
      </button>

      <button type="button" onPointerDown={premi(() => onCifre('0'))} className={stile}>
        0
      </button>

      <button
        type="button"
        onPointerDown={premi(onCancella)}
        aria-label="Cancella l'ultima cifra"
        className={`${stile} text-xl`}
      >
        ⌫
      </button>
    </div>
  );
}
