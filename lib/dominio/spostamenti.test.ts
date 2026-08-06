import { describe, it, expect } from 'vitest';
import {
  descriviSpostamento,
  pezziSpostabili,
  verificaSpostamento,
  type RigaSpostabile,
} from './spostamenti';

function riga(extra: Partial<RigaSpostabile> = {}): RigaSpostabile {
  return {
    id: 'rig-1',
    contoId: 'con-1',
    descrizione: 'Caffè',
    prezzoUnitarioCent: 120,
    quantita: 3,
    quantitaGiaStornata: 0,
    eStorno: false,
    ...extra,
  };
}

const BASE = { clienteOrigineId: 'michele', clienteDestinazioneId: 'luca' };

describe('pezziSpostabili', () => {
  it('su una riga intatta sono tutti', () => {
    expect(pezziSpostabili(riga())).toBe(3);
  });

  it('scala quelli già spostati via', () => {
    expect(pezziSpostabili(riga({ quantitaGiaStornata: 2 }))).toBe(1);
  });

  it('uno storno non si sposta', () => {
    expect(pezziSpostabili(riga({ eStorno: true }))).toBe(0);
  });
});

describe('verificaSpostamento', () => {
  it('sposta un caffè su tre e calcola quanto vale', () => {
    // Il caso vero: Luca ne offre uno dei tre
    const e = verificaSpostamento({ ...BASE, riga: riga(), quantita: 1 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.importoCent).toBe(120);
    expect(e.restantiCent).toBe(240);
  });

  it('sposta la riga intera', () => {
    const e = verificaSpostamento({ ...BASE, riga: riga(), quantita: 3 });
    expect(e.valido).toBe(true);
    if (!e.valido) return;
    expect(e.importoCent).toBe(360);
    expect(e.restantiCent).toBe(0);
  });

  it('non se ne spostano più di quanti ce ne sono', () => {
    const e = verificaSpostamento({ ...BASE, riga: riga(), quantita: 4 });
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/restano solo 3/);
  });

  it('tiene conto di quelli già spostati', () => {
    // Due caffè su tre erano già stati offerti: ne resta uno
    const r = riga({ quantitaGiaStornata: 2 });
    expect(verificaSpostamento({ ...BASE, riga: r, quantita: 2 }).valido).toBe(false);
    expect(verificaSpostamento({ ...BASE, riga: r, quantita: 1 }).valido).toBe(true);
  });

  it('una riga esaurita lo dice chiaramente', () => {
    const e = verificaSpostamento({ ...BASE, riga: riga({ quantitaGiaStornata: 3 }), quantita: 1 });
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/non resta niente/i);
  });

  it('al banco non si addebita: paga subito, non ha un conto', () => {
    const e = verificaSpostamento({
      ...BASE,
      clienteDestinazioneId: null,
      riga: riga(),
      quantita: 1,
    });
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/banco/i);
  });

  it('spostare a sé stessi non è uno spostamento', () => {
    const e = verificaSpostamento({
      ...BASE,
      clienteDestinazioneId: 'michele',
      riga: riga(),
      quantita: 1,
    });
    expect(e.valido).toBe(false);
  });

  it('uno storno non si sposta', () => {
    const e = verificaSpostamento({ ...BASE, riga: riga({ eStorno: true }), quantita: 1 });
    expect(e.valido).toBe(false);
    if (e.valido) return;
    expect(e.errore).toMatch(/storno/i);
  });

  it('rifiuta quantità assurde', () => {
    expect(verificaSpostamento({ ...BASE, riga: riga(), quantita: 0 }).valido).toBe(false);
    expect(verificaSpostamento({ ...BASE, riga: riga(), quantita: -1 }).valido).toBe(false);
    expect(verificaSpostamento({ ...BASE, riga: riga(), quantita: 1.5 }).valido).toBe(false);
  });
});

describe('descriviSpostamento', () => {
  it('dice chi paga cosa, senza equivoci', () => {
    expect(
      descriviSpostamento({
        descrizione: 'Caffè',
        quantita: 1,
        nomeOrigine: 'Michele',
        nomeDestinazione: 'Luca',
      }),
    ).toBe('Caffè: da Michele a Luca');
  });

  it('con più pezzi lo scrive', () => {
    expect(
      descriviSpostamento({
        descrizione: 'Caffè',
        quantita: 2,
        nomeOrigine: 'Michele',
        nomeDestinazione: 'Luca',
      }),
    ).toBe('Caffè ×2: da Michele a Luca');
  });
});
