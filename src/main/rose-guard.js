// FarmyDevBuild: Absturz-Schutz für Custom-Skin-Mods in Rose. Passt ein Mod nicht zum aktuellen Patch, stürzt das
// Spiel beim Laden ab, der Client startet es neu, Rose spielt den Mod wieder ein – eine Schleife (01.11.: Sion Kaido).
// Erkennung aus Rose' Log: nach „PREPARING INJECTION >>> <Mod> (SKIN_…) <<<“ hängt sich der Patcher an das Spiel
// („injected dll attached“) und das Spiel ist nach wenigen Sekunden schon wieder weg („exited dll detached“).
// Zweimal hintereinander -> Injection über Rose' eigene Schnittstelle stoppen (stop-injection, dafür hat Rose sie)
// und den Mod aus Rose' Mods-Ordner nach <Datenordner>\runeforge\deaktiviert schieben. Nichts wird gelöscht.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { balloon } = require('./state');
const rose = require('./rose');

const DEV = !app.isPackaged;
const QUICK_EXIT_MS = 20 * 1000; // so schnell beendet sich kein echtes Spiel
const CRASHES = 2;
const deactivated = []; // { name, from, to, at }, neueste zuerst (für die Rose-Karte)
let handled = null; // Zeitpunkt der zuletzt bearbeiteten Injection, damit jede nur einmal zählt
let since = Infinity; // nur Injections ab Farmy-Start (eine Minute Puffer), alte Abstürze im Log sind erledigt

const time = (line) => Date.parse(line.slice(0, 19).replace(' ', 'T'));

// Letzte Custom-Mod-Injection im Log und wie oft das Spiel danach sofort wieder weg war
function analyse(log) {
  const lines = log.split(/\r?\n/);
  let start = -1;
  for (let i = lines.length - 1; i >= 0 && start < 0; i--) if (/PREPARING INJECTION >>> .+ \(SKIN_\d+\) <<</.test(lines[i])) start = i;
  if (start < 0) return null;
  const run = { at: lines[start].slice(0, 19), name: lines[start].match(/>>> (.+) \(SKIN_\d+\) <<</)[1], mods: null, file: null, crashes: 0 };
  let attached = null;
  for (const line of lines.slice(start + 1)) {
    let m;
    if ((m = line.match(/\[INJECT\] Re-extracting custom mod from: (.+)$/))) run.file = m[1].trim();
    else if ((m = line.match(/\[INJECT\] Injecting mods: (.+) for skin \d+/))) run.mods = m[1].split(', ');
    else if (/LTK patcher: injected dll attached/.test(line)) attached = time(line);
    else if (/LTK patcher: exited dll detached/.test(line) && attached) {
      if (time(line) - attached < QUICK_EXIT_MS) run.crashes++;
      else run.crashes = 0; // ein Spiel lief normal
      attached = null;
    } else if (/Game ended|PREPARING INJECTION/.test(line)) break;
  }
  return run;
}

// Mod-Datei/-Ordner finden: Pfad aus dem Log, sonst nach Namen unter mods\skins\<Champion>\
function modPath(run) {
  const root = path.join(rose.DATA, 'mods');
  if (run.file && run.file.startsWith(root) && fs.existsSync(run.file)) return run.file;
  for (const dir of fs.readdirSync(path.join(root, 'skins'))) {
    const d = path.join(root, 'skins', dir);
    const hit = fs.statSync(d).isDirectory() && fs.readdirSync(d).find((f) => path.parse(f).name === run.name || f === run.name);
    if (hit) return path.join(d, hit);
  }
  return null;
}

// Rose' Bridge (127.0.0.1:<state\bridge_port.txt>): dieselbe Nachricht wie Rose' Knopf auf dem Reconnect-Bildschirm
function stopInjection() {
  return new Promise((resolve) => {
    try {
      const port = Number(fs.readFileSync(path.join(rose.DATA, 'state', 'bridge_port.txt'), 'utf8').trim());
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const done = (ok) => (clearTimeout(timer), ws.close(), resolve(ok));
      const timer = setTimeout(() => done(false), 3000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'stop-injection' }));
      ws.onmessage = (e) => {
        const msg = (() => { try { return JSON.parse(e.data); } catch { return {}; } })();
        if (msg.type === 'injection-stopped') done(!!msg.success);
      };
      ws.onerror = () => done(false);
    } catch {
      resolve(false);
    }
  });
}

async function check() {
  if (!rose.DATA) return;
  const run = analyse(rose.logTail());
  if (!run || run.crashes < CRASHES || run.at === handled || time(run.at) < since) return;
  handled = run.at;
  const stopped = await stopInjection();
  // mehrere Mods zusammen eingespielt (Skin + Karte …): unklar, welcher schuld ist -> nur melden
  if (run.mods && run.mods.length > 1) {
    return balloon('Spiel stürzt mit Mods ab', `${run.mods.join(', ')}: ${stopped ? 'Injection gestoppt' : 'in Rose „Injection stoppen“'} – Mods einzeln testen`);
  }
  const from = modPath(run);
  if (!from) return balloon('Spiel stürzt mit Mod ab', `${run.name}: Datei nicht gefunden, bitte in Rose entfernen`);
  const dir = path.join(app.getPath('userData'), 'runeforge', 'deaktiviert');
  fs.mkdirSync(dir, { recursive: true });
  let to = path.join(dir, path.basename(from));
  for (let n = 2; fs.existsSync(to); n++) to = path.join(dir, `${path.parse(from).name} (${n})${path.extname(from)}`);
  // verschieben über Laufwerke hinweg (Rose auf C:, Farmy auf D:): erst kopieren, dann das Original weg
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true });
  deactivated.unshift({ name: run.name, from, to, at: Date.now() });
  balloon('Mod deaktiviert', `${run.name} lässt das Spiel abstürzen – aus Rose genommen${stopped ? ', Injection gestoppt' : ''}`);
}

function start() {
  if (!DEV) return; // niemals in der gebauten App
  since = Date.now() - 60 * 1000;
  setInterval(() => check().catch((e) => console.warn('Rose-Absturzschutz:', e.message)), 3000);
}

function register() {
  if (!DEV) return;
  ipcMain.handle('rose:deactivated', () => deactivated);
}

module.exports = { register, start, analyse, modPath };
