// Spiel-Archiv: der Client gibt je Spieler nur die letzten 20 Spiele heraus (begIndex/endIndex ignoriert er), die
// Details eines Spiels mit allen 10 Spielern aber auch später noch. Jedes Spiel, dessen Details Farmy lädt (eigene
// Spiele, Spielersuche, Skill-Einschätzung, Dein Team), landet deshalb schlank hier. Mit der Zeit kennt Farmy so mehr
// Spiele von Leuten, denen du schon begegnet bist. Format wie die Spieldetails des Clients, nur mit den Werten, die
// Profil, Skill-Einschätzung und das Aufklappen eines Spiels brauchen (~5 KB statt ~40 KB).
// Gespeichert als userdata/archive.jsonl (eine Zeile je Spiel, nur angehängt), geladen beim ersten Zugriff.
const fs = require('fs');
const path = require('path');
const lcu = require('./lcu');

const MAX = 6000; // darüber fliegen beim Start die ältesten raus (~5 KB je Spiel, also ~30 MB)
const STATS = ['win', 'kills', 'deaths', 'assists', 'totalMinionsKilled', 'neutralMinionsKilled', 'visionScore', 'goldEarned',
  'totalDamageDealtToChampions', 'damageDealtToObjectives', 'champLevel', 'item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6'];

let file = null;
let games = null; // gameId -> schlanke Details
const byPuuid = new Map(); // puuid -> Set(gameId)

function init(dir) {
  file = path.join(dir, 'archive.jsonl');
}

function index(g) {
  games.set(String(g.gameId), g);
  for (const x of g.participantIdentities) {
    if (!x.player.puuid) continue;
    if (!byPuuid.has(x.player.puuid)) byPuuid.set(x.player.puuid, new Set());
    byPuuid.get(x.player.puuid).add(String(g.gameId));
  }
}

function load() {
  if (games) return;
  games = new Map();
  if (!file || !fs.existsSync(file)) return;
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        index(JSON.parse(line));
      } catch {
        // halb geschriebene Zeile (Absturz beim Speichern): überspringen
      }
    }
    // nach einer halben Zeile neu anfangen, sonst hinge das nächste Spiel an ihr und ginge mit verloren
    if (text && !text.endsWith('\n')) fs.appendFileSync(file, '\n');
  } catch (e) {
    console.warn('Spiel-Archiv nicht lesbar:', e.message);
    return;
  }
  if (games.size > MAX) {
    const keep = [...games.values()].sort((a, b) => b.gameCreation - a.gameCreation).slice(0, MAX);
    games.clear();
    byPuuid.clear();
    keep.forEach(index);
    try {
      fs.writeFileSync(file, keep.map((g) => JSON.stringify(g)).join('\n') + '\n');
    } catch (e) {
      console.warn('Spiel-Archiv kürzen:', e.message);
    }
  }
}

function slim(d) {
  return {
    gameId: d.gameId,
    gameCreation: d.gameCreation,
    gameDuration: d.gameDuration,
    gameMode: d.gameMode,
    gameType: d.gameType,
    mapId: d.mapId,
    queueId: d.queueId,
    participantIdentities: d.participantIdentities.map((x) => ({
      participantId: x.participantId,
      player: { puuid: (x.player && x.player.puuid) || '', gameName: (x.player && x.player.gameName) || '', tagLine: (x.player && x.player.tagLine) || '' },
    })),
    participants: d.participants.map((p) => ({
      participantId: p.participantId,
      teamId: p.teamId,
      championId: p.championId,
      timeline: { lane: (p.timeline && p.timeline.lane) || '', role: (p.timeline && p.timeline.role) || '' },
      stats: Object.fromEntries(STATS.map((k) => [k, (p.stats && p.stats[k]) || 0])),
    })),
  };
}

// Details aus dem Client merken. Nur echte Spiele mit Spielern (keine Übungs- und eigenen Spiele)
function add(d) {
  load();
  if (!d || d.gameType !== 'MATCHED_GAME' || !Array.isArray(d.participantIdentities) || !Array.isArray(d.participants)) return;
  if (games.has(String(d.gameId))) return;
  const g = slim(d);
  index(g);
  try {
    fs.appendFileSync(file, JSON.stringify(g) + '\n');
  } catch (e) {
    console.warn('Spiel-Archiv speichern:', e.message);
  }
}

// Spieldetails: aus dem Archiv, sonst vom Client (und dann gemerkt)
async function details(lp, gameId) {
  load();
  const hit = games.get(String(gameId));
  if (hit) return hit;
  const d = await lcu.get(lp, `/lol-match-history/v1/games/${Number(gameId)}`);
  add(d);
  return d;
}

// Spiele eines Spielers im Format der Spielliste des Clients (participants[0] = er), neueste zuerst
function gamesOf(puuid) {
  load();
  return [...(byPuuid.get(puuid) || [])].map((id) => {
    const g = games.get(id);
    const ident = g.participantIdentities.find((x) => x.player.puuid === puuid);
    const me = ident && g.participants.find((p) => p.participantId === ident.participantId);
    return me ? { ...g, participants: [me], participantIdentities: [ident] } : null;
  }).filter(Boolean).sort((a, b) => b.gameCreation - a.gameCreation);
}

// Spielerprofil (lcu.playerByPuuid) um gemerkte ältere Spiele ergänzen: games bis max, fromArchive = wie viele dazukamen
function extend(player, max = 100) {
  const seen = new Set(player.games.map((g) => String(g.gameId)));
  const extra = gamesOf(player.puuid).filter((g) => !seen.has(String(g.gameId)));
  const all = [...player.games, ...extra].sort((a, b) => b.gameCreation - a.gameCreation).slice(0, max);
  return { ...player, games: all, fromArchive: all.filter((g) => !seen.has(String(g.gameId))).length };
}

const size = () => (load(), games.size);

module.exports = { init, add, details, gamesOf, extend, size };
