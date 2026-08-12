import { describe, it, expect } from 'vitest';
import {
  centesimi,
  centesimiInCampo,
  parseEuro,
  formatEuro,
  sommaCentesimi,
  moltiplica,
  inverti,
  statoSaldo,
  descriviSaldo,
  ZERO,
  digitaCifre,
  cancellaCifra,
  cifreInCentesimi,
  MASSIMO_DIGITABILE,
  mascheraImporto,
} from './denaro';

// Lo spazio prima di € prodotto da Intl è uno spazio unificatore (U+00A0),
// non uno spazio normale. Normalizzarlo rende i test leggibili.
const norm = (s: string) => s.replace(/ /g, ' ');

describe('centesimi', () => {
  it('accetta interi', () => {
    expect(centesimi(120)).toBe(120);
    expect(centesimi(0)).toBe(0);
    expect(centesimi(-500)).toBe(-500);
  });

  it('rifiuta i decimali — è la protezione principale del progetto', () => {
    expect(() => centesimi(1.5)).toThrow();
    expect(() => centesimi(0.1)).toThrow();
    expect(() => centesimi(1.2)).toThrow();
  });

  it('rifiuta numeri fuori scala', () => {
    expect(() => centesimi(Number.MAX_SAFE_INTEGER + 2)).toThrow();
    expect(() => centesimi(Infinity)).toThrow();
  });
});

describe('parseEuro', () => {
  it('accetta la virgola italiana e il punto', () => {
    expect(parseEuro('1,20')).toBe(120);
    expect(parseEuro('1.20')).toBe(120);
    expect(parseEuro('1,2')).toBe(120);
    expect(parseEuro('0,30')).toBe(30);
    expect(parseEuro('5')).toBe(500);
    expect(parseEuro(' 2,50 ')).toBe(250);
  });

  it('gestisce gli arrotondamenti insidiosi', () => {
    // 1.15 * 100 in virgola mobile fa 114.99999999999999
    expect(parseEuro('1,15')).toBe(115);
    expect(parseEuro('2,05')).toBe(205);
    expect(parseEuro('8,35')).toBe(835);
  });

  it('rifiuta quello che non è un importo', () => {
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('   ')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro('1,2,3')).toBeNull();
    expect(parseEuro('-5')).toBeNull();
    expect(parseEuro('1,234')).toBeNull();
    expect(parseEuro('€ 1,20')).toBeNull();
  });

  it('copre i prezzi reali del listino', () => {
    const listino: Array<[string, number]> = [
      ['1,20', 120], // caffè
      ['1,30', 130], // caffè decaffeinato
      ['1,70', 170], // cappuccino / ichnusa 0,33
      ['2,10', 210], // cappuccino AD decaffeinato
      ['0,30', 30], // acqua al bicchiere
      ['2,70', 270], // ichnusa 0,66
      ['3,50', 350], // vermentino
      ['5,00', 500], // spritz
    ];
    for (const [testo, atteso] of listino) {
      expect(parseEuro(testo), `prezzo ${testo}`).toBe(atteso);
    }
  });
});

describe('formatEuro', () => {
  it('formatta in italiano', () => {
    expect(norm(formatEuro(120))).toBe('1,20 €');
    expect(norm(formatEuro(0))).toBe('0,00 €');
    expect(norm(formatEuro(30))).toBe('0,30 €');
    expect(norm(formatEuro(-500))).toBe('-5,00 €');
    expect(norm(formatEuro(123456))).toBe('1.234,56 €');
  });

  it('aggiunge il più solo quando richiesto', () => {
    expect(norm(formatEuro(250, { segnoPiu: true }))).toBe('+2,50 €');
    expect(norm(formatEuro(-250, { segnoPiu: true }))).toBe('-2,50 €');
    expect(norm(formatEuro(0, { segnoPiu: true }))).toBe('0,00 €');
  });

  it('fa il giro completo con parseEuro', () => {
    for (const testo of ['1,20', '0,30', '12,45', '100,00']) {
      const cent = parseEuro(testo);
      expect(cent).not.toBeNull();
      expect(norm(formatEuro(cent!))).toBe(`${testo} €`);
    }
  });
});

describe('somma e moltiplicazione', () => {
  it('somma senza errori di virgola mobile', () => {
    // Il caso classico: 0.1 + 0.2 !== 0.3 in virgola mobile.
    // In centesimi non esiste il problema.
    expect(sommaCentesimi([10, 20])).toBe(30);

    // Un conto vero: 2 caffè, 1 cappuccino AD, 1 pizzetta
    expect(sommaCentesimi([120, 120, 200, 150])).toBe(590);
    expect(norm(formatEuro(sommaCentesimi([120, 120, 200, 150])))).toBe('5,90 €');
  });

  it('somma di lista vuota fa zero', () => {
    expect(sommaCentesimi([])).toBe(ZERO);
  });

  it('regge un conto lungo senza deriva', () => {
    // (vedi anche centesimiInCampo più sotto)
    // 1000 caffè: con i float questo accumulerebbe errore
    const righe = Array.from({ length: 1000 }, () => 120);
    expect(sommaCentesimi(righe)).toBe(120_000);
    expect(norm(formatEuro(sommaCentesimi(righe)))).toBe('1.200,00 €');
  });

  it('moltiplica prezzo per quantità', () => {
    expect(moltiplica(120, 2)).toBe(240);
    expect(moltiplica(170, 3)).toBe(510);
    expect(moltiplica(120, -1)).toBe(-120); // storno
  });

  it('rifiuta quantità non intere', () => {
    expect(() => moltiplica(120, 1.5)).toThrow();
  });
});

describe('storni', () => {
  it('inverte il segno', () => {
    expect(inverti(500)).toBe(-500);
    expect(inverti(-500)).toBe(500);
  });

  it('uno storno riporta il totale al valore corretto', () => {
    // Il barista batte per sbaglio una birra media da 3,50 e la storna.
    const righe = [120, 120, 350, inverti(350)];
    expect(sommaCentesimi(righe)).toBe(240);
    expect(norm(formatEuro(sommaCentesimi(righe)))).toBe('2,40 €');
  });
});

describe('lettura del saldo', () => {
  it('classifica correttamente', () => {
    expect(statoSaldo(2450)).toBe('deve');
    expect(statoSaldo(0)).toBe('in_pari');
    expect(statoSaldo(-500)).toBe('acconto');
  });

  it('descrive il saldo in italiano', () => {
    expect(norm(descriviSaldo(2450))).toBe('deve 24,50 €');
    expect(descriviSaldo(0)).toBe('in pari');
    expect(norm(descriviSaldo(-500))).toBe('acconto di 5,00 €');
  });

  it('un cliente che salda tutto risulta in pari', () => {
    // Mario: 24,50 di consumazioni, paga 24,50
    const addebitato = sommaCentesimi([120, 120, 500, 350, 170, 170, 500, 520]);
    const pagato = 2450;
    expect(addebitato).toBe(2450);
    expect(statoSaldo(addebitato - pagato)).toBe('in_pari');
  });

  it('un pagamento parziale lascia il resto a debito', () => {
    const dovuto = 3290;
    const pagato = 2000;
    expect(statoSaldo(dovuto - pagato)).toBe('deve');
    expect(norm(descriviSaldo(dovuto - pagato))).toBe('deve 12,90 €');
  });

  it('un pagamento eccedente diventa un acconto', () => {
    expect(norm(descriviSaldo(500 - 2000))).toBe('acconto di 15,00 €');
  });
});

describe('centesimiInCampo', () => {
  it('scrive senza simbolo e senza separatore di migliaia', () => {
    expect(centesimiInCampo(1250)).toBe('12,50');
    expect(centesimiInCampo(123450)).toBe('1234,50');
  });

  it('tiene gli zeri dove servono', () => {
    expect(centesimiInCampo(0)).toBe('0,00');
    expect(centesimiInCampo(5)).toBe('0,05');
    expect(centesimiInCampo(50)).toBe('0,50');
    expect(centesimiInCampo(100)).toBe('1,00');
  });

  it('è il giro inverso di parseEuro: quello che scrive, parseEuro lo rilegge', () => {
    for (const c of [0, 1, 5, 99, 100, 120, 999, 1000, 3290, 123456]) {
      expect(parseEuro(centesimiInCampo(c))).toBe(c);
    }
  });

  it('formatEuro invece non torna indietro: ecco perché questa funzione esiste', () => {
    // "1.234,50 €" non è un importo valido per parseEuro
    expect(parseEuro(formatEuro(123450))).toBeNull();
  });
});

describe('inserimento stile bancomat', () => {
  it('le cifre entrano da destra: 2 → 0,02, 25 → 0,25, 250 → 2,50', () => {
    let v = ZERO as number;
    v = digitaCifre(v, '2');
    expect(centesimiInCampo(v)).toBe('0,02');
    v = digitaCifre(v, '5');
    expect(centesimiInCampo(v)).toBe('0,25');
    v = digitaCifre(v, '0');
    expect(centesimiInCampo(v)).toBe('2,50');
    v = digitaCifre(v, '0');
    expect(centesimiInCampo(v)).toBe('25,00');
    v = digitaCifre(v, '0');
    expect(centesimiInCampo(v)).toBe('250,00');
  });

  it('il tasto 00 vale due cifre', () => {
    expect(digitaCifre(ZERO, '2')).toBe(2);
    expect(digitaCifre(2, '00')).toBe(200);
    // 25 → 0,25; poi "00" spinge dentro due zeri → 25,00
    expect(centesimiInCampo(digitaCifre(digitaCifre(ZERO, '25'), '00'))).toBe('25,00');
  });

  it('lo zero iniziale non si accumula: 0,00 resta 0,00', () => {
    expect(digitaCifre(ZERO, '0')).toBe(0);
    expect(digitaCifre(ZERO, '000')).toBe(0);
    expect(digitaCifre(digitaCifre(ZERO, '000'), '5')).toBe(5);
  });

  it('ignora tutto ciò che non è una cifra', () => {
    expect(digitaCifre(ZERO, '1,20')).toBe(120);
    expect(digitaCifre(ZERO, ' 12 € ')).toBe(12);
    expect(digitaCifre(ZERO, 'abc')).toBe(0);
  });

  it('oltre il tetto il tasto non fa niente, invece di produrre un numero assurdo', () => {
    expect(digitaCifre(MASSIMO_DIGITABILE, '9')).toBe(MASSIMO_DIGITABILE);
    // le cifre già accettate restano: si ferma, non annulla
    expect(digitaCifre(9_999_999, '99')).toBe(99_999_999);
    expect(Number.isSafeInteger(digitaCifre(MASSIMO_DIGITABILE, '999999'))).toBe(true);
  });

  it('cancella toglie una cifra a destra fino a zero', () => {
    expect(cancellaCifra(2500)).toBe(250);
    expect(cancellaCifra(250)).toBe(25);
    expect(cancellaCifra(25)).toBe(2);
    expect(cancellaCifra(2)).toBe(0);
    expect(cancellaCifra(0)).toBe(0);
  });

  it('digita e cancella si annullano a vicenda', () => {
    for (const c of [0, 5, 99, 120, 3290, 123456]) {
      expect(cancellaCifra(digitaCifre(c, '7'))).toBe(c);
    }
  });

  it('cifreInCentesimi legge un campo di testo con la stessa regola', () => {
    expect(cifreInCentesimi('')).toBe(0);
    expect(cifreInCentesimi('250')).toBe(250);
    expect(cifreInCentesimi('25000')).toBe(25000);
    // la regola è identica al tastierino: nessuna schermata legge "250"
    // in modo diverso da un'altra
    expect(cifreInCentesimi('250')).toBe(digitaCifre(ZERO, '250'));
  });

  it('quello che si digita, centesimiInCampo lo riscrive uguale', () => {
    for (const cifre of ['1', '12', '123', '1234', '100', '999']) {
      const importo = digitaCifre(ZERO, cifre);
      expect(cifreInCentesimi(centesimiInCampo(importo))).toBe(importo);
    }
  });
});

describe('mascheraImporto', () => {
  it('mette la virgola al posto giusto mentre si digita', () => {
    expect(mascheraImporto('1')).toBe('0,01');
    expect(mascheraImporto('12')).toBe('0,12');
    expect(mascheraImporto('125')).toBe('1,25');
    expect(mascheraImporto('1250')).toBe('12,50');
  });

  it('il campo vuoto resta vuoto: non ho scritto niente non è ho scritto zero', () => {
    expect(mascheraImporto('')).toBe('');
    expect(mascheraImporto('abc')).toBe('');
    expect(mascheraImporto('0')).toBe('0,00');
  });

  it('è stabile: rimasticare il risultato non lo cambia', () => {
    for (const t of ['1', '125', '1250', '99999']) {
      const una = mascheraImporto(t);
      expect(mascheraImporto(una)).toBe(una);
    }
  });

  it('cancellare una cifra sposta la virgola indietro, come sul tastierino', () => {
    // "12,50" meno l'ultimo carattere → "12,5" → 1,25
    expect(mascheraImporto('12,5')).toBe('1,25');
  });
});
