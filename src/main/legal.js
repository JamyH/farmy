// Rechtliches im Hauptfenster (Seite „legal“, renderer/main-window/legal.js): Version, Riot-Hinweis, MIT-Lizenz und
// Quellcode auf GitHub, Quellen mit Lizenzen (src/data/sources.js) und die Lizenztexte der mitgelieferten Fremd-Software
// (legal/THIRD_PARTY_NOTICES.txt, erzeugt von tools/notices.js).
// Dazu die Schalter der Datenquellen fürs Hauptfenster (app:sources).
const { app, ipcMain, shell } = require('electron');
const path = require('path');
const sources = require('../data/sources');

const REPO = 'https://github.com/JamyH/farmy';
const DOCS = { license: `${REPO}/blob/main/LICENSE`, source: REPO };
// liegt entpackt neben dem App-Archiv (asarUnpack), damit der Texteditor sie öffnen kann
const NOTICES = path.join(__dirname, '..', '..', 'legal', 'THIRD_PARTY_NOTICES.txt').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function info() {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    docs: DOCS,
    sources: sources.list().filter((s) => s.allowed).map(({ name, url, use, license, licenseUrl }) => ({ name, url, use, license, licenseUrl })),
  };
}

function register() {
  ipcMain.on('app:sources', (e) => {
    e.returnValue = sources.flags();
  });
  ipcMain.handle('legal:info', () => info());
  ipcMain.handle('legal:notices', () => shell.openPath(NOTICES));
  // nur Adressen, die diese Seite selbst zeigt
  ipcMain.handle('legal:open', (_e, url) => {
    const i = info();
    const ok = [...Object.values(i.docs), ...i.sources.flatMap((s) => [s.url, s.licenseUrl])].includes(url);
    if (ok) shell.openExternal(url);
  });
}

module.exports = { register };
