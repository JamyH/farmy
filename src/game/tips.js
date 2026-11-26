// Hinweise im Panel aus deinen eigenen Spielen (Kluft, Modul „tips“). Nur Dinge, die du selbst siehst: deine Tode aus
// der Live-API, dein Inventar und dein Gold, deine eigene Statistik aus früheren Spielen. Keine Gegner-Timer. Die
// Hinweise schlagen etwas vor, sie entscheiden nichts.
// - Serie: zweimal oder öfter vor Minute 15 am selben Champion gestorben → bis zum ersten Item sicher farmen?
// - Kontrollwarde: keine im Inventar, 75 g da, und du bist gerade am Shop (tot oder eben etwas gekauft)
// - Jungler-Phase: in deinen früheren Spielen fiel der Großteil deiner Jungler-Tode in Minute 9–15 → kurz davor erinnern
const timelines = require('../client/timelines');
const { t } = require('../../renderer/i18n');

const CONTROL_WARD = 2055;
const CW_COST = 75;
const EARLY = 900; // Lane-Phase bis Minute 15
const STREAK_SHOW = 90; // so lange (Spielsekunden) nach dem Tod steht der Serien-Hinweis
const SHOP_SHOW = 12; // so lange nach einem Kauf gilt „am Shop“
const GANK_FROM = 540, GANK_TO = 900; // Minute 9–15
const GANK_SHOW = [510, 600]; // Hinweis von 8:30 bis 10:00

let game = null; // { deaths: Set(EventID), byKiller: {Name: n}, last: { name, champ, at }, items: [], boughtAt, gank }

function reset() {
  game = null;
}

// Jungler-Phase aus deinen Spielverläufen (Lane-Spiele mit bekanntem gegnerischem Jungler): Anteil der Jungler-Tode
// bis Minute 15, die in Minute 9–15 fallen. Erst ab 4 solchen Toden und mindestens der Hälfte
function gankWindow() {
  let all = 0, late = 0;
  for (const tl of Object.values(timelines.all())) {
    if (!tl.ejChamp || !tl.lane || tl.lane === 'jungle' || !tl.deathsAt) continue;
    for (const d of tl.deathsAt) {
      if (d.killer !== tl.ejChamp || d.t >= EARLY) continue;
      all++;
      if (d.t >= GANK_FROM) late++;
    }
  }
  return all >= 4 && late * 2 >= all ? { late, all } : null;
}

const names = (p) => {
  const list = [p.riotIdGameName, p.riotId, p.summonerName].filter(Boolean);
  return new Set(list.concat(list.map((x) => String(x).split('#')[0])));
};

// summary aus live.summarize, data = Rohdaten der Live-API. Gibt eine Liste { kind, text } zurück (leer = nichts)
function update(summary, data) {
  if (!game) game = { deaths: new Set(), byKiller: {}, last: null, items: null, boughtAt: -1e9, gank: gankWindow() };
  const now = summary.gameTime;
  const players = data.allPlayers || [];
  const active = data.activePlayer || {};
  const me = players.find((p) => (active.riotId && p.riotId === active.riotId) || (active.summonerName && p.summonerName === active.summonerName));
  const tips = [];

  // Serie: eigene Tode mit Killer aus den Ereignissen
  if (me) {
    const mine = names(me);
    const champOf = (name) => {
      const p = players.find((x) => names(x).has(name));
      return p ? p.championName : null;
    };
    for (const e of ((data.events || {}).Events || [])) {
      if (e.EventName !== 'ChampionKill' || game.deaths.has(e.EventID) || !mine.has(e.VictimName)) continue;
      game.deaths.add(e.EventID);
      const champ = champOf(e.KillerName);
      if (!champ || e.EventTime >= EARLY) continue; // Turm, Vasallen oder nach der Lane-Phase
      game.byKiller[champ] = (game.byKiller[champ] || 0) + 1;
      game.last = { champ, at: e.EventTime };
    }
  }
  const last = game.last;
  if (last && now - last.at < STREAK_SHOW && game.byKiller[last.champ] >= 2) {
    tips.push({ kind: 'streak', text: t('{n}× an {champ} gestorben – bis zum ersten Item sicher farmen?', { n: game.byKiller[last.champ], champ: last.champ }) });
  }

  // Kontrollwarde: Kauf erkennen (ein Item kommt dazu) – dann bist du am Shop
  const ids = summary.myItemIds || [];
  if (game.items) {
    // Anzahl je Item vorher; bleibt nach dem Abziehen etwas negativ, ist ein Item dazugekommen
    const left = {};
    for (const id of game.items) left[id] = (left[id] || 0) + 1;
    for (const id of ids) left[id] = (left[id] || 0) - 1;
    if (Object.values(left).some((v) => v < 0)) game.boughtAt = now;
  }
  game.items = ids.slice();
  const bag = (summary.myItems || []).filter((it) => it.slot >= 0 && it.slot <= 5).length;
  const atShop = summary.isDead || now - game.boughtAt < SHOP_SHOW;
  if (now >= 300 && atShop && !ids.includes(CONTROL_WARD) && summary.gold >= CW_COST && bag < 6) {
    tips.push({ kind: 'ward', text: t('Kontrollwarde mitnehmen ({g} g)', { g: CW_COST }) });
  }

  // Jungler-Phase (nicht als Jungler)
  if (game.gank && summary.position && summary.position !== 'jungle' && now >= GANK_SHOW[0] && now < GANK_SHOW[1]) {
    tips.push({ kind: 'gank', text: t('Gleich Minute 9–15: {a} von {b} deiner frühen Jungler-Tode fallen in diese Zeit. Fluss-Busch warden?', { a: game.gank.late, b: game.gank.all }) });
  }
  return tips;
}

module.exports = { reset, update };
