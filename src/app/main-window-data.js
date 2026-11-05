// Daten fürs Hauptfenster, die nur Client, eigene Historie und config brauchen (kein Spiel- oder Fensterzustand):
// Verlauf, Fortschritt mit Spielverläufen, Notizen, Session-Ziel und Trainingsplan, Spielersuche, Tierliste.
const { ipcMain } = require('electron');
const { config, saveConfig } = require('./config');
const notes = require('./notes');
const lcu = require('../client/lcu');
const history = require('../client/history');
const archive = require('../client/archive');
const timelines = require('../client/timelines');
const scout = require('../client/scout');
const lobbyskill = require('../client/lobbyskill');
const gamelog = require('../game/gamelog');
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const { t } = require('../../renderer/i18n');

// Spieldetails, die Farmy für die eigenen Spiele ohnehin lädt (voll, nicht aus dem Archiv), auch ins Archiv
const keep = (d) => {
  archive.add(d);
  return d;
};
// Spielverläufe aus dem Client (Tode mit Zeit, Werte bei 10/15 min für dich und deinen Lane-Gegner), nur für
// gemerkte Spiele mit vollständigen Werten, neueste zuerst. Der Lane-Gegner kommt bevorzugt aus dem Spielprotokoll
async function fillTimelines(ids) {
  const me = await lcu.currentSummoner(config.leaguePath);
  const list = ids || history.all().filter((g) => g.cs != null).map((g) => g.id).reverse();
  const opts = { fetch: (p) => lcu.get(config.leaguePath, p).then((d) => (/\/games\/\d+$/.test(p) ? keep(d) : d)), puuid: me.puuid, opp: (id) => (gamelog.get(id) || {}).oppChamp,
    roles: (id) => (gamelog.get(id) || {}).roles || null };
  // je Durchgang höchstens 25 Spiele; ohne feste Liste weiter, bis alles geladen ist
  let total = 0;
  for (let n = 25; n >= 25 && !(ids && total);) {
    n = await timelines.fill(list, opts);
    total += n;
  }
  return total;
}

// Arena-Augments mit Namen in Client-Sprache, für die Arena-Auswertung im Fortschritt (neuere haben auch IDs ab 1000).
// Einmal je Start aus den Spieldaten des Clients; ohne Client leer (dann stehen dort die IDs)
let arenaAugCache = null;
async function arenaAugNames() {
  if (!arenaAugCache) {
    try {
      const list = await lcu.cherryAugments(config.leaguePath);
      arenaAugCache = Object.fromEntries((list || []).filter((a) => a.nameTRA).map((a) => [a.id, a.nameTRA]));
    } catch {
      return {};
    }
  }
  return arenaAugCache;
}

// IPC-Handler einmal beim Start anmelden; toMainWindow(channel) schickt eine Nachricht ans Hauptfenster
function register({ toMainWindow }) {
  // Tierliste im Hauptfenster (lolalytics, einen Tag gecacht), dazu deine eigenen Spiele je Champ auf dieser
  // Lane bzw. im ARAM aus der Historie. Lanes wie bei lolalytics: top, jungle, middle, bottom, support, aram
  ipcMain.handle('tier:list', async (_e, mode) => {
    const tier = await lolalytics.tierList(mode);
    const own = {};
    for (const g of history.all()) {
      const lane = g.lane === 'utility' ? 'support' : g.lane;
      if (mode === 'aram' ? g.map !== 12 : g.map !== 11 || lane !== mode) continue;
      const o = (own[g.champ] = own[g.champ] || { games: 0, wins: 0 });
      o.games++;
      if (g.win) o.wins++;
    }
    const rows = Object.entries(tier.champs).map(([key, s]) => ({ key, ...ddragon.champion(key), ...s, own: own[key] || null }));
    return { url: tier.url, fetchedAt: tier.fetchedAt, rows };
  });
  ipcMain.handle('main-window:eog', async () => lcu.endOfGame(config.leaguePath));
  ipcMain.handle('main-window:history', async () => {
    const h = await lcu.matchHistory(config.leaguePath, 20);
    history.add(h);
    return h;
  });
  // Reiter „Fortschritt“: alle selbst gemerkten Spiele (nicht nur die 20 des Clients); vorher die neuesten übernehmen
  ipcMain.handle('main-window:progress', async () => {
    try {
      history.add(await lcu.matchHistory(config.leaguePath, 20));
      // Spielverläufe dauern ~0,25 s je Spiel: im Hintergrund nachladen, das Fenster zeichnet danach neu
      fillTimelines().then((n) => n && toMainWindow('progress:update')).catch((e) => console.warn('Spielverläufe:', e.message));
    } catch {
      // Client aus: dann eben nur die schon gemerkten Spiele
    }
    return { games: history.all(), lp: gamelog.lpHistory(), goal: config.goal || null, goalHistory: config.goalHistory || [], plan: config.trainingPlan || null,
      timelines: timelines.all(), logs: gamelog.all(), augNames: await arenaAugNames() };
  });
  // Eigene Notizen je Champion (Reiter „Notizen“, Anzeige in „Build & Runen“)
  ipcMain.handle('notes:all', () => notes.all());
  ipcMain.handle('notes:set', (_e, key, text) => notes.set(key, text));
  ipcMain.handle('notes:learn', (_e, key, entry) => notes.learn(key, entry));
  // „Letztes Spiel“: Farmys Protokoll zu diesem Spiel, dazu die Historie als Vergleich
  ipcMain.handle('main-window:review', async (_e, gameId) => {
    await fillTimelines([gameId]).catch(() => {});
    return { log: gamelog.get(gameId), tl: timelines.get(gameId), games: history.all(), goal: config.goal || null };
  });
  // Session-Ziel (wie eine Challenge): eins zur Zeit, Ergebnis je Spiel für Serie und Quote
  ipcMain.handle('goal:set', (_e, goal) => {
    // das bisherige Ziel kommt in den Ziel-Verlauf (nur, wenn damit gespielt wurde)
    const old = config.goal;
    const past = old && old.results && old.results.length ? [...(config.goalHistory || []), { ...old, until: Date.now() }].slice(-30) : config.goalHistory || [];
    saveConfig({ goal: goal ? { ...goal, since: Date.now(), results: [] } : null, goalHistory: past });
    return config.goal;
  });
  ipcMain.handle('goal:history', () => config.goalHistory || []);
  // Trainingsplan (Fortschritt): Aufgaben und Startzeit; ob geschafft, rechnet das Fenster aus den Spielen aus
  ipcMain.handle('plan:set', (_e, plan) => {
    saveConfig({ trainingPlan: plan || null });
    return config.trainingPlan;
  });
  ipcMain.handle('goal:result', (_e, gameId, ok) => {
    const g = config.goal;
    if (!g || g.results.some((r) => String(r.gameId) === String(gameId))) return g;
    saveConfig({ goal: { ...g, results: [...g.results, { gameId, ok, at: Date.now() }].slice(-50) } });
    return config.goal;
  });
  ipcMain.handle('main-window:summoner', async () => lcu.currentSummoner(config.leaguePath));
  // „Name#Tag“ -> Spieler oder null (nicht gefunden); ohne Tag sucht der Client nicht
  ipcMain.handle('player:find', (_e, riotId) => {
    const [gameName, tagLine] = String(riotId || '').split('#').map((s) => s.trim());
    if (!gameName || !tagLine) throw new Error(t('Bitte als Name#Tag eingeben, z. B. Faker#KR1.'));
    return lcu.findPlayer(config.leaguePath, gameName, tagLine).then((p) => p && archive.extend(p));
  });
  // Profil: die 20 Spiele des Clients plus ältere aus Farmys Archiv (src/client/archive.js)
  ipcMain.handle('player:get', async (_e, puuid) => archive.extend(await lcu.playerByPuuid(config.leaguePath, String(puuid))));
  // Skill-Einschätzung: Spieldetails seiner echten Spiele laden (je ~0,25 s, daher 4 gleichzeitig) und gegen die Lobby werten
  ipcMain.handle('player:skill', async (_e, puuid, gameIds) =>
    lobbyskill.rate(await scout.gameDetails(config.leaguePath, gameIds), String(puuid)));
  // Alle Spieler eines Spiels (Verlauf: Spiel aufklappen)
  ipcMain.handle('main-window:game', (_e, gameId) => archive.details(config.leaguePath, gameId));
  ipcMain.handle('ddragon:champion', (_e, id) => ddragon.champion(id));
  ipcMain.handle('ddragon:version', () => ddragon.getVersion());
}

module.exports = { register, fillTimelines, keep };
