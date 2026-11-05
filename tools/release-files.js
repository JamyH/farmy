// Nach dem Bauen und Signieren: trägt Prüfsumme und Größe des Installers in dist/latest.yml ein (Signieren ändert die
// Datei, und das Auto-Update prüft genau diese Werte) und schreibt dist/release-draft.md für den Release-Entwurf.
// Aufruf: node tools/release-files.js [--signed]
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const DIST = path.join(__dirname, '..', 'dist');
const POLICY = 'https://jamyh.github.io/farmy/code-signing/';
const setup = `Farmy-Setup-${version}.exe`;
const portable = `Farmy-${version}-portable.exe`;
const signed = process.argv.includes('--signed');

const hash = (file, algo, encoding) => crypto.createHash(algo).update(fs.readFileSync(path.join(DIST, file))).digest(encoding);

const yml = path.join(DIST, 'latest.yml');
const before = fs.readFileSync(yml, 'utf8');
if (!before.includes(`url: ${setup}`)) throw new Error(`latest.yml nennt ${setup} nicht`);
const sha512 = hash(setup, 'sha512', 'base64');
const size = fs.statSync(path.join(DIST, setup)).size;
fs.writeFileSync(yml, before
  .replace(/^\s*size: .*\r?\n/gm, '') // ohne Blockmap schreibt electron-builder keine Größe, das Update zeigt sie aber an
  .replace(/^(\s*sha512: ).*$/gm, (_, key) => key + sha512)
  .replace(/^ {4}sha512: .*$/m, (line) => `${line}\n    size: ${size}`));

const warning = signed ? '' : `
Windows SmartScreen may warn because this release is not code-signed: *More info → Run anyway*.
This is a reputation warning for new, unsigned files – not a virus detection.
`;

fs.writeFileSync(path.join(DIST, 'release-draft.md'), `**Download**
- \`${setup}\` – installer with setup wizard (choose folder, desktop and start menu shortcut; per user, no admin rights)
- \`${portable}\` – just run it, nothing is installed
${warning}
Set League to **Borderless** or **Windowed**.

**Already on 1.7.x or later (installer)?** Nothing to do – Farmy finds this update on its own, downloads it in the
background and installs it when you quit (or right away via the tray menu).

**What's new in ${version}**
-

Full list in the [changelog](https://github.com/JamyH/farmy/blob/main/CHANGELOG.md).

**Code signing policy:** free code signing provided by [SignPath.io](https://about.signpath.io), certificate by
[SignPath Foundation](https://signpath.org). Details in the [code signing policy](${POLICY}).

Farmy isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties.

**SHA-256 checksums** (PowerShell: \`Get-FileHash <file>\`)
\`\`\`
${hash(setup, 'sha256', 'hex')}  ${setup}
${hash(portable, 'sha256', 'hex')}  ${portable}
\`\`\`
`);
console.log(`latest.yml und release-draft.md für ${version} geschrieben (${signed ? 'signiert' : 'unsigniert'})`);
