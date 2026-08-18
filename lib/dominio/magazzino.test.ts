import { describe, it, expect } from 'vitest';
import {
  anteprimaQuantita,
  cifreInMilli,
  conSegno,
  daRiordinare,
  descriviInventario,
  differenzaInventario,
  formatQuantita,
  interaSoltanto,
  MILLE,
  ordinaGiacenze,
  type RigaGiacenza,
} from './magazzino';

function giacenza(g: Partial<RigaGiacenza> & { nome: string }): RigaGiacenza {
  return {
    id: g.nome,
    unita: 'kg',
    scorta_minima_milli: 0,
    giacenza_milli: 0,
    sotto_scorta: false,
    mai_movimentato: false,
    fornitore: null,
    ...g,
  };
}

describe('formatQuantita', () => {
  it('mette la virgola tagliando le cifre, senza dividere', () => {
    expect(formatQuantita(1250, 'kg')).toBe('1,25 kg');
    expect(formatQuantita(7, 'kg')).toBe('0,007 kg');
    expect(formatQuantita(120, 'l')).toBe('0,12 l');
  });

  it('toglie gli zeri finali: "5,000 l" si legge peggio di "5 l"', () => {
    expect(formatQuantita(5000, 'l')).toBe('5 l');
    expect(formatQuantita(1500, 'kg')).toBe('1,5 kg');
  });

  it('pezzi e confezioni non hanno decimali', () => {
    expect(formatQuantita(3000, 'pz')).toBe('3 pz');
    expect(formatQuantita(12_000, 'conf')).toBe('12 conf');
  });

  it('lo zero è zero, non vuoto', () => {
    expect(formatQuantita(0, 'kg')).toBe('0 kg');
    expect(formatQuantita(0, 'pz')).toBe('0 pz');
  });

  it('tiene il segno: una giacenza sotto zero è un fatto da vedere', () => {
    expect(formatQuantita(-500, 'l')).toBe('-0,5 l');
    expect(formatQuantita(-2000, 'pz')).toBe('-2 pz');
  });

  it('non produce mai numeri con la virgola in virgola mobile', () => {
    // Mille scarichi da 7 g: sommati restano interi, e il totale è esatto.
    let totale = 0;
    for (let i = 0; i < 1000; i += 1) totale += 7;
    expect(totale).toBe(7000);
    expect(formatQuantita(totale, 'kg')).toBe('7 kg');
  });
});

describe('cifreInMilli', () => {
  it('per chili e litri l’ultima cifra è un millesimo', () => {
    expect(cifreInMilli('1250', 'kg')).toBe(1250);
    expect(cifreInMilli('7', 'kg')).toBe(7);
  });

  it('per pezzi e confezioni l’ultima cifra è un pezzo intero', () => {
    // Senza questa regola, battere "3" darebbe 0,003 bottiglie.
    expect(cifreInMilli('3', 'pz')).toBe(3 * MILLE);
    expect(cifreInMilli('12', 'conf')).toBe(12 * MILLE);
  });

  it('il campo vuoto è zero', () => {
    expect(cifreInMilli('', 'kg')).toBe(0);
    expect(cifreInMilli('', 'pz')).toBe(0);
  });

  it('ignora tutto quello che non è una cifra', () => {
    expect(cifreInMilli('1,25', 'kg')).toBe(125);
    expect(cifreInMilli('abc', 'kg')).toBe(0);
  });

  it('si ferma prima di uscire dagli interi sicuri', () => {
    const tanto = cifreInMilli('99999999999', 'pz');
    expect(Number.isSafeInteger(tanto)).toBe(true);
  });

  it('interaSoltanto dice chi si conta intero', () => {
    expect(interaSoltanto('pz')).toBe(true);
    expect(interaSoltanto('conf')).toBe(true);
    expect(interaSoltanto('kg')).toBe(false);
    expect(interaSoltanto('l')).toBe(false);
  });
});

describe('anteprimaQuantita', () => {
  it('mostra le tre cifre mentre si digita, come il tastierino dei soldi', () => {
    expect(anteprimaQuantita('1', 'kg')).toBe('0,001');
    expect(anteprimaQuantita('12', 'kg')).toBe('0,012');
    expect(anteprimaQuantita('1250', 'kg')).toBe('1,250');
  });

  it('per i pezzi resta un numero intero', () => {
    expect(anteprimaQuantita('3', 'pz')).toBe('3');
    expect(anteprimaQuantita('', 'pz')).toBe('0');
  });
});

describe('conSegno', () => {
  it('il segno lo mette il programma, non chi ha la fila davanti', () => {
    expect(conSegno('carico', 5000)).toBe(5000);
    expect(conSegno('scarto', 2000)).toBe(-2000);
    expect(conSegno('scarico', 300)).toBe(-300);
  });

  it('anche se si scrive già negativo, il carico resta positivo', () => {
    // Il database rifiuterebbe un carico negativo: meglio non arrivarci.
    expect(conSegno('carico', -5000)).toBe(5000);
    expect(conSegno('scarto', -2000)).toBe(-2000);
  });

  it('la correzione è l’unica che tiene il segno che le si dà', () => {
    expect(conSegno('rettifica', -750)).toBe(-750);
    expect(conSegno('rettifica', 750)).toBe(750);
  });
});

describe('daRiordinare', () => {
  it('trova chi è sceso sotto la scorta minima', () => {
    const g = [
      giacenza({ nome: 'Grani', scorta_minima_milli: 2000, giacenza_milli: 1500, sotto_scorta: true }),
      giacenza({ nome: 'Latte', scorta_minima_milli: 5000, giacenza_milli: 9000 }),
    ];
    expect(daRiordinare(g).map((x) => x.nome)).toEqual(['Grani']);
  });

  it('un articolo mai movimentato non è da comprare: non è mai entrato', () => {
    const g = [
      giacenza({
        nome: 'Appena creato',
        scorta_minima_milli: 1000,
        giacenza_milli: 0,
        sotto_scorta: true,
        mai_movimentato: true,
      }),
    ];
    expect(daRiordinare(g)).toEqual([]);
  });

  it('chi non ha chiesto di essere avvisato non compare', () => {
    const g = [
      giacenza({ nome: 'Senza minimo', scorta_minima_milli: 0, giacenza_milli: 0, sotto_scorta: true }),
    ];
    expect(daRiordinare(g)).toEqual([]);
  });

  it('ma una giacenza sotto zero compare comunque: è venduto più di quello che c’era', () => {
    const g = [
      giacenza({ nome: 'Sotto zero', scorta_minima_milli: 0, giacenza_milli: -500, sotto_scorta: true }),
    ];
    expect(daRiordinare(g).map((x) => x.nome)).toEqual(['Sotto zero']);
  });

  it('ordina dal più urgente', () => {
    const g = [
      giacenza({ nome: 'Poco sotto', scorta_minima_milli: 1000, giacenza_milli: 900, sotto_scorta: true }),
      giacenza({ nome: 'Finito', scorta_minima_milli: 1000, giacenza_milli: 0, sotto_scorta: true }),
      giacenza({ nome: 'In rosso', scorta_minima_milli: 1000, giacenza_milli: -200, sotto_scorta: true }),
    ];
    expect(daRiordinare(g).map((x) => x.nome)).toEqual(['In rosso', 'Finito', 'Poco sotto']);
  });
});

describe('ordinaGiacenze', () => {
  it('prima quello che serve, poi in ordine alfabetico', () => {
    const g = [
      giacenza({ nome: 'Zucchero', giacenza_milli: 9000 }),
      giacenza({ nome: 'Grani', scorta_minima_milli: 2000, giacenza_milli: 100, sotto_scorta: true }),
      giacenza({ nome: 'Acqua', giacenza_milli: 9000 }),
    ];
    expect(ordinaGiacenze(g).map((x) => x.nome)).toEqual(['Grani', 'Acqua', 'Zucchero']);
  });

  it('non modifica l’elenco di partenza', () => {
    const g = [giacenza({ nome: 'B' }), giacenza({ nome: 'A' })];
    ordinaGiacenze(g);
    expect(g.map((x) => x.nome)).toEqual(['B', 'A']);
  });
});

describe('differenzaInventario', () => {
  it('è la differenza, non il valore contato', () => {
    // Registrare il contato come movimento aggiungerebbe un chilo a quello
    // che c'era già: i movimenti si sommano.
    expect(differenzaInventario(1000, 1500)).toBe(-500);
    expect(differenzaInventario(2000, 1500)).toBe(500);
  });

  it('quando torna è zero, e da zero non si scrive nessun movimento', () => {
    expect(differenzaInventario(1500, 1500)).toBe(0);
  });

  it('applicata alla giacenza dà esattamente il contato', () => {
    for (const [contato, giacenzaMilli] of [
      [1000, 1500],
      [0, 700],
      [9000, 0],
    ]) {
      const d = differenzaInventario(contato!, giacenzaMilli!);
      expect(giacenzaMilli! + d).toBe(contato);
    }
  });
});

describe('descriviInventario', () => {
  it('parla di quello che manca o avanza, non di segni', () => {
    expect(descriviInventario(-500, 'kg')).toBe('Mancano 0,5 kg');
    expect(descriviInventario(2000, 'pz')).toBe('Avanzano 2 pz');
    expect(descriviInventario(0, 'kg')).toBe('Torna');
  });
});
