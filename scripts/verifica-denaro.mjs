#!/usr/bin/env node
/**
 * Controllo automatico della regola DEC-04:
 * la divisione per 100 deve comparire in un solo punto del progetto,
 * dentro formatEuro() in lib/dominio/denaro.ts.
 *
 * Lanciato da `npm run verifica:denaro`. Va eseguito prima di ogni commit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RADICE = process.cwd();
const CARTELLE = ['app', 'components', 'lib', 'hooks'];
const ESTENSIONI = ['.ts', '.tsx'];
const FILE_AUTORIZZATO = join('lib', 'dominio', 'denaro.ts');

// cerca "/ 100" e "/100", ma non "/ 1000" e simili
const SOSPETTO = /\/\s*100(?!\d)/;

function* percorriFile(dir) {
  let voci;
  try {
    voci = readdirSync(dir);
  } catch {
    return;
  }
  for (const voce of voci) {
    if (voce === 'node_modules' || voce.startsWith('.')) continue;
    const percorso = join(dir, voce);
    if (statSync(percorso).isDirectory()) {
      yield* percorriFile(percorso);
    } else if (ESTENSIONI.some((e) => voce.endsWith(e))) {
      yield percorso;
    }
  }
}

const violazioni = [];
let occorrenzeAutorizzate = 0;

for (const cartella of CARTELLE) {
  for (const file of percorriFile(join(RADICE, cartella))) {
    const relativo = relative(RADICE, file);
    const righe = readFileSync(file, 'utf8').split('\n');

    righe.forEach((riga, i) => {
      if (riga.trim().startsWith('*') || riga.trim().startsWith('//')) return;
      if (!SOSPETTO.test(riga)) return;

      if (relativo === FILE_AUTORIZZATO || relativo === FILE_AUTORIZZATO.replace(/\\/g, '/')) {
        occorrenzeAutorizzate += 1;
      } else {
        violazioni.push({ file: relativo, riga: i + 1, testo: riga.trim() });
      }
    });
  }
}

if (violazioni.length > 0) {
  console.error('\n❌ Regola DEC-04 violata: divisione per 100 fuori da formatEuro()\n');
  for (const v of violazioni) {
    console.error(`   ${v.file}:${v.riga}`);
    console.error(`      ${v.testo}\n`);
  }
  console.error('   Gli importi sono in centesimi. Per mostrarli usa formatEuro().\n');
  process.exit(1);
}

if (occorrenzeAutorizzate === 0) {
  console.error('\n⚠️  Nessuna divisione per 100 trovata in lib/dominio/denaro.ts.');
  console.error('   formatEuro() è stata modificata? Verifica.\n');
  process.exit(1);
}

if (occorrenzeAutorizzate > 1) {
  console.error(
    `\n⚠️  ${occorrenzeAutorizzate} divisioni per 100 in denaro.ts: dovrebbe essercene una sola.\n`,
  );
  process.exit(1);
}

console.log('✅ DEC-04 rispettata: una sola divisione per 100, dentro formatEuro().');
