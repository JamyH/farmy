// Rechtsseiten der Website aus legal/*.md bauen: docs/impressum/, docs/datenschutz/.
// Die Markdown-Dateien sind die einzige Quelle; nach jeder Änderung dort: node tools/legal-pages.js
// Kleiner Umwandler für das, was diese Texte brauchen: Überschriften, Absätze, Listen, Tabellen, **fett**, *kursiv*,
// `Code` und Links. Solange ENTWURF gilt, sind die Seiten für Suchmaschinen gesperrt (noindex).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENTWURF = true; // nach der Prüfung durch eine Anwältin / einen Anwalt auf false
const PAGES = [
  ['IMPRESSUM.md', 'impressum', 'Impressum'],
  ['DATENSCHUTZ.md', 'datenschutz', 'Datenschutzerklärung'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https:\/\/[^\s)<]+)/g, '$1<a href="$2">$2</a>');
}

function toHtml(md) {
  const out = [];
  const lines = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,3}) (.*)/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.split('|').slice(1, -1).map((c) => inline(c.trim()));
      out.push(`<table><tr>${cells(rows[0]).map((c) => `<th>${c}</th>`).join('')}</tr>` +
        rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</table>');
      continue;
    }
    if (l.startsWith('- ')) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('  '))) {
        if (lines[i].startsWith('- ')) items.push(lines[i].slice(2));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${para.map(inline).join('<br>\n')}</p>`);
  }
  return out.join('\n');
}

const nav = PAGES.map(([, dir, title]) => `<a href="../${dir}/">${title}</a>`).join('\n        ');
for (const [file, dir, title] of PAGES) {
  const body = toHtml(fs.readFileSync(path.join(ROOT, 'legal', file), 'utf8'));
  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Farmy</title>
  ${ENTWURF ? '<meta name="robots" content="noindex">' : ''}
  <link rel="canonical" href="https://jamyh.github.io/farmy/${dir}/">
  <link rel="icon" type="image/png" href="../icon.png">
  <link rel="stylesheet" href="../fonts/fonts.css">
  <link rel="stylesheet" href="../site.css">
</head>
<body>
  <div class="wrap">
    <header>
      <a class="home" href="../de/"><img src="../icon.png" alt="" width="36" height="36"><b>Farmy</b></a>
    </header>
    <main>
      <article class="legal">
${body}
      </article>
    </main>
    <footer>
      <nav>
        <a href="../de/">Start</a>
        ${nav}
        <a href="https://github.com/JamyH/farmy/blob/main/LICENSE">Lizenz (MIT)</a>
      </nav>
    </footer>
  </div>
</body>
</html>
`;
  fs.mkdirSync(path.join(ROOT, 'docs', dir), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', dir, 'index.html'), html.replace(/\r?\n/g, '\r\n'));
  console.log(`docs/${dir}/index.html`);
}
