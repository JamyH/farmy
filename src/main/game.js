// Laufendes Spiel (Live-API, alle config.pollMs): Panel-Werte zusammenstellen und ans Overlay schicken,
// Spielstart und -ende erkennen, Spielprotokoll mitschreiben. Dazu die Live-Spiel-Daten fürs Hauptfenster.
const { ipcMain } = require('electron');
const { config, moduleOn } = require('../app/config');
const setup = require('../app/setup');
const lcu = require('../client/lcu');
const scout = require('../client/scout');
const history = require('../client/history');
const live = require('../game/live');
const gamelog = require('../game/gamelog');
const clears = require('../game/clears');
const threat = require('../game/threat');
const clock = require('../screen/clock');
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const arammayhem = require('../data/arammayhem');
const jungle = require('../data/jungle');
const ocr = require('../screen/ocr');
const capture = require('../screen/screengrab');
const { t } = require('../../renderer/i18n');
const { devFlag, clockOcr } = require('./env');
const { state, balloon } = require('./state');
const windows = require('./windows');
const hud = require('./hud');
const reader = require('./screen-reader');
const review = require('./review');
const scoreboard = require('./scoreboard');
const champselect = require('./champselect');
const dev = require('./dev');
const deck = require('./deck');

async function poll() {
  const data = await live.fetchGame();
  if (data) state.gameMode = data.gameData.mapNumber === 12 ? 'aram' : 'sr';
  const apiTime = data ? data.gameData.gameTime : 0;
  const { screenState } = reader;
  // Dev-Schalter „Spielzeit per OCR“: die Uhr vom Bildschirm statt der Zeit der Live-API (Practice Tool: dort
  // springt bzw. steht die Uhr), gegen Lesefehler abgesichert (src/screen/clock.js). Alles Weitere (CS/min,
  // Clear-Zeit …) rechnet damit
  if (data && clockOcr()) {
    data.gameData.gameTime = clock.update(screenState.clock, screenState.clockAt, apiTime, data.gameData.gameMode === 'PRACTICETOOL');
  }
  const summary = data
    ? live.applySkills(
        live.applyBuild(live.applyMana(live.applyScreen(live.summarize(data), screenState, config.minionXp), config.mana), champselect.buildFor),
        (champId) => (champselect.suggestionsOn() ? lolalytics.cached(champId, state.gameMode) : null),
      )
    : null;
  if (summary && !state.gameRunning) gameStarted(data, summary, apiTime);
  if (!summary && state.gameRunning) gameEnded();
  state.gameRunning = !!summary;
  state.data = data;
  if (!summary) {
    liveRanks = null; // Ränge gelten nur für das jeweilige Spiel
    state.items = [];
    state.blueSpells = {};
    state.dead = false;
  } else {
    dev.perfSample();
    if (summary.championId) state.champion = summary.championId;
    // Mayhem: Augment-Tiers für den Champ bereitlegen, bevor das erste Angebot kommt
    if (data.gameData.gameMode === 'KIWI') arammayhem.prepare(state.champion);
    state.items = summary.myItems;
    state.blueSpells = summary.blueSpells;
    logGame(summary, data);
    state.dead = !!summary.isDead;
    addPanelData(summary, data, apiTime);
    // Lese-Bereiche (Dev) jede Sekunde, auch wenn das Lesen gerade pausiert (z. B. Hauptfenster vorne)
    if (reader.debugRegionsOn()) reader.sendDebugRegions();
  }
  if (data) dev.dumpGame(summary, data);
  deck.publish(summary);
  windows.showGame(summary);
}

function gameStarted(data, summary, apiTime) {
  hud.refresh(); // HUD-Skalierung könnte sich geändert haben
  reader.resetGame();
  clock.reset();
  review.start();
  threat.reset();
  if (data.gameData.gameMode !== 'PRACTICETOOL') {
    gamelog.start({ champ: Number(ddragon.championKey(summary.championId)), map: summary.map, mode: data.gameData.gameMode,
      at: Date.now() - apiTime * 1000 });
    lcu.gameflowSession(config.leaguePath).then((x) => gamelog.setGameId(x && x.gameData && x.gameData.gameId)).catch(() => {});
  }
  windows.closeUnusedMainWindow();
  warnFullscreen();
  startWatch();
}
function gameEnded() {
  gamelog.finish(review.finish());
  scoreboard.stop();
  capture.stop();
  ocr.release().catch(() => {});
}
// Bildschirmaufnahme (falls die Erkennung läuft) und Tastenabfrage fürs laufende Spiel; auch beim App-Start,
// wenn die Erkennung erst nach dem ersten Spiel-Abruf bereit ist
function startWatch() {
  if (state.screenReading) capture.start().catch((e) => console.warn('Bildschirmaufnahme:', e.message));
  scoreboard.start(); // Tastenkürzel immer; Tab-Scoreboard nur mit Bildschirm-Erkennung (Prüfung dort)
}

// Echtes Vollbild: kein Fenster kann über dem Spiel liegen, und die Bildschirmaufnahme bleibt meist schwarz.
// Ins Spiel einklinken wäre bannbar, also nur ein Hinweis bei Spielstart.
function warnFullscreen() {
  if (setup.readWindowMode(config.leaguePath) !== 0) return;
  balloon(t('League läuft im Vollbild'), t('Dort ist das Overlay nicht zu sehen. Im Spiel: Einstellungen → Video → Fenstermodus „Randlos“.'));
}

// Spielprotokoll: Tode mit Gold, Lane-Gegner und Rollen (state.dead ist hier noch der Stand vom letzten Abruf)
function logGame(summary, data) {
  if (summary.isDead && !state.dead) gamelog.died(summary.gameTime, (data.activePlayer && data.activePlayer.currentGold) || 0);
  if (summary.laneOpponent && summary.laneOpponent.id) gamelog.opponent(ddragon.championKey(summary.laneOpponent.id));
  if (summary.position) gamelog.role(summary.position);
  // Rollen aller Spieler (nur Spiele mit Rollen); rawChampionName ist der zuverlässige interne Name
  if (summary.position && data.allPlayers) {
    const map = {};
    for (const p of data.allPlayers) {
      const id = ddragon.rawChampionId(p.rawChampionName);
      const key = id && ddragon.championKey(id);
      if (key && p.position && p.position !== 'NONE') map[key] = p.position.toLowerCase();
    }
    gamelog.roles(map);
  }
}

// Alles, was das Panel über die Live-API hinaus zeigt (Bildschirm, eigene Historie, Module im ⚙)
function addPanelData(summary, data, apiTime) {
  const { screenState } = reader;
  const rift = summary.map === 11;
  summary.scoreboard = live.scoreboard(data);
  summary.augments = screenState.augments || null;
  summary.jungleRoute = jungleRouteFor(summary);
  summary.quest = rift && moduleOn('quest') ? screenState.quest : null;
  if (rift) addRiftExtras(summary, data);
  // Gegner-Team (Kluft und ARAM): Schadensart, CC, Heilung und Item-Optionen dagegen
  summary.threat = (rift || summary.map === 12) && moduleOn('threat') ? threat.assess(data, config.leaguePath) : null;
  const spawn = minionSpawn(data, apiTime);
  if (rift && devFlag('perfectCs')) summary.csMax = perfectCs(summary.gameTime, spawn);
  gamelog.tick(summary, rift ? perfectCs(600, spawn) : null);
  summary.goal = goalNow(summary);
  // Ward (Trinket-Slot, Taste 4) als Kachel wie Summoner und Items; null = aus
  const trinket = rift && moduleOn('ward') && summary.myItems.find((it) => it.slot === 6);
  summary.ward = trinket ? { key: '4', name: trinket.name, icon: ddragon.iconUrl('item', trinket.id),
    ready: screenState.ward == null, cd: screenState.ward ?? null } : null;
}

// Session-Ziel im Panel: aktueller Stand gegen das Ziel (nur auf der Map, für die es gesetzt wurde)
// key: deaths (höchstens), csm, kda, vision (Sicht/min) jeweils mindestens
function goalNow(s) {
  const g = config.goal;
  if (!g || !moduleOn('goal') || (g.map && g.map !== s.map)) return null;
  const [k, d, a] = String(s.kda).split('/').map(Number);
  const mins = Math.max(s.gameTime / 60, 1);
  const now = { deaths: d, csm: Number(s.csPerMin), kda: (k + a) / Math.max(d, 1), vision: (s.wardScore || 0) / mins }[g.key];
  if (now == null || Number.isNaN(now)) return null;
  const ok = g.key === 'deaths' ? now <= g.target : now >= g.target;
  // Raten wie CS/min sind die ersten Minuten noch nicht aussagekräftig
  return { key: g.key, target: g.target, now, ok, early: g.key !== 'deaths' && s.gameTime < 300 };
}

// Perfekt-CS: alle Vasallen der Wellen, die bis jetzt an der Lane angekommen sind. Wellen alle 30 s ab dem
// ersten Spawn (Live-API-Ereignis „MinionsSpawning“, sonst 1:05), rund 30 s Laufweg; je Welle 3 Nahkampf + 3 Fernkampf,
// Kanone jede 3. Welle bis 14:00, jede 2. bis 25:00, danach jede. Näherung: Quellen nennen auch 15 bzw. 20 min.
// Ergibt 107 bei 10:00 (der übliche Richtwert)
function perfectCs(time, spawn) {
  let cs = 0;
  for (let n = 0, s = spawn; s + 30 <= time; n++, s += 30) cs += 6 + (s >= 1500 || (s >= 840 ? n % 2 === 1 : n % 3 === 2) ? 1 : 0);
  return cs;
}
// Spawn in angezeigter Zeit: mit „Spielzeit per OCR“ weicht die Uhr von der API-Zeit ab (Practice Tool)
function minionSpawn(data, apiTime) {
  const ev = ((data.events || {}).Events || []).find((e) => e.EventName === 'MinionsSpawning');
  return ev ? ev.EventTime - (apiTime - data.gameData.gameTime) : 65;
}

// Summoner's Rift: CS-Ziel, erste Runde im Jungle (Clear-Zeit) und Lane-Stand für die Gank-Priorität
let clearShown = null; // { time, cs, until (Spielzeit) }: fertig gemessene Runde, eine Weile im Panel
function addRiftExtras(summary, data) {
  // CS-Ziel: eigener Schnitt auf dem Champ (ab 3 Spielen), sonst config.csTarget (Standard 8/min)
  if (moduleOn('csTarget')) {
    const own = history.csPerMin(Number(ddragon.championKey(summary.championId)));
    summary.csTarget = { perMin: Math.round((own || config.csTarget || 8) * 10) / 10, own: !!own };
  }
  if (!summary.smite) return;
  // Clear-Zeit: aus den genauen CS (Bildschirm), sonst API
  if (moduleOn('clear')) {
    const done = clears.track(summary.championId, summary.gameTime, summary.cs);
    if (done) clearShown = { ...done, until: summary.gameTime + 90 };
    if (clearShown && summary.gameTime < clearShown.until) {
      const st = clears.stats(summary.championId);
      summary.clear = { time: clearShown.time, cs: clearShown.cs, best: st && st.count > 1 ? st.best : null };
    } else clearShown = null;
  }
  if (moduleOn('gank')) summary.lanes = live.lanes(data);
}

// Jungle-Route auf der Minimap: nur mit Smite auf Summoner's Rift; das Overlay zeigt sie nur, solange Tab gedrückt ist.
// Zeigt einen vorher festgelegten Plan (Startcamp aus dem Hauptfenster, sonst die neueste Route),
// keine Informationen aus dem Spiel
let jungleRoutes = { champ: null, routes: null };
function jungleRouteFor(summary) {
  if (!summary.smite || summary.map !== 11 || !moduleOn('jungleRoute')) return null;
  const champ = summary.championId;
  if (jungleRoutes.champ !== champ) {
    jungleRoutes = { champ, routes: null };
    jungle.routes(ddragon.champion(ddragon.championKey(champ)).name)
      .then((d) => { if (jungleRoutes.champ === champ) jungleRoutes.routes = d.routes; })
      .catch((e) => console.warn('Jungle-Route:', e.message));
  }
  const list = jungleRoutes.routes;
  if (!list) return null;
  const start = (config.jungleStart || {})[champ];
  const pick = list.find((r) => r.route[0] === start) || list[0];
  const m = hud.minimapRect();
  return { x: hud.toDip(m.x), y: hud.toDip(m.y), size: hud.toDip(m.size), side: summary.side, route: pick.route };
}

// Live-Spiel-Reiter: Ränge einmal pro Spiel laden (10 Anfragen an den Client), danach aus dem Speicher
let liveRanks = null;
let liveScout = new Map(); // Schlüssel aus live.playerKeys() -> { tags, group, with } aus src/client/scout.js (Hinweise und Premades)
async function loadRanks() {
  liveRanks = new Map();
  liveScout = new Map();
  try {
    const players = await lcu.gamePlayers(config.leaguePath);
    // Hinweise und Premades laden ihre Spiellisten im Hintergrund, die Ränge kommen davon unabhängig
    const random = ['ARAM', 'KIWI', 'CHERRY'].includes(state.data && state.data.gameData.gameMode);
    scout.live(config.leaguePath, players, !random).then((m) => {
      const id = (key) => ddragon.champion(key).id;
      for (const p of players) {
        const v = m.get(p.puuid);
        if (!v) continue;
        const entry = { ...v, with: v.with.map((w) => ({ id: id(w.key), n: w.n })) };
        for (const key of live.playerKeys(p, players)) liveScout.set(key, entry);
      }
    }, (e) => console.warn('Live-Hinweise:', e.message));
    await Promise.all(
      players.filter((p) => p.puuid).map(async (p) => {
        const rank = await lcu.soloRank(config.leaguePath, p.puuid).catch(() => null);
        for (const key of live.playerKeys(p, players)) liveRanks.set(key, rank || { unranked: true });
      })
    );
  } catch (e) {
    console.warn('Ränge:', e.message);
  }
}

function start() {
  setInterval(poll, config.pollMs);
}

function register() {
  ipcMain.handle('live:data', () => {
    if (!state.gameRunning || !state.data) return null;
    if (!liveRanks) loadRanks(); // läuft im Hintergrund, kommt beim nächsten Abruf mit
    return live.livePlayers(state.data, liveRanks || new Map(), liveScout);
  });
}

module.exports = { register, start, startWatch };
