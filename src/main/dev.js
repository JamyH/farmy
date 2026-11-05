// Fehler-Log für alle, dazu Werkzeuge der Entwicklerversion (FarmyDevBuild, nicht übersetzt): Dev-Menü im Tray
// und Devtools-Seite im Hauptfenster, Lastmessung und Rohdaten des Spiels in debug/
const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, config, saveConfig } = require('../app/config');
const updater = require('../app/updater');
const gamewindow = require('../screen/gamewindow');
const { DEV, APP_NAME, DEBUG_DIR, writeDebug, DEV_FLAGS, devFlag, clockOcr } = require('./env');
const { state, refreshMenu } = require('./state');
const windows = require('./windows');
const hud = require('./hud');
const reader = require('./screen-reader');
const review = require('./review');
const updates = require('./updates');
const { DEV_HOTKEYS } = require('./hotkeys');

// Unbehandelte Fehler nach debug/error.log statt die App zu beenden
const LOG_LIMIT = 1024 * 1024; // error.log höchstens 1 MB, dann von vorn (die alte als error.old.log)
function installErrorLog() {
  const logError = (e) => {
    try {
      const file = path.join(DEBUG_DIR, 'error.log');
      if (fs.statSync(file).size > LOG_LIMIT) fs.renameSync(file, path.join(DEBUG_DIR, 'error.old.log'));
    } catch {
      // noch keine Datei
    }
    // z. B. Platte voll: ein Fehler hier im Handler für unbehandelte Fehler beendete sonst die ganze App
    if (!writeDebug('error.log', `${new Date().toISOString()} ${e && e.stack ? e.stack : e}\n`)) console.error(e);
  };
  process.on('unhandledRejection', logError);
  process.on('uncaughtException', logError);
}

// Lastmessung im Spiel: alle 30 s CPU und Speicher je Prozess (Haupt, Overlay, Capture, GPU …) nach debug/perf.log
let perfAt = 0;
let perfCpu = null;
function perfSample() {
  if (!DEV || Date.now() - perfAt < 30000) return;
  const first = !perfCpu;
  const cpu = process.cpuUsage(perfCpu || undefined);
  const secs = (Date.now() - perfAt) / 1000;
  perfAt = Date.now();
  perfCpu = process.cpuUsage();
  const procs = app.getAppMetrics().map((m) => ({
    type: m.type, name: m.name || m.serviceName || '', cpu: Math.round(m.cpu.percentCPUUsage * 10) / 10,
    mb: Math.round(m.memory.workingSetSize / 1024),
  }));
  const row = { t: new Date().toISOString(), procs, ...(first ? {} : { mainJs: Math.round(((cpu.user + cpu.system) / 1e4 / secs) * 10) / 10 }),
    heapMb: Math.round(process.memoryUsage().heapUsed / 1048576), ...reader.hudPerf() };
  writeDebug('perf.log', JSON.stringify(row) + '\n');
}

// Panel-Werte, Layout und Rohdaten der Live-API alle 5 s nach debug/last-game.json (für Nutzer wären 100 KB alle
// 5 s nur Schreiblast)
let lastDump = 0;
function dumpGame(summary, data) {
  if (!DEV || Date.now() - lastDump <= 5000) return;
  lastDump = Date.now();
  const L = hud.regions();
  const json = JSON.stringify({ summary, layout: { gameArea: hud.area(), spells: L && L.spells, factors: L && L.factors }, data }, null, 2);
  if (!writeDebug('last-game.json', json, false)) console.warn('Debug-Datei last-game.json nicht geschrieben');
}

// Dieselben Aktionen im Tray-Untermenü „Dev“ und auf der Devtools-Seite
const ACTIONS = {
  regions: () => reader.toggleDebugRegions(),
  restart: () => { app.relaunch(); app.exit(0); },
  devtoolsOverlay: () => windows.openDevTools('overlay'),
  devtoolsMain: () => windows.openDevTools('main'),
  debugDir: () => { fs.mkdirSync(DEBUG_DIR, { recursive: true }); shell.openPath(DEBUG_DIR); },
  testUpdate: () => updates.test(),
  ...Object.fromEntries(DEV_FLAGS.map(([k]) => [`flag:${k}`, () => {
    saveConfig({ devFlags: { ...config.devFlags, [k]: !devFlag(k) } });
    if (k === 'clockOcr') reader.screenState.clock = null;
    refreshMenu();
  }])),
};

function menuItems() {
  if (!DEV) return [];
  return [{
    label: 'Dev',
    submenu: [
      { label: 'Lese-Bereiche zeigen', type: 'checkbox', checked: reader.debugRegionsOn(), accelerator: DEV_HOTKEYS.debugRegions, click: ACTIONS.regions },
      ...DEV_FLAGS.map(([k, label]) => ({ label, type: 'checkbox', checked: devFlag(k), click: ACTIONS[`flag:${k}`] })),
      { type: 'separator' },
      { label: 'Neu starten', click: ACTIONS.restart },
      { type: 'separator' },
      { label: 'DevTools: Overlay', click: ACTIONS.devtoolsOverlay },
      { label: 'DevTools: Hauptfenster', click: ACTIONS.devtoolsMain },
      { label: 'Debug-Ordner öffnen', click: ACTIONS.debugDir },
      { label: 'Update-Meldung testen', click: ACTIONS.testUpdate },
    ],
  }];
}

// Zustand für die Devtools-Seite
function info() {
  const { screenState } = reader;
  const L = hud.regions();
  const m = hud.foundMinimap();
  const w = gamewindow.rect();
  const ult = review.ultStats();
  return {
    version: `${APP_NAME} ${app.getVersion()} · Electron ${process.versions.electron}`,
    dataDir: DATA_DIR,
    gameArea: w ? `${w.width}×${w.height} bei ${w.x}/${w.y}` : 'kein Spielfenster (ganzer Bildschirm)',
    factors: L ? `Auflösung ×${L.factors.res} · HUD ×${L.factors.hud}` : '–',
    game: state.gameRunning ? `läuft (${state.data ? state.data.gameData.gameMode : '?'})` : 'kein Spiel',
    focused: state.gameRunning ? (windows.gameFocused(false) ? 'ja' : 'nein – Overlay aus, nichts wird gelesen') : '–',
    minimap: m ? `gefunden: ${m.size} px bei ${m.x}/${m.y}` : 'noch nicht gesucht oder nicht gefunden',
    regions: reader.debugRegionsOn(),
    clock: clockOcr() ? `OCR (${screenState.clock == null ? 'noch nicht gelesen' : `${screenState.clock} s`})` : 'Live-API',
    flags: DEV_FLAGS.filter(([k]) => devFlag(k)).map(([, label]) => label).join(' · ') || 'keine',
    deaths: devFlag('deathRecap') ? review.deathSummary() : '–',
    hud: devFlag('fps') ? `FPS ${screenState.fps ?? '–'} · Ping ${screenState.ping ?? '–'} ms` : '–',
    ult: devFlag('ultIdle') ? `${Math.round(ult.total)} s bereit ungenutzt (längste Phase ${Math.round(ult.longest)} s)` : '–',
    update: updater.state().status,
  };
}

function register() {
  installErrorLog();
  ipcMain.handle('dev:action', (_e, name) => DEV && ACTIONS[name] && ACTIONS[name]());
  ipcMain.handle('dev:info', () => (DEV ? info() : null));
  // Entwicklerversion? Fürs Hauptfenster (Name und lila Logo in der Seitenleiste)
  ipcMain.on('app:dev', (e) => {
    e.returnValue = DEV;
  });
}

module.exports = { register, perfSample, dumpGame, menuItems };
