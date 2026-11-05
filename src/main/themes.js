// Stile (Menü → Stil): der eingebaute Look (HUD, in main-window.css und overlay.css) und eigene der Nutzer aus
// <Datenordner>/themes/<Ordner>/. Ein eigener Stil braucht nur eine theme.json (Farben, Schrift, Hintergrundbild); wer mehr will, legt main.css bzw. overlay.css dazu. Die Dateien liefert das Protokoll
// farmy-theme:// aus (nur aus dem themes-Ordner). Angewendet wird alles in renderer/theme.js, beim Wechsel live
// ohne Neuladen (Kanal „theme“), damit die Stil-Auswahl im Hauptfenster offen bleiben kann.
const { app, ipcMain, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { DATA_DIR, config, saveConfig } = require('../app/config');
const windows = require('./windows');
const { refreshMenu } = require('./state');

// [id, Name, Hintergrund und Akzent für die Vorschau in der Stil-Auswahl]
const BUILTIN = [['', 'Standard', ['#0a0d12', '#c8aa6e']]];
const USER_PREFIX = 'eigen:';
const DIR = path.join(DATA_DIR, 'themes');
const SCHEME = 'farmy-theme';

// muss vor app.ready stehen: „standard“, damit url(…) und @import in eigenen Dateien relativ funktionieren
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true } }]);

// Werte aus theme.json landen als CSS im Fenster: nur harmlose Zeichen durchlassen
const safeName = (s) => /^[a-z0-9-]{1,40}$/i.test(s);
const safeValue = (v) => typeof v === 'string' && v.length <= 120 && !/[;{}<>\\]/.test(v);
function cleanColors(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj && typeof obj === 'object' ? obj : {})) if (safeName(k) && safeValue(v)) out[k] = v;
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// eigene Stile: jeder Unterordner mit theme.json
function userThemes() {
  let dirs = [];
  try {
    dirs = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  return dirs.map((folder) => ({ folder, json: readJson(path.join(DIR, folder, 'theme.json')) })).filter((x) => x.json)
    .map(({ folder, json }) => ({ id: USER_PREFIX + folder, folder, label: String(json.name || folder).slice(0, 40), json }));
}

function current() {
  const id = config.theme || '';
  if (BUILTIN.some(([b]) => b === id)) return id;
  return userThemes().some((u) => u.id === id) ? id : '';
}

// Was renderer/theme.js braucht: eigener Ordner, Farben, Schrift, Hintergrund
function info() {
  const id = current();
  const user = userThemes().find((u) => u.id === id);
  if (!user) return {};
  const j = user.json;
  const has = (f) => fs.existsSync(path.join(DIR, user.folder, f));
  const bg = typeof j.background === 'string' && !/[\\/]|\.\./.test(j.background) && has(j.background) ? j.background : null;
  return {
    v: Date.now(), // neu anwenden lädt geänderte eigene Dateien statt der zwischengespeicherten
    url: `${SCHEME}://t/${encodeURIComponent(user.folder)}/`,
    mainCss: has('main.css'),
    overlayCss: has('overlay.css'),
    colors: cleanColors(j.colors),
    overlayColors: cleanColors(j.overlayColors),
    // Schrift: Datei im Stil-Ordner (.woff2/.woff/.ttf/.otf) oder Name einer auf dem PC installierten Schrift.
    // Nichts wird aus dem Netz geladen (keine IP-Adresse an Schrift-Anbieter)
    fontFile: typeof j.font === 'string' && /^[\w .-]{1,60}\.(woff2?|ttf|otf)$/i.test(j.font) && !j.font.includes('..') && has(j.font) ? j.font : null,
    font: typeof j.font === 'string' && /^[a-z0-9 ]{1,40}$/i.test(j.font) ? j.font : null,
    background: bg,
    backgroundDim: Math.min(1, Math.max(0, Number(j.backgroundDim ?? 0.6))),
  };
}

// beide Fenster bekommen den Stil live, ohne Neuladen
const broadcast = () => {
  windows.toOverlay('theme', info());
  windows.toMainWindow('theme', info());
};

// Wer an seinem Stil baut, sieht Änderungen sofort: der Ordner des aktiven eigenen Stils wird beobachtet
let watcher = null;
function watchActive() {
  if (watcher) watcher.close();
  watcher = null;
  const user = userThemes().find((u) => u.id === current());
  if (!user) return;
  let timer = null;
  try {
    watcher = fs.watch(path.join(DIR, user.folder), () => {
      clearTimeout(timer);
      timer = setTimeout(broadcast, 300);
    });
  } catch {
    // Ordner weg: dann eben ohne Beobachten
  }
}

function set(id) {
  if (id === current() || !list().some((x) => x.id === id)) return;
  saveConfig({ theme: id });
  watchActive();
  refreshMenu();
  broadcast();
}

// für die Stil-Auswahl im Hauptfenster: eingebaute und eigene, mit Farben für die Vorschau
function list() {
  return [
    ...BUILTIN.map(([id, label, colors]) => ({ id, label, colors, own: false })),
    ...userThemes().map((u) => {
      const [bg, accent] = BUILTIN[0][2];
      const c = cleanColors(u.json.colors);
      return { id: u.id, label: u.label, colors: [c.bg || bg, c.accent || accent], own: true };
    }),
  ];
}

// Beispiel-Stil beim ersten Öffnen, damit man sieht, wie es geht
const EXAMPLE = path.join(app.getAppPath(), 'renderer', 'themes', 'beispiel');
function openFolder() {
  fs.mkdirSync(DIR, { recursive: true });
  // Datei für Datei: fs.cpSync kann nicht aus dem App-Archiv (app.asar) der installierten Version lesen
  if (!fs.readdirSync(DIR).length) {
    fs.mkdirSync(path.join(DIR, 'beispiel'));
    for (const f of fs.readdirSync(EXAMPLE)) fs.writeFileSync(path.join(DIR, 'beispiel', f), fs.readFileSync(path.join(EXAMPLE, f)));
  }
  shell.openPath(DIR);
}

function reread() {
  watchActive();
  refreshMenu();
  broadcast();
}

// Untermenü „Stil“ fürs Tray- und ☰-Menü (schließt sich bei jedem Klick, daher auch die Auswahl im Hauptfenster)
function menu(t) {
  const id = current();
  const radio = (value, label) => ({ label, type: 'radio', checked: id === value, click: () => set(value) });
  const own = userThemes();
  return [
    ...BUILTIN.map(([value, label]) => radio(value, t(label))),
    ...(own.length ? [{ type: 'separator' }, ...own.map((u) => radio(u.id, u.label))] : []),
    { type: 'separator' },
    { label: t('Eigene Stile öffnen …'), click: openFolder },
    { label: t('Stile neu einlesen'), click: reread },
  ];
}

function register() {
  ipcMain.on('app:theme', (e) => {
    e.returnValue = info();
  });
  ipcMain.handle('theme:list', () => ({ current: current(), themes: list() }));
  ipcMain.handle('theme:set', (_e, id) => set(String(id)));
  ipcMain.handle('theme:folder', () => openFolder());
  ipcMain.handle('theme:reread', () => reread());
}

// nach app.ready: Dateien eigener Stile ausliefern, nie etwas außerhalb des themes-Ordners
function start() {
  protocol.handle(SCHEME, (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.resolve(DIR, rel);
    if (!file.startsWith(DIR + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  watchActive();
}

module.exports = { register, start, menu };
