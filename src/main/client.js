// League-Client abfragen (alle 3 s): Phase, Champ-Auswahl, eigener Verlauf nach dem Spiel, Session von heute.
// Dazu Auto-Accept (jede Sekunde in der Queue).
const { ipcMain } = require('electron');
const { config, saveConfig } = require('../app/config');
const { fillTimelines, keep } = require('../app/main-window-data');
const lcu = require('../client/lcu');
const history = require('../client/history');
const gamelog = require('../game/gamelog');
const augments = require('../game/augments');
const ddragon = require('../data/ddragon');
const { t } = require('../../renderer/i18n');
const { state, balloon } = require('./state');
const { openMainWindow, toMainWindow } = require('./windows');
const champselect = require('./champselect');

async function poll() {
  const phase = await lcu.gameflowPhase(config.leaguePath);
  const last = state.phase;
  if (!historyImported && phase !== null) importHistory();
  // das gerade beendete Spiel steht oft erst nach ein paar Sekunden im Verlauf
  if (last === 'EndOfGame' && phase !== 'EndOfGame') importHistory();
  if (phase === 'EndOfGame' && last !== 'EndOfGame') {
    if (config.autoOpenAfterGame) openMainWindow({ auto: true });
    // ein schon offenes Fenster lädt „Letztes Spiel“ sonst erst über „Neu laden“ (03.11.); nach 5 s noch einmal,
    // falls der Client die Endspiel-Daten beim Phasenwechsel noch nicht hatte
    toMainWindow('eog:ready');
    setTimeout(() => toMainWindow('eog:ready'), 5000);
    setTimeout(importHistory, 10000);
  }
  if (phase === 'ChampSelect') await champselect.update();
  else champselect.leave();
  state.phase = phase;
}

// Endbuilds der letzten Spiele in den eigenen Verlauf übernehmen (Client kennt nur 20)
let historyImported = false;
let backfilled = false; // alte Einträge einmal je Start aus den Spieldetails ergänzen
async function importHistory() {
  try {
    const h = await lcu.matchHistory(config.leaguePath, 20);
    if (history.add(h)) toMainWindow('history:items');
    historyImported = true;
    fillTimelines().then((n) => n && toMainWindow('progress:update')).catch((e) => console.warn('Spielverläufe:', e.message));
    if (!backfilled) {
      backfilled = true;
      lcu.currentSummoner(config.leaguePath)
        .then((me) => history.backfill((id) => lcu.get(config.leaguePath, `/lol-match-history/v1/games/${id}`).then(keep), me.puuid))
        .then((n) => n && toMainWindow('progress:update'))
        .catch((e) => console.warn('Alte Spiele ergänzen:', e.message));
    }
    updateSession().catch((e) => console.warn('Session:', e.message));
    await refreshAugmentNames();
  } catch (e) {
    // Client noch nicht bereit, beim nächsten Abfragen erneut
  }
}

// Session (heute): Siege/Niederlagen aus der eigenen Historie, LP seit dem ersten Blick heute (Solo und Flex).
// Nach 3 Niederlagen am Stück einmal ein Hinweis im Tray
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVS = ['IV', 'III', 'II', 'I'];
// Rang als Zahl, damit Auf- und Abstiege mitzählen (eine Division = 100 LP; ab Master nur noch LP)
const lpScore = (r) => (!r ? null : TIERS.indexOf(r.tier) * 400 + (TIERS.indexOf(r.tier) >= 7 ? 0 : DIVS.indexOf(r.division) * 100) + r.lp);
let sessionInfo = null;
let streakWarned = 0;
async function updateSession() {
  const today = new Date().toDateString();
  const dayStart = new Date(today).getTime();
  const me = await lcu.currentSummoner(config.leaguePath);
  const r = await lcu.ranks(config.leaguePath, me.puuid);
  const now = { solo: lpScore(r.solo), flex: lpScore(r.flex) };
  gamelog.trackLp(now);
  if (!config.session || config.session.day !== today) saveConfig({ session: { day: today, start: now } });
  const games = history.since(dayStart);
  let streak = 0;
  for (const g of games) streak = g.win ? 0 : streak + 1;
  const delta = (q) => (now[q] != null && config.session.start[q] != null ? now[q] - config.session.start[q] : null);
  sessionInfo = { wins: games.filter((g) => g.win).length, losses: games.filter((g) => !g.win).length, streak,
    lp: { solo: delta('solo'), flex: delta('flex') } };
  toMainWindow('session', sessionInfo);
  if (streak >= 3 && streak !== streakWarned) {
    streakWarned = streak;
    balloon(t('{n} Niederlagen am Stück', { n: streak }), t('Kurz durchatmen? Eine Pause hilft oft mehr als das nächste Spiel.'));
  }
}

// Deutsche Augment-Namen aus dem Client, einmal pro App-Start (neue Augments kommen mit Patches)
let augmentNamesFresh = false;
async function refreshAugmentNames() {
  if (augmentNamesFresh) return;
  augments.setNames(await lcu.cherryAugments(config.leaguePath));
  augmentNamesFresh = augments.hasNames();
}

// Auto-Accept: „Spiel gefunden“ nach kurzer Verzögerung annehmen (Zeit, um selbst abzulehnen).
// Läuft jede Sekunde, fragt aber nur in der Queue nach; ein Ready-Check dauert rund 10 s.
let acceptAt = 0; // geplanter Zeitpunkt fürs Annehmen, 0 = nichts geplant
async function pollReadyCheck() {
  if (config.autoAccept !== true || !['Matchmaking', 'ReadyCheck'].includes(state.phase)) {
    acceptAt = 0;
    return;
  }
  const rc = await lcu.readyCheck(config.leaguePath);
  if (!rc || rc.state !== 'InProgress' || rc.playerResponse !== 'None') {
    acceptAt = 0; // kein Check, schon angenommen oder selbst abgelehnt
    return;
  }
  if (!acceptAt) acceptAt = Date.now() + (config.autoAcceptDelayMs ?? 2000);
  if (Date.now() < acceptAt) return;
  acceptAt = 0;
  try {
    await lcu.acceptReadyCheck(config.leaguePath);
    console.log('Auto-Accept: Spiel angenommen');
  } catch (e) {
    console.warn('Auto-Accept:', e.message);
  }
}

function start() {
  setInterval(poll, 3000);
  setInterval(pollReadyCheck, 1000);
}

function register() {
  ipcMain.handle('session:get', () => sessionInfo);
  // Beste eigene Champs für eine Rolle (Champ-Auswahl): Data-Dragon-ID, Spiele, Siege, KDA
  ipcMain.handle('history:best', (_e, lane) => history.bestChamps(lane).map((c) => {
    const champ = ddragon.champion(c.champ);
    return { id: champ.id, name: champ.name, games: c.games, wins: c.wins, kda: (c.k + c.a) / Math.max(1, c.d) };
  }));
}

// Stand der heutigen Session (Siege, Niederlagen, LP), null bis der Client einmal geantwortet hat
const session = () => sessionInfo;

module.exports = { register, start, session };
