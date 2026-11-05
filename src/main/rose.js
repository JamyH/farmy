// FarmyDevBuild-Begleiter für Rose (quelloffenes Custom-Skin-Tool, github.com/Alban1911/Rose): Rose starten/beenden
// (auf Wunsch mit Farmy), Status zeigen, den Mods-Ordner öffnen und aus Rose' eigenem Log und seiner Fehlerdatei
// lesen, welcher Skin vorbereitet wurde und ob die Injection geklappt hat.
//
// NUR Entwicklerversion. Die gebaute App bindet Rose nie an (register() tut dort nichts): Rose verändert das Spiel
// per Injection, das verstößt gegen Riots Regeln und würde die Riot-Freigabe kosten. Farmy *steuert*
// hier nur ein bereits installiertes Rose an – es injiziert selbst nichts und liefert weder Rose noch Skins mit.
const { app, ipcMain, shell, dialog, BrowserWindow } = require('electron');
const { execFile, execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config, saveConfig } = require('../app/config');
const { state } = require('./state');

const DEV = !app.isPackaged;
const DOWNLOAD = 'https://github.com/Alban1911/Rose/releases';
// Rose' Datenordner (Log, Mods, Fehlerdatei), unabhängig vom Installationsort
const DATA = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Rose') : null;
const LOG_TAIL = 64 * 1024; // Rose loggt viel (~200 KB in 15 min), für den Status reicht das Ende

const cfg = () => config.rose || {};
const exists = (p) => {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
};

// Der Rose-Installer trägt sich unter „Apps“ ein; dort steht Rose.exe als DisplayIcon, egal wohin installiert
// wurde (z. B. D:\Rose)
const UNINSTALL_KEYS = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'];
function fromRegistry() {
  for (const key of UNINSTALL_KEYS) {
    try {
      const out = execFileSync('reg', ['query', key, '/s', '/f', 'Rose.exe', '/d'], { windowsHide: true, encoding: 'latin1' });
      for (const m of out.matchAll(/REG_SZ\s+"?([^"\r\n]*\\Rose\.exe)/gi)) if (exists(m[1])) return m[1];
    } catch {
      // Schlüssel fehlt oder kein Treffer (reg endet dann mit Fehlercode)
    }
  }
  return null;
}

// Rose.exe finden: erst der eingetragene Pfad, sonst der Apps-Eintrag, zuletzt ein paar übliche Installationsorte.
// Der Fund wird gemerkt, die Devtools-Seite fragt alle 2 s nach dem Status
let detected = null;
function autodetectExe() {
  if (exists(detected)) return detected;
  detected = fromRegistry();
  if (detected) return detected;
  const dirs = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean);
  const rel = ['Rose\\Rose.exe', 'Programs\\Rose\\Rose.exe', 'Rose\\dist\\Rose\\Rose.exe'];
  for (const d of dirs) for (const r of rel) {
    const p = path.join(d, r);
    if (exists(p)) return (detected = p);
  }
  return null;
}
const exePath = () => (exists(cfg().exe) ? cfg().exe : autodetectExe());
// Mods-Ordner: eingetragen, sonst der Datenordner von Rose (%LOCALAPPDATA%\Rose\mods), sonst der Rose-Ordner
function modsPath() {
  if (exists(cfg().mods)) return cfg().mods;
  const data = DATA && path.join(DATA, 'mods');
  if (exists(data)) return data;
  const exe = exePath();
  return exe ? path.dirname(exe) : null;
}

// Läuft Rose? Unter Windows über die Prozessliste, nach dem Exe-Namen
function running() {
  return new Promise((resolve) => {
    const exe = exePath();
    if (!exe) return resolve(false);
    const image = path.basename(exe);
    execFile('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], { windowsHide: true }, (err, out) => {
      resolve(!err && String(out).toLowerCase().includes(image.toLowerCase()));
    });
  });
}

// Ende des neuesten Rose-Logs (logs\rose_<Datum>.log)
function logTail() {
  try {
    const dir = path.join(DATA, 'logs');
    // nur das Haupt-Log (rose_01-11-2026_…), nicht rose_runoverlay_… vom Patcher
    const newest = fs.readdirSync(dir).filter((f) => /^rose_\d.*\.log$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    if (!newest) return '';
    const fd = fs.openSync(path.join(dir, newest.f), 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const buf = Buffer.alloc(Math.min(size, LOG_TAIL));
      fs.readSync(fd, buf, 0, buf.length, size - buf.length);
      return buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

// „SKIN_33016“ / „HEXTECH-RAMMUS“ lesbar machen
const skinName = (s) => (/^SKIN_\d+$/.test(s) ? `Skin ${s.slice(5)}` : s.toLowerCase().replace(/(^|[-\s])\S/g, (c) => c.toUpperCase()));

// Letzte Injection aus dem Log (threads/handlers/injection_trigger.py): „PREPARING INJECTION >>> SKIN_X <<<“, dann
// „[LOADNAME] the loading screen will show 'Name'“ und bei Erfolg „[INJECT] Overlay ready“ (Spiel läuft weiter,
// der Patcher spielt den Skin ein); „(CUSTOM MOD) INJECTION COMPLETED/FAILED >>> X <<<“ schreibt Rose nur manchmal
function injection(log) {
  let last = null;
  const re = /^(\S+ \S+) \|[^|]*\| (?:(PREPARING INJECTION|(?:CUSTOM MOD )?INJECTION (?:COMPLETED|FAILED)) >>> (.+?) <<<|\[LOADNAME\] the loading screen will show '(.+)'|\[INJECT\] (Overlay ready))/gm;
  for (const [, at, event, label, loadName, ready] of log.matchAll(re)) {
    if (event === 'PREPARING INJECTION') last = { at, skin: skinName(label), result: 'läuft' };
    else if (!last) continue;
    else if (loadName) last.skin = loadName;
    else if (ready || event.endsWith('COMPLETED')) last.result = 'ok';
    else last.result = 'fehlgeschlagen';
  }
  const phase = [...log.matchAll(/\| Phase: (\w+)/g)].pop();
  return { injection: last, phase: phase ? phase[1] : null };
}

// Rose' eigene Fehlerdiagnose (rose_diagnostics.txt: „Nov 01 10:03 | Injection failed: …“ + Zeile „Fix: …“).
// Rose lässt die Datei nach einem Fehler stehen; hat danach eine Injection geklappt, ist sie überholt
function diagnostics(last) {
  try {
    const file = path.join(DATA, 'rose_diagnostics.txt');
    const solved = last && last.result === 'ok' && Date.parse(last.at.replace(' ', 'T')) > fs.statSync(file).mtimeMs;
    return solved ? null : fs.readFileSync(file, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

async function status() {
  const exe = exePath();
  const log = injection(DATA ? logTail() : '');
  return {
    installed: !!exe, exe, mods: modsPath(), running: await running(), champion: state.champion || null, download: DOWNLOAD,
    autostart: cfg().autostart !== false, ...log, problem: DATA ? diagnostics(log.injection) : null,
  };
}

function launch() {
  const exe = exePath();
  if (!exe) return;
  // losgelöst starten, Rose läuft danach eigenständig weiter (auch wenn Farmy zugeht). Rose verlangt Adminrechte;
  // ohne Admin-Farmy scheitert der Start (Fehler 740) – darum kein Absturz, nur Log
  const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' });
  child.on('error', (e) => console.warn('Rose starten:', e.message));
  child.unref();
}
function stop() {
  const exe = exePath();
  if (exe) execFile('taskkill', ['/IM', path.basename(exe), '/F', '/T'], { windowsHide: true }, () => {});
}

async function pick(kind) {
  const win = BrowserWindow.getFocusedWindow();
  const opts = kind === 'exe'
    ? { title: 'Rose.exe wählen', filters: [{ name: 'Programm', extensions: ['exe'] }], properties: ['openFile'] }
    : { title: 'Rose-Mods-Ordner wählen', properties: ['openDirectory'] };
  const r = await dialog.showOpenDialog(win, opts);
  if (!r.canceled && r.filePaths[0]) saveConfig({ rose: { ...cfg(), [kind === 'exe' ? 'exe' : 'mods']: r.filePaths[0] } });
  return status();
}

function register() {
  if (!DEV) return; // niemals in der gebauten App
  ipcMain.handle('rose:status', () => status());
  ipcMain.handle('rose:start', async () => (launch(), status()));
  ipcMain.handle('rose:autostart', (e, on) => (saveConfig({ rose: { ...cfg(), autostart: !!on } }), status()));
  ipcMain.handle('rose:stop', async () => (stop(), status()));
  ipcMain.handle('rose:openMods', () => {
    const m = modsPath();
    if (m) shell.openPath(m);
  });
  ipcMain.handle('rose:pickExe', () => pick('exe'));
  ipcMain.handle('rose:pickMods', () => pick('mods'));
  ipcMain.handle('rose:download', () => shell.openExternal(DOWNLOAD));
}

// Rose mit Farmy starten (Schalter „Mit Farmy starten“, Standard an), falls es nicht schon läuft
async function start() {
  if (!DEV || cfg().autostart === false || !exePath()) return;
  if (!(await running())) launch();
}

module.exports = { register, start, logTail, DATA };
