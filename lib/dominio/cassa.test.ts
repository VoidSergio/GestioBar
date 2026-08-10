import { describe, it, expect } from 'vitest';
import {
  calcolaLettura,
  validaConteggio,
  serveCausale,
  segnoDifferenza,
  descriviDurata,
  turnoTroppoLungo,
  intestazioneTurno,
  type StatoTurno,
} from './cassa';

/** Il turno del mattino di 02-MODELLO-DATI §4.2, con fondo cassa 80 €. */
const MATTINA: StatoTurno = {
  iniziatoIl: '2026-08-08T06:00:00+02:00',
  fondoCassaCent: 8000,
  incassatoContantiCent: 27650,
  incassatoCartaCent: 9600,
  incassatoAltroCent: 0,
  variazioneCreditoCent: 3950,
};

describe('calcolaLettura — l’esempio del documento', () => {
  it('con 355,00 contati dà i numeri scritti in 02-MODELLO-DATI §4.2', () => {
    const l = calcolaLettura(MATTINA, 35500);
    expect(l.attesoCent).toBe(35650);
    expect(l.differenzaCent).toBe(-150);
    expect(l.ritiraCent).toBe(27500);
    expect(l.lasciaCent).toBe(8000);
  });

  it('in pari, la differenza è zero e si ritira esattamente l’incassato', () => {
    const l = calcolaLettura(MATTINA, 35650);
    expect(l.differenzaCent).toBe(0);
    expect(l.ritiraCent).toBe(MATTINA.incassatoContantiCent);
  });

  it('se avanza, la differenza è positiva', () => {
    expect(calcolaLettura(MATTINA, 35700).differenzaCent).toBe(50);
  });

  it('lascia sempre il fondo cassa, comunque sia andata', () => {
    for (const contato of [8000, 12345, 35500, 99999]) {
      expect(calcolaLettura(MATTINA, contato).lasciaCent).toBe(8000);
    }
  });

  it('un turno senza incassi si chiude col solo fondo, senza differenza', () => {
    const fermo: StatoTurno = { ...MATTINA, incassatoContantiCent: 0 };
    const l = calcolaLettura(fermo, 8000);
    expect(l.attesoCent).toBe(8000);
    expect(l.differenzaCent).toBe(0);
    expect(l.ritiraCent).toBe(0);
  });

  it('il venduto non entra nel conto: la carta e il credito non lo spostano', () => {
    // È la regola di 02-MODELLO-DATI §4.1. Se un giorno qualcuno sommasse la
    // carta all'atteso, questo test glielo direbbe subito.
    const conCarta = calcolaLettura({ ...MATTINA, incassatoCartaCent: 999999 }, 35500);
    const conCredito = calcolaLettura({ ...MATTINA, variazioneCreditoCent: 999999 }, 35500);
    expect(conCarta.attesoCent).toBe(35650);
    expect(conCredito.attesoCent).toBe(35650);
    expect(conCarta.differenzaCent).toBe(-150);
    expect(conCredito.differenzaCent).toBe(-150);
  });

  it('i crediti rientrati in contanti sono nel cassetto e alzano l’atteso', () => {
    // L'errore speculare del precedente: sono contante vero, entrano.
    const conRientri = calcolaLettura(
      { ...MATTINA, incassatoContantiCent: MATTINA.incassatoContantiCent + 4500 },
      35500
    );
    expect(conRientri.attesoCent).toBe(40150);
  });
});

describe('validaConteggio', () => {
  it('rifiuta un conteggio mancante', () => {
    const e = validaConteggio(null, MATTINA);
    expect(e.valido).toBe(false);
  });

  it('rifiuta un conteggio sotto il fondo cassa, spiegando cosa fare', () => {
    const e = validaConteggio(7999, MATTINA);
    expect(e.valido).toBe(false);
    if (!e.valido) expect(e.motivo).toContain('fondo cassa');
  });

  it('accetta esattamente il fondo cassa', () => {
    expect(validaConteggio(8000, MATTINA).valido).toBe(true);
  });

  it('accetta un conteggio normale', () => {
    const e = validaConteggio(35500, MATTINA);
    expect(e.valido).toBe(true);
    if (e.valido) expect(e.contatoCent).toBe(35500);
  });
});

describe('serveCausale', () => {
  it('non la chiede per gli spiccioli', () => {
    expect(serveCausale(0)).toBe(false);
    expect(serveCausale(-49)).toBe(false);
    expect(serveCausale(20)).toBe(false);
  });

  it('la chiede da mezzo euro in su, in entrambe le direzioni', () => {
    expect(serveCausale(-50)).toBe(true);
    expect(serveCausale(50)).toBe(true);
    expect(serveCausale(-1500)).toBe(true);
  });
});

describe('segnoDifferenza', () => {
  it('distingue i tre casi', () => {
    expect(segnoDifferenza(0)).toBe('in_pari');
    expect(segnoDifferenza(-150)).toBe('manca');
    expect(segnoDifferenza(150)).toBe('avanza');
  });
});

describe('descriviDurata', () => {
  const da = (iso: string, adesso: string) => descriviDurata(iso, new Date(adesso));

  it('sotto l’ora conta i minuti', () => {
    expect(da('2026-08-08T06:00:00Z', '2026-08-08T06:40:00Z')).toBe('40 min');
  });

  it('sopra l’ora scrive ore e minuti', () => {
    expect(da('2026-08-08T06:00:00Z', '2026-08-08T13:00:00Z')).toBe('7 h');
    expect(da('2026-08-08T06:00:00Z', '2026-08-08T13:25:00Z')).toBe('7 h 25 min');
  });

  it('oltre il giorno conta i giorni', () => {
    expect(da('2026-08-06T06:00:00Z', '2026-08-08T07:00:00Z')).toBe('2 giorni');
    expect(da('2026-08-07T06:00:00Z', '2026-08-08T07:00:00Z')).toBe('1 giorno');
  });

  it('non va mai negativo se l’orologio del telefono è indietro', () => {
    expect(da('2026-08-08T10:00:00Z', '2026-08-08T09:00:00Z')).toBe('0 min');
  });
});

describe('turnoTroppoLungo', () => {
  it('un turno normale non è sospetto', () => {
    expect(turnoTroppoLungo('2026-08-08T06:00:00Z', new Date('2026-08-08T13:00:00Z'))).toBe(false);
  });

  it('uno cominciato ieri sì: vuol dire che qualcuno non ha chiuso', () => {
    expect(turnoTroppoLungo('2026-08-07T14:00:00Z', new Date('2026-08-08T13:00:00Z'))).toBe(true);
  });
});

describe('intestazioneTurno', () => {
  it('scrive l’intervallo come su una scheda', () => {
    const t = intestazioneTurno('2026-08-08T06:00:00+02:00', '2026-08-08T13:00:00+02:00');
    expect(t).toMatch(/→/);
    expect(t.split('→')).toHaveLength(2);
  });
});
