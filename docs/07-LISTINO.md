# Listino del locale

> Dati reali forniti dal titolare. Da eseguire su Supabase **dopo** lo schema di `02-MODELLO-DATI.md`.
> Stato: **listino sostanzialmente completo**. Restano poche voci da confermare (vedi §5).

---

## 1. Il listino così com'è

### Caffetteria

| Bevanda | Normale | Decaffeinato | Alta digeribilità | A.D. decaffeinato | Altre |
|---|---|---|---|---|---|
| Caffè | 1,20 | 1,30 | — | — | corretto 1,70 |
| Caffè macchiato | 1,30 | 1,40 | — | — | — |
| Cappuccino | 1,70 | 1,80 | 2,00 | 2,10 | ginseng 2,00 |
| Latte macchiato | 1,80 | 1,90 | 2,00 | 2,10 | — |
| Caffellatte | 1,80 | 1,90 | 2,00 | 2,10 | — |
| Ginseng | 1,70 | — | — | — | — |
| Marocchino | 2,00 | — | — | — | — |
| Tè caldo | 1,70 | — | — | — | — |
| Cioccolata | 2,50 | — | — | — | con panna 2,70 |

### Acque

| Prodotto | Prezzo |
|---|---|
| Acqua al bicchiere | 0,30 |
| Acqua in bottiglia — naturale | 1,00 |
| Acqua in bottiglia — frizzante | 1,00 |
| Acqua con sciroppo | 1,50 |

### Bibite

| Prodotto | Prezzo |
|---|---|
| Succo di frutta | 2,50 |
| Lattina | 2,50 |
| Estathé brik | 2,00 |
| Red Bull | 3,00 |

### Birre

| Birra | 0,33 | 0,66 | Altre |
|---|---|---|---|
| Ichnusa | 1,70 | 2,70 | al limone 0,33 → 2,50 |
| Heineken | 2,50 | 3,50 | — |
| Beck's | 2,50 | 3,50 | — |
| Tuborg | 2,50 | 3,50 | — |
| Tennent's | 3,00 | — | — |
| Corona | 3,50 | — | — |

### Aperitivi

| Prodotto | Prezzo |
|---|---|
| Bitter | 2,50 |
| Crodino | 2,50 |
| Campari soda | 3,00 — con aggiunta (es. martini) 3,50 |
| Bicicletta | 3,00 |
| Spritz | 5,00 |
| Drink | 5,00 |

### Vini al calice

| Variante | Prezzo |
|---|---|
| Rosso | 3,00 |
| Bianco | 3,00 |
| Prosecco | 3,00 |
| Vermentino | 3,50 |

### Superalcolici

| Prodotto | Prezzo |
|---|---|
| Amaro | 3,00 |
| Superalcolico — baby | 3,00 |
| Superalcolico — normale | 3,50 |
| Rum Zacapa | 5,00 |

### Food

| Prodotto | Prezzo |
|---|---|
| Pasta | 1,50 |
| Pizzetta sfoglia | 1,50 |

---

**59 prodotti vendibili, 34 riquadri nella griglia.**

Senza il modello a varianti (§3.4 di `02-MODELLO-DATI.md`) la griglia avrebbe 59 riquadri e sarebbe inutilizzabile su un telefono. Con il raggruppamento, ogni categoria sta in una schermata sola:

| Categoria | Prodotti | Riquadri |
|---|---|---|
| Caffetteria | 23 | 9 |
| Acque | 4 | 3 |
| Bibite | 4 | 4 |
| Birre | 11 | 6 |
| Aperitivi | 7 | 6 |
| Vini | 4 | 1 |
| Superalcolici | 4 | 3 |
| Food | 2 | 2 |
| **Totale** | **59** | **34** |

### Regolarità osservate nel listino

Non sono regole imposte dal sistema — i prezzi restano scritti uno per uno — ma servono a capire la struttura e a evitare errori di battitura:

- **Decaffeinato: +0,10** su tutte le bevande calde, senza eccezioni.
- **Alta digeribilità: +0,30** sul cappuccino, **+0,20** su latte macchiato e caffellatte.
- **Birre:** la 0,66 costa 1,00 in più della 0,33 (Ichnusa e le tre "standard" a 2,50). Ichnusa è la birra "base" a prezzo più basso; Tennent's e Corona sono fuori scala perché vendute solo in 0,33.
- **Aggiunte agli aperitivi: +0,50.** Vale sul Campari soda ed è ragionevole estenderla ad altre basi se serve.
- Il **corretto** (+0,50 sul caffè) non è una variante di prezzo ma un prodotto a sé: ha un ingrediente in più.

---

## 2. Il caso dei vini: una scelta di raggruppamento

I quattro vini al calice sono modellati come **un solo riquadro** ("Vino al calice") con quattro varianti, invece di quattro riquadri separati.

**Perché:** occupano una posizione sola nella griglia invece di quattro, e la domanda del barista è sempre nella stessa forma — "un calice, di cosa?". Il costo è un tap in più per ordinare un vino, il guadagno è tre posizioni libere in griglia per prodotti che si vendono di più.

**Quando riconsiderarlo:** se la carta dei vini cresce oltre le 6-7 etichette, il pannello varianti diventa un elenco lungo e conviene una schermata dedicata. Con quattro etichette il pannello è perfetto.

Lo stesso ragionamento **non** si applica alle birre, che restano un riquadro per marca: lì la scelta è di marca e i formati sono le varianti, che è come il cliente ordina davvero ("una Heineken piccola").

---

## 3. SQL di caricamento

```sql
-- ============================================
-- CATEGORIE
-- ============================================
insert into categorie (nome, colore, ordine) values
  ('Caffetteria',   '#8b5a3c', 1),
  ('Acque',         '#0891b2', 2),
  ('Bibite',        '#2563eb', 3),
  ('Food',          '#16a34a', 4),
  ('Birre',         '#ca8a04', 5),
  ('Aperitivi',     '#dc2626', 6),
  ('Vini',          '#7e22ce', 7),
  ('Superalcolici', '#b45309', 8)
on conflict (nome) do nothing;

-- ============================================
-- CAFFETTERIA
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  -- base,             variante,                         cent, preferito, ordine
  ('Caffè',            'normale',                         120, true,  1),
  ('Caffè',            'decaffeinato',                    130, true,  1),
  ('Caffè',            'corretto',                        170, true,  1),

  ('Caffè macchiato',  'normale',                         130, true,  2),
  ('Caffè macchiato',  'decaffeinato',                    140, true,  2),

  ('Cappuccino',       'normale',                         170, true,  3),
  ('Cappuccino',       'decaffeinato',                    180, true,  3),
  ('Cappuccino',       'alta digeribilità',               200, true,  3),
  ('Cappuccino',       'alta digeribilità decaffeinato',  210, true,  3),
  ('Cappuccino',       'ginseng',                         200, true,  3),

  ('Latte macchiato',  'normale',                         180, false, 4),
  ('Latte macchiato',  'decaffeinato',                    190, false, 4),
  ('Latte macchiato',  'alta digeribilità',               200, false, 4),
  ('Latte macchiato',  'alta digeribilità decaffeinato',  210, false, 4),

  ('Caffellatte',      'normale',                         180, false, 5),
  ('Caffellatte',      'decaffeinato',                    190, false, 5),
  ('Caffellatte',      'alta digeribilità',               200, false, 5),
  ('Caffellatte',      'alta digeribilità decaffeinato',  210, false, 5),

  ('Ginseng',          'normale',                         170, false, 6),
  ('Marocchino',       'normale',                         200, false, 7),
  ('Tè caldo',         'normale',                         170, false, 8),
  ('Cioccolata',       'normale',                         250, false, 9),
  ('Cioccolata',       'con panna',                       270, false, 9)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Caffetteria';

-- ============================================
-- ACQUE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Acqua bicchiere',    'normale',    30, true,  1),
  ('Acqua bottiglia',    'naturale',  100, true,  2),
  ('Acqua bottiglia',    'frizzante', 100, true,  2),
  ('Acqua con sciroppo', 'normale',   150, false, 3)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Acque';

-- ============================================
-- BIBITE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Succo di frutta', 'normale', 250, false, 1),
  ('Lattina',         'normale', 250, false, 2),
  ('Estathé brik',    'normale', 200, false, 3),
  ('Red Bull',        'normale', 300, false, 4)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Bibite';

-- ============================================
-- FOOD
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Pasta',            'normale', 150, true, 1),
  ('Pizzetta sfoglia', 'normale', 150, true, 2)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Food';

-- ============================================
-- BIRRE
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Ichnusa',   '0,33',           170, false, 1),
  ('Ichnusa',   '0,66',           270, false, 1),
  ('Ichnusa',   'al limone 0,33', 250, false, 1),

  ('Heineken',  '0,33',           250, false, 2),
  ('Heineken',  '0,66',           350, false, 2),

  ('Becks',     '0,33',           250, false, 3),
  ('Becks',     '0,66',           350, false, 3),

  ('Tuborg',    '0,33',           250, false, 4),
  ('Tuborg',    '0,66',           350, false, 4),

  ('Tennents',  '0,33',           300, false, 5),
  ('Corona',    '0,33',           350, false, 6)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Birre';

-- ============================================
-- APERITIVI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Bitter',       'normale',      250, false, 1),
  ('Crodino',      'normale',      250, false, 2),
  ('Campari soda', 'normale',      300, false, 3),
  ('Campari soda', 'con aggiunta', 350, false, 3),
  ('Bicicletta',   'normale',      300, false, 4),
  ('Spritz',       'normale',      500, true,  5),
  ('Drink',        'normale',      500, false, 6)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Aperitivi';

-- ============================================
-- VINI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Vino al calice', 'rosso',      300, false, 1),
  ('Vino al calice', 'bianco',     300, false, 1),
  ('Vino al calice', 'prosecco',   300, false, 1),
  ('Vino al calice', 'vermentino', 350, false, 1)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Vini';

-- ============================================
-- SUPERALCOLICI
-- ============================================
insert into prodotti (categoria_id, nome_base, variante, prezzo_cent, preferito, ordine)
select c.id, v.base, v.variante, v.prezzo, v.pref, v.ord
from (values
  ('Amaro',          'normale', 300, false, 1),
  ('Superalcolico',  'baby',    300, false, 2),
  ('Superalcolico',  'normale', 350, false, 2),
  ('Rum Zacapa',     'normale', 500, false, 3)
) as v(base, variante, prezzo, pref, ord)
join categorie c on c.nome = 'Superalcolici';
```

### Nota sui nomi delle marche

Nel database le birre sono scritte senza apostrofi né accenti: `Becks`, `Tennents`. Non è pigrizia: gli apostrofi dentro le stringhe SQL vanno raddoppiati (`'Beck''s'`) e sono una fonte inesauribile di errori quando qualcuno copia e incolla o modifica il listino a mano.

Se preferisci vederli scritti correttamente nell'interfaccia, si cambia dall'app dopo il caricamento — lì l'apostrofo non crea problemi.

### Verifica dopo il caricamento

```sql
-- devono uscire 59 righe
select count(*) from prodotti;

-- devono uscire 34 riquadri
select count(*) from v_griglia_prodotti;

-- riquadri per categoria: 9, 3, 4, 6, 6, 1, 3, 2
select categoria, count(*) as riquadri, sum(jsonb_array_length(varianti)) as prodotti
from v_griglia_prodotti
group by categoria, categoria_ordine
order by categoria_ordine;

-- controllo visivo dei prezzi
select nome, prezzo_cent / 100.0 as euro
from prodotti order by categoria_id, ordine, prezzo_cent;
```

---

## 4. Come si comporta la griglia con le varianti

La schermata del conto (§5 di `04-UX-MOBILE.md`) mostra **un riquadro per prodotto base**, non uno per prezzo:

```
┌────────┬────────┬────────┐
│ Caffè  │ Caffè  │Cappucc.│
│ 1,20 ▾ │macchia.│ 1,70 ▾ │      ▾ = ha varianti
│        │ 1,30 ▾ │        │
├────────┼────────┼────────┤
│Ichnusa │Heineken│ Vino   │
│ 1,70 ▾ │ 2,50 ▾ │calice  │
│        │        │ 3,00 ▾ │
└────────┴────────┴────────┘
```

**Tap breve** = variante normale (o la più economica, se non esiste una variante chiamata `normale`), addebitata subito. È il caso del 90%: un tap, niente scelte.

**Tap sul ▾ oppure pressione prolungata** = si apre la scelta delle varianti:

```
┌───────────────────────────┐
│ Ichnusa                   │
│  0,33               1,70  │
│  al limone 0,33     2,50  │
│  0,66               2,70  │
└───────────────────────────┘
```

Un tap sulla variante la addebita e chiude il pannello. Costo totale: due tap invece di uno, solo quando serve.

**Nell'elenco del conto la variante è sempre scritta per esteso** — "Ichnusa 0,66", non "Ichnusa". Quando il cliente contesta il conto, deve poter leggere esattamente cosa ha preso.

### Regola per i prodotti senza variante `normale`

Birre e vini non hanno una variante chiamata `normale`: hanno `0,33`, `rosso`, e così via. La regola per il tap breve è quindi: **si addebita la variante `normale` se esiste, altrimenti la meno costosa**. Sul riquadro compare il prezzo di quella variante.

Funziona bene perché nella pratica la versione più economica è anche la più venduta: la birra piccola, il vino della casa.

### L'alternativa dell'interruttore fisso

Esiste una variante di questo disegno: un interruttore **DECA** appiccicato in alto alla griglia che, quando attivo, fa sì che ogni tap addebiti la versione decaffeinata. Vantaggio: per il cliente che ordina due decaffeinati di fila si risparmiano tap. Svantaggio serio: è uno stato invisibile e appiccicoso, e prima o poi qualcuno addebita un decaffeinato a chi non l'ha chiesto perché l'interruttore era rimasto acceso.

Il consiglio è di **non** implementarlo in Fase 1. Se dopo qualche settimana d'uso i due tap risultano fastidiosi, si aggiunge — con spegnimento automatico dopo ogni riga.

---

## 5. Cosa resta da confermare

Voci probabili che non sono state ancora indicate:

- **Cornetti e brioche** — quasi certamente li vendi, ma non sono nel listino. Con quali farciture e a che prezzo?
- **Tramezzini, panini, tranci di pizza**
- **Gelati o dolci confezionati**
- **Aperitivo con buffet** (se lo fate, di solito ha un prezzo a sé)
- **Caffè in vetro / al ginseng in tazza grande**, se hanno prezzi distinti
- **Amari e superalcolici per marca:** oggi sono due voci generiche ("Amaro 3,00", "Superalcolico baby/normale"). Va benissimo per battere i conti, ma se in Fase 3 vuoi il magazzino delle bottiglie serviranno le marche come varianti.
- **Le "aggiunte" oltre il Campari soda:** la regola +0,50 vale solo lì o anche su bitter, crodino, bicicletta?

Ogni voce nuova si aggiunge con un `insert` sulla categoria giusta: il caricamento è ripetibile, non serve rifare niente.

Nota sulle paste: se "pasta" indica genericamente il dolce da banco a 1,50 va bene così. Se ci sono tipi con prezzi diversi (cannolo, sfogliatella, bignè), diventano varianti come il decaffeinato.

---

## 6. Manutenzione del listino nel tempo

- Un ritocco di prezzo si fa dall'app (schermata Listino) e vale **solo per il futuro** (DEC-05). I conti già aperti mantengono i prezzi con cui sono stati battuti.
- Un prodotto che smette di essere venduto si **disattiva**, non si cancella: lo storico deve restare leggibile.
- Una variante nuova si aggiunge come riga nuova sullo stesso `nome_base` e compare automaticamente nel pannello delle varianti.
- I `preferito` vanno rivisti dopo un mese di uso reale, guardando le vendite effettive invece che le impressioni:

```sql
select r.descrizione, sum(r.quantita) as pezzi
from righe_conto r
where r.creato_il > now() - interval '30 days'
group by r.descrizione
order by pezzi desc
limit 15;
```

Oggi sono segnati preferiti 8 riquadri: Caffè, Caffè macchiato, Cappuccino, Acqua bicchiere, Acqua bottiglia, Pasta, Pizzetta sfoglia, Spritz. Sono un'ipotesi ragionevole, non un dato: la query sopra dirà la verità.

---

**Documenti collegati:** `02-MODELLO-DATI.md` §3.4 (modello a varianti), `04-UX-MOBILE.md` §5 (griglia).
