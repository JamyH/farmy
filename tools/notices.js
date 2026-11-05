// Lizenztexte aller mitgelieferten Fremd-Software in legal/THIRD_PARTY_NOTICES.txt sammeln: die npm-Pakete, die
// in die App kommen (ohne Entwicklungs-Pakete), dazu Schriften und OCR-Sprachdaten. Electron und Chromium legt
// electron-builder selbst neben die Exe (LICENSE.electron.txt, LICENSES.chromium.html).
// Vor jedem Release ausführen: node tools/notices.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'legal', 'THIRD_PARTY_NOTICES.txt');

// alle Pakete im Produktions-Baum (auch verschachtelte Versionen)
function packages() {
  const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
  const seen = new Map();
  (function walk(deps, dir) {
    for (const [name, d] of Object.entries(deps || {})) {
      const pkgDir = [path.join(dir, 'node_modules', name), path.join(ROOT, 'node_modules', name)].find((p) => fs.existsSync(path.join(p, 'package.json')));
      if (!pkgDir) continue;
      const key = `${name}@${d.version}`;
      if (!seen.has(key)) seen.set(key, pkgDir);
      walk(d.dependencies, pkgDir);
    }
  })(tree.dependencies, ROOT);
  return [...seen].sort(([a], [b]) => a.localeCompare(b));
}

function licenseText(dir) {
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : null;
}

const parts = [
  'Farmy enthält folgende Fremd-Software und -Daten. Farmy contains the following third-party software and data.',
  'Electron und Chromium: siehe LICENSE.electron.txt und LICENSES.chromium.html im Programmordner.',
];
for (const [key, dir] of packages()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const text = licenseText(dir);
  parts.push(`${'='.repeat(78)}\n${key} (${pkg.license || 'siehe Text'})${pkg.homepage ? `\n${pkg.homepage}` : ''}\n\n${text || `Lizenz: ${pkg.license}`}`);
}
parts.push(`${'='.repeat(78)}\nBarlow, Barlow Condensed (SIL Open Font License 1.1)\n\n${fs.readFileSync(path.join(ROOT, 'renderer', 'fonts', 'OFL.txt'), 'utf8').trim()}`);
parts.push(`${'='.repeat(78)}\nTesseract OCR eng.traineddata, tessdata_best (Apache License 2.0)\nhttps://github.com/tesseract-ocr/tessdata_best\n\n${fs.readFileSync(path.join(ROOT, 'assets', 'tessdata', 'LICENSE'), 'utf8').trim()}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${parts.join('\n\n')}\n`.replace(/\r?\n/g, '\r\n'));
console.log(`${OUT}: ${packages().length} Pakete`);
