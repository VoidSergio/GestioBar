import { describe, it, expect } from 'vitest';
import { cellaCsv, componiCsv, dataCsv, importoCsv, nomeFile, SEPARATORE } from './csv';

describe('importoCsv', () => {
  it('usa la virgola decimale: con il punto Excel legge testo e non somma', () => {
    expect(importoCsv(1250)).toBe('12,50');
    expect(importoCsv(0)).toBe('0,00');
    expect(importoCsv(5)).toBe('0,05');
    expect(importoCsv(123456)).toBe('1234,56');
  });

  it('niente separatore delle migliaia: sarebbe un punto, e confonderebbe il decimale', () => {
    expect(importoCsv(123456)).not.toContain('.');
  });

  it('tiene il segno degli storni', () => {
    expect(importoCsv(-500)).toBe('-5,00');
  });
});

describe('cellaCsv', () => {
  it('lascia stare quello che non ha bisogno di niente', () => {
    expect(cellaCsv('Caffè')).toBe('Caffè');
    expect(cellaCsv('12,50')).toBe('12,50');
  });

  it('protegge il punto e virgola, che è il separatore', () => {
    expect(cellaCsv('Caffè; corretto')).toBe('"Caffè; corretto"');
  });

  it('raddoppia le virgolette: un soprannome fra virgolette spezzava la riga', () => {
    expect(cellaCsv('Franco "Ciccio"')).toBe('"Franco ""Ciccio"""');
  });

  it('protegge gli a capo', () => {
    expect(cellaCsv('due\nrighe')).toBe('"due\nrighe"');
  });
});

describe('dataCsv', () => {
  it('scrive le date come le legge Excel italiano', () => {
    expect(dataCsv('2026-08-12')).toBe('12/08/2026');
    expect(dataCsv('2026-01-01')).toBe('01/01/2026');
  });

  it('regge anche un istante completo, prendendo solo il giorno', () => {
    expect(dataCsv('2026-08-12T07:30:00+02:00')).toBe('12/08/2026');
  });

  it('quello che non è una data resta com’è, invece di diventare NaN', () => {
    expect(dataCsv('boh')).toBe('boh');
  });
});

describe('componiCsv', () => {
  it('mette il BOM davanti: senza, in Excel Caffè diventa CaffÃ¨', () => {
    const csv = componiCsv(['a'], [['1']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('separa con il punto e virgola e va a capo con CRLF', () => {
    const csv = componiCsv(['Giorno', 'Incassato'], [['12/08/2026', '250,00']]);
    expect(csv).toContain(`Giorno${SEPARATORE}Incassato\r\n`);
    expect(csv).toContain(`12/08/2026${SEPARATORE}250,00`);
  });

  it('finisce con un a capo: senza, alcuni programmi perdono l’ultima riga', () => {
    expect(componiCsv(['a'], [['1']]).endsWith('\r\n')).toBe(true);
  });

  it('un file senza righe ha comunque le intestazioni', () => {
    const csv = componiCsv(['Giorno', 'Incassato'], []);
    expect(csv.replace('﻿', '')).toBe(`Giorno${SEPARATORE}Incassato\r\n`);
  });

  it('il giro completo: quello che si scrive si rilegge colonna per colonna', () => {
    const csv = componiCsv(
      ['Cliente', 'Importo'],
      [
        ['Franco "Ciccio"', importoCsv(2450)],
        ['Caffè; corretto', importoCsv(-120)],
      ],
    );

    const righe = csv.replace('﻿', '').trimEnd().split('\r\n');
    expect(righe).toHaveLength(3);
    expect(righe[1]).toBe('"Franco ""Ciccio""";24,50');
    expect(righe[2]).toBe('"Caffè; corretto";-1,20');
  });
});

describe('nomeFile', () => {
  it('un giorno solo non ripete la data', () => {
    expect(nomeFile('giornate', '2026-08-12', '2026-08-12')).toBe('bar-giornate-2026-08-12.csv');
  });

  it('un periodo le porta entrambe: tre file uguali nei Download non si distinguono', () => {
    expect(nomeFile('prodotti', '2026-08-01', '2026-08-12')).toBe(
      'bar-prodotti-2026-08-01_2026-08-12.csv',
    );
  });
});
