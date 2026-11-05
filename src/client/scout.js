// Mitspieler in der Champ-Auswahl einschätzen (Karte „Dein Team“): Rang, Form und Rollen aus seinen letzten Spielen
// (20 vom Client plus ältere aus Farmys Archiv, src/client/archive.js), meistgespielte Champions und die Skill-Einschätzung
// gegen seine Lobbys (src/client/lobbyskill.js). Alles über den Client.
// Ergebnisse 15 min im Speicher: die Champ-Auswahl fragt sonst bei jedem Hover/Pick neu.
const lcu = require('./lcu');
const lobbyskill = require('./lobbyskill');
const { laneOf } = require('./history');
const archive = require('./archive');
const { t } = require('../../renderer/i18n');

const TTL = 15 * 60 * 1000;
const cache = new Map(); // `${art}:${puuid}` -> { at, promise }
function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key)); // Fehler nicht merken, beim nächsten Mal neu versuchen
  return promise;
}

// echte Spiele: keine Übungs- und eigenen Spiele, keine Remakes
const realGames = (games) => games.filter((g) => g.gameType === 'MATCHED_GAME' && g.gameDuration >= 300);

async function summary(lp, puuid) {
  const p = archive.extend(await lcu.playerByPuuid(lp, puuid));
  const games = realGames(p.games);
  const wins = games.filter((g) => g.participants[0].stats.win).length;
  // Serie vom neuesten Spiel an (die Liste ist neu -> alt)
  let streak = 0;
  for (const g of games) {
    if (g.participants[0].stats.win !== games[0].participants[0].stats.win) break;
    streak++;
  }
  const count = (key) => {
    const m = new Map();
    for (const g of games) {
      const k = key(g);
      if (!k) continue;
      const e = m.get(k) || { key: k, games: 0, wins: 0 };
      e.games++;
      if (g.participants[0].stats.win) e.wins++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.games - a.games);
  };
  return {
    puuid,
    riotId: `${p.gameName}#${p.tagLine}`,
    level: p.level,
    solo: p.solo,
    flex: p.flex,
    games: games.length,
    wins,
    streak: games.length ? { win: games[0].participants[0].stats.win, n: streak } : null,
    champs: count((g) => g.participants[0].championId).slice(0, 3),
    // Rollen nur aus Kluft-Spielen mit erkannter Lane
    roles: count((g) => (g.mapId === 11 ? laneOf(g.participants[0].timeline || {}) : '')),
    mastery: p.mastery,
    gameIds: games.map((g) => g.gameId),
    // je Spiel [gameId, Seite, championId]: für Premade-Erkennung und Spiele auf dem aktuellen Champ. In Arena
    // (Map 30) sagt teamId nichts über das Duo, dort zählt schon das gemeinsame Spiel (Seite 0)
    recent: games.map((g) => [g.gameId, g.mapId === 30 ? 0 : g.participants[0].teamId, g.participants[0].championId]),
  };
}

// Live-Spiel: Hinweise je Spieler (Serie, OTP, neu auf dem Champ, Smurf-Verdacht) und Premade-Gruppen.
// Premade: zwei Spieler desselben Teams, die in ihren letzten Spielen mindestens zweimal im selben Spiel auf derselben
// Seite standen. Braucht keine Spieldetails, nur die Spiellisten, die player() ohnehin lädt.
// players: [{ puuid, championKey, team }] -> Map(puuid -> { tags: [{ text, kind, title }], group, with }).
// pickedChamps: false in ARAM/Arena (Champ zugelost bzw. ständig neu), dann kein „neu auf dem Champ“
async function live(lp, players, pickedChamps = true) {
  const real = players.filter((p) => p.puuid && !/^0{8}-/.test(p.puuid));
  const info = new Map();
  await Promise.all(real.map(async (p) => {
    info.set(p.puuid, await player(lp, p.puuid).catch(() => null));
  }));
  // Premade-Gruppen (Union-Find über Paare mit ≥ 2 gemeinsamen Spielen auf derselben Seite)
  const parent = new Map(real.map((p) => [p.puuid, p.puuid]));
  const root = (x) => (parent.get(x) === x ? x : root(parent.get(x)));
  const shared = new Map(); // puuid -> [{ key, n }]
  for (const a of real) {
    for (const b of real) {
      if (a.puuid >= b.puuid || a.team !== b.team || !info.get(a.puuid) || !info.get(b.puuid)) continue;
      const mine = new Map(info.get(a.puuid).recent.map(([id, team]) => [String(id), team]));
      const n = info.get(b.puuid).recent.filter(([id, team]) => mine.get(String(id)) === team).length;
      if (n < 2) continue;
      parent.set(root(a.puuid), root(b.puuid));
      for (const [x, y] of [[a, b], [b, a]]) shared.set(x.puuid, [...(shared.get(x.puuid) || []), { key: y.championKey, n }]);
    }
  }
  const groups = new Map(); // Wurzel -> Nummer (1, 2, … über beide Teams)
  const out = new Map();
  for (const p of real) {
    const s = info.get(p.puuid);
    const tags = [];
    let group = null;
    if (shared.has(p.puuid)) {
      const r = root(p.puuid);
      if (!groups.has(r)) groups.set(r, groups.size + 1);
      group = groups.get(r);
    }
    if (s && s.games) {
      if (s.streak && s.streak.n >= 3) {
        tags.push(s.streak.win
          ? { kind: 'good', text: t('{n} Siege am Stück', { n: s.streak.n }) }
          : { kind: 'bad', text: t('{n} Niederlagen am Stück', { n: s.streak.n }) });
      }
      const onChamp = s.recent.filter(([, , c]) => String(c) === String(p.championKey)).length;
      const top = s.champs[0];
      if (s.games >= 8 && top && top.games / s.games >= 0.6) {
        tags.push({ kind: 'info', text: 'OTP', title: t('{n} von {m} Spielen auf einem Champion', { n: top.games, m: s.games }) });
      } else if (onChamp >= 5) {
        tags.push({ kind: 'info', text: t('{n}× auf dem Champ', { n: onChamp }), title: t('in den letzten {m} Spielen', { m: s.games }) });
      }
      const mastered = s.mastery.some((m) => String(m.championId) === String(p.championKey));
      if (pickedChamps && s.games >= 10 && !onChamp && !mastered) {
        tags.push({ kind: 'warn', text: t('neu auf dem Champ'), title: t('kein Spiel darauf in den letzten {m}', { m: s.games }) });
      }
      if (s.level < 60 && s.games >= 8 && s.wins / s.games >= 0.7) {
        tags.push({ kind: 'warn', text: t('Smurf?'), title: t('Level {l}, {w} % Siege in den letzten {m} Spielen', { l: s.level, w: Math.round((s.wins / s.games) * 100), m: s.games }) });
      }
    }
    out.set(p.puuid, { tags, group, with: shared.get(p.puuid) || [] });
  }
  return out;
}

// Spieldetails (alle 10 Spieler): aus dem Archiv oder vom Client (je ~0,25 s, daher 4 gleichzeitig)
async function gameDetails(lp, gameIds) {
  const ids = [...gameIds];
  const details = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (ids.length) {
      const id = Number(ids.shift());
      try {
        details.push(await archive.details(lp, id));
      } catch {
        // einzelnes Spiel nicht ladbar: ohne es weiter
      }
    }
  }));
  return details;
}

// Gesamtwert der Skill-Einschätzung (Mittel der Achsen, 50 = Lobby-Schnitt) oder null bei zu wenig Spielen
async function skill(lp, puuid) {
  const s = await player(lp, puuid);
  const r = lobbyskill.rate(await gameDetails(lp, s.gameIds), puuid);
  const scores = Object.values(r.metrics).map((m) => m.score);
  if (scores.length < 3) return null;
  return { overall: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), map: r.map, games: r.games };
}

const player = (lp, puuid) => cached(`p:${puuid}`, () => summary(lp, puuid));
const skillOf = (lp, puuid) => cached(`s:${puuid}`, () => skill(lp, puuid));

module.exports = { player, skill: skillOf, gameDetails, live };
