// Stream-Deck-Brücke für das Farmy-Plugin (streamdeck/), nur von diesem PC aus erreichbar:
// - GET  http://127.0.0.1:<port>/stats   Panel-Werte des laufenden Spiels, dazu Session, Overlay-Stand, Auto-Accept
// - POST http://127.0.0.1:<port>/action  { id, … } für die Knöpfe (Overlay, Hauptfenster, Marke, Build, Auto-Accept)
// Nur Werte, die Farmy ohnehin zeigt (Riot-Regeln). Port in config.deck.port, ausschalten mit config.deck.enabled = false.
const http = require('http');
const { config, saveConfig, overlaySettings } = require('../app/config');
const gamelog = require('../game/gamelog');
const { state, refreshMenu } = require('./state');
const windows = require('./windows');
const client = require('./client');
const champselect = require('./champselect');

const DEFAULT_PORT = 47101;
// Antwort-Format; das Plugin prüft es, damit ein altes Plugin bei einer neuen Farmy-Version nichts Falsches zeigt
const VERSION = 2;
// Grenzen wie die Regler im ⚙ des Overlays (renderer/overlay/settings.js)
const ADJUST = { scale: { min: 0.7, max: 1.5, step: 0.05 }, bgTransparency: { min: 0, max: 90, step: 5 } };
// Reiter, die ein Knopf öffnen darf (ids aus renderer/main-window/app.js)
const TABS = ['live', 'eog', 'build', 'wiki', 'history', 'progress', 'notes'];

let game = null; // Spielwerte aus publish(), null ohne Spiel

// Aus dem Panel-Objekt (game.js) nur das, was das Plugin braucht: klein und unabhängig vom Aufbau des Overlays
function publish(summary) {
  if (!summary) {
    game = null;
    return;
  }
  const spells = {};
  for (const s of summary.spells || []) spells[s.key] = { name: s.name, ready: !!s.ready, cd: s.cd };
  const mins = Math.max(summary.gameTime / 60, 1);
  game = {
    champion: summary.champion,
    gameTime: Math.floor(summary.gameTime),
    dead: !!summary.isDead,
    level: summary.level,
    xpPercent: summary.xp ? summary.xp.percent : null,
    xpWaves: summary.xp ? Number(summary.xp.waves) : null,
    gold: summary.gold,
    kda: summary.kda,
    kdaRatio: Number(summary.kdaRatio),
    cs: summary.cs,
    csExact: !!summary.csExact,
    csPerMin: Number(summary.csPerMin),
    csTarget: summary.csTarget ? summary.csTarget.perMin : null,
    vision: summary.wardScore,
    visionPerMin: Math.round(((summary.wardScore || 0) / mins) * 10) / 10,
    mana: summary.mana ? { percent: summary.mana.percent, low: summary.mana.low } : null,
    spells,
    // Aktiv-Items (Zhonya, Stoppuhr, QSS …) mit Taste und Restzeit, wie die Kacheln im Panel
    items: (summary.itemCds || []).filter((it) => it.active).map((it) => ({ key: it.key, name: it.name, ready: it.ready, cd: it.cd })),
    goal: summary.goal ? { key: summary.goal.key, target: summary.goal.target, now: summary.goal.now, ok: summary.goal.ok, early: summary.goal.early } : null,
    clear: summary.clear || null,
  };
}

function stats() {
  const o = overlaySettings();
  return {
    v: VERSION,
    inGame: !!game,
    ...game,
    phase: state.phase,
    session: client.session(),
    autoAccept: config.autoAccept === true,
    overlay: { hidden: windows.ui().hidden, clickThrough: o.clickThrough, compact: o.compact, scale: o.scale, bgTransparency: o.bgTransparency },
  };
}

// Knöpfe. Antwort { ok, message }; ok: false lässt die Taste ein Warndreieck zeigen
const ACTIONS = {
  overlay: () => {
    windows.toggleOverlay();
    return { ok: true };
  },
  clickThrough: () => ({ ok: true, settings: windows.setOverlay({ clickThrough: !overlaySettings().clickThrough }, true) }),
  compact: () => ({ ok: true, settings: windows.setOverlay({ compact: !overlaySettings().compact }, true) }),
  // Drehregler: Größe bzw. Hintergrund-Transparenz um ticks Stufen
  adjust: ({ key, ticks }) => {
    const r = ADJUST[key];
    if (!r || !Number.isFinite(ticks)) return { ok: false, message: 'unbekannter Regler' };
    const v = Math.min(r.max, Math.max(r.min, Math.round((overlaySettings()[key] + ticks * r.step) / r.step) * r.step));
    windows.setOverlay({ [key]: Math.round(v * 100) / 100 }, true);
    return { ok: true };
  },
  main: ({ tab }) => {
    windows.openMainWindow(TABS.includes(tab) ? { tab } : {});
    return { ok: true };
  },
  mark: () => (game && gamelog.mark(game.gameTime) ? { ok: true } : { ok: false, message: 'kein Spiel' }),
  // Champ-Auswahl: eigene Runen setzen und Item-Set in den Client; eins von beiden reicht für ok
  build: async () => {
    if (state.phase !== 'ChampSelect' || !state.champion) return { ok: false, message: 'keine Champ-Auswahl' };
    const done = await Promise.allSettled([champselect.applyRunesFor(state.champion), champselect.importItemSet(state.champion)]);
    const ok = done.filter((d) => d.status === 'fulfilled');
    return { ok: ok.length > 0, message: done.map((d) => (d.status === 'fulfilled' ? d.value : d.reason.message)).join(' ') };
  },
  autoAccept: () => {
    saveConfig({ autoAccept: config.autoAccept !== true });
    refreshMenu(); // Häkchen im Tray-Menü mitziehen
    return { ok: true };
  },
};

// Nur Anfragen an 127.0.0.1/localhost annehmen: eine Webseite im Browser, die per DNS-Rebinding auf den Port
// zeigt, schickt einen fremden Host-Kopf. Kein CORS-Kopf, damit Seiten die Antwort auch sonst nicht lesen können;
// Aktionen nur mit JSON-Körper, den ein Formular einer Webseite nicht ohne CORS-Freigabe schicken kann
function localHost(req, port) {
  const host = String(req.headers.host || '').toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}
const reply = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handle(req, res, port) {
  if (!localHost(req, port)) return reply(res, 404, {});
  if (req.method === 'GET' && req.url === '/stats') return reply(res, 200, stats());
  if (req.method === 'POST' && req.url === '/action' && /^application\/json/.test(req.headers['content-type'] || '')) {
    let msg;
    try {
      msg = JSON.parse(await readBody(req));
    } catch {
      return reply(res, 400, { ok: false, message: 'kein JSON' });
    }
    const run = ACTIONS[msg && msg.id];
    if (!run) return reply(res, 404, { ok: false, message: 'unbekannte Aktion' });
    try {
      return reply(res, 200, await run(msg));
    } catch (e) {
      return reply(res, 200, { ok: false, message: e.message });
    }
  }
  return reply(res, 404, {});
}

function start() {
  const cfg = config.deck || {};
  if (cfg.enabled === false) return;
  const port = Number(cfg.port) || DEFAULT_PORT;
  const server = http.createServer((req, res) => {
    handle(req, res, port).catch((e) => reply(res, 500, { ok: false, message: e.message }));
  });
  // Port belegt (anderes Programm): Farmy läuft normal weiter, nur das Stream Deck bleibt leer
  server.on('error', (e) => console.warn('Stream-Deck-Brücke:', e.message));
  server.listen(port, '127.0.0.1');
}

module.exports = { start, publish };
