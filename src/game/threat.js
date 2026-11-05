// Gegner-Team im Spiel: wie viel magischer gegen körperlicher Schaden kommt, viel CC, Heilung, dazu Item-Optionen
// dagegen. Grundlage sind Riots eigene Champion-Daten im Client (/lol-game-data/assets/v1/champions/{key}.json:
// tacticalInfo.damageType, playstyleInfo.damage/crowdControl, roles), angepasst an die Items, die die Gegner gerade
// tragen (Live-API). Data Dragon taugt dafür nicht (info ist bei neueren Champs 0/0/0).
// Zeigt nur Optionen, kauft und entscheidet nichts (Riot: Overlays dürfen Optionen zeigen, nicht entscheiden).
const ddragon = require('../data/ddragon');
const lcu = require('../client/lcu');
const live = require('./live');

const RETRY_MS = 30000; // Client nicht erreichbar: so lange warten, bis derselbe Champ neu gefragt wird
const info = new Map(); // Champion-Key -> { type, dmg, cc, roles } | { failedAt } | 'loading'

// Champs mit starker Eigenheilung (Fähigkeiten, nicht aus Items); Data-Dragon-IDs
const HEALERS = new Set(['Aatrox', 'Soraka', 'Vladimir', 'Sylas', 'Warwick', 'DrMundo', 'Yuumi', 'Swain', 'Briar',
  'Illaoi', 'Fiddlesticks', 'Volibear', 'Gwen', 'Zac', 'Nami', 'Sona', 'Maokai', 'Nasus', 'Olaf', 'Trundle']);

// Item-Optionen je eigenem Spielstil (ap: Magier, ad: Schütze/Kämpfer mit körperlichem Schaden, tank)
const OPTIONS = {
  mr: { ap: [3102], ad: [3156, 3091], tank: [4401, 2504, 3065] },
  armor: { ap: [3157, 2420], ad: [6333, 3026], tank: [3075, 3110, 3143] },
  cc: { ap: [3102], ad: [3139], tank: [] },
  heal: { ap: [3165, 3011], ad: [3033, 6609], tank: [3075] },
};
// Items mit Wundheilung (auch die Vorstufen), damit Farmy keine zweite Wundheilung vorschlägt
const ANTIHEAL = [3075, 3076, 3165, 3916, 3033, 3123, 6609, 3011];
const MR_BOOTS = 3111; // Merkurs Schuhe: Magieresistenz und Zähigkeit, hilft gegen Magie und CC
const ARMOR_BOOTS = 3047; // Stahlkappen

const keyOf = (p) => ddragon.championKey(ddragon.rawChampionId(p.rawChampionName));

function champInfo(leaguePath, key) {
  const hit = info.get(key);
  if (hit === 'loading') return null;
  if (hit && !hit.failedAt) return hit;
  if (hit && Date.now() - hit.failedAt < RETRY_MS) return null;
  info.set(key, 'loading');
  lcu.get(leaguePath, `/lol-game-data/assets/v1/champions/${key}.json`).then((c) => {
    const p = c.playstyleInfo || {};
    info.set(key, { type: (c.tacticalInfo || {}).damageType, dmg: p.damage || 2, cc: p.crowdControl || 1, roles: c.roles || [] });
  }).catch(() => info.set(key, { failedAt: Date.now() }));
  return null;
}

// Anteil magischen Schadens eines Gegners (0–1): Riots Einordnung, ab ein paar Items halb aus seinen Items.
// 1 AP und 1 AD sind nicht gleich viel wert (ein 3000-g-Item hat ~100 AP oder ~60 AD), daher AD × 1,7
function magicShare(p, c) {
  const base = c.type === 'kMagic' ? 1 : c.type === 'kPhysical' ? 0 : 0.5;
  let ap = 0, ad = 0;
  for (const it of Array.isArray(p.items) ? p.items : []) {
    const s = ddragon.itemStats(it.itemID);
    ap += s.FlatMagicDamageMod || 0;
    ad += (s.FlatPhysicalDamageMod || 0) * 1.7;
  }
  return ap + ad >= 80 ? (base + ap / (ap + ad)) / 2 : base;
}

// Eigener Spielstil für die Item-Optionen
function styleOf(c) {
  if (c.roles.includes('tank')) return 'tank';
  return c.type === 'kMagic' ? 'ap' : 'ad';
}

// Ergebnis fürs Panel oder null, solange die Champion-Daten noch laden (oder ohne Gegner, z. B. Practice Tool)
function assess(data, leaguePath) {
  const players = data.allPlayers || [];
  const me = players.find((p) => live.isMe(p, data.activePlayer || {}));
  if (!me) return null;
  const enemies = players.filter((p) => p.team !== me.team && !p.isBot);
  if (!enemies.length) return null;
  const mine = champInfo(leaguePath, keyOf(me));
  const list = enemies.map((p) => ({ p, c: champInfo(leaguePath, keyOf(p)) }));
  if (!mine || list.some((x) => !x.c)) return null;

  // magischer Anteil, gewichtet nach Riots Schadens-Einstufung (Thresh zählt weniger als Annie)
  let sum = 0, weight = 0;
  for (const { p, c } of list) {
    sum += magicShare(p, c) * c.dmg;
    weight += c.dmg;
  }
  const magic = Math.round((sum / weight) * 100);
  const ccTotal = list.reduce((s, x) => s + x.c.cc, 0);
  const cc = ccTotal >= list.length * 2.2;
  // Heilung: Champs mit starker Eigenheilung oder mindestens 20 % Lebensraub aus Items (zwei Lebensraub-Items).
  // Ein einzelnes Item (Klinge des gestürzten Königs, Blutdürster) reicht nicht. Nach den Werten, nicht nach den
  // Data-Dragon-Tags: die führen auch Items ohne Lebensraub so (Malmortius' Schlund)
  const lifesteal = (p) => (Array.isArray(p.items) ? p.items : [])
    .reduce((s, it) => s + (ddragon.itemStats(it.itemID).PercentLifeStealMod || 0) * (it.count || 1), 0);
  const heal = list.filter(({ p }) => HEALERS.has(ddragon.champion(keyOf(p)).id) || lifesteal(p) >= 0.2)
    .map(({ p }) => p.championName);

  // Optionen: höchstens drei, nichts, was du schon hast; Stiefel nur, solange du keine fertigen trägst
  const own = new Set((me.items || []).map((it) => it.itemID));
  const hasBoots = (me.items || []).some((it) => ddragon.finishedBoots(it.itemID));
  const style = styleOf(mine);
  // je Option der Grund (mr, armor, cc, heal), damit das Panel sagt, wogegen das Item hilft
  const picks = [];
  const add = (ids, why) => {
    const id = ids.find((i) => !own.has(i) && !picks.some((x) => x.id === i));
    if (id) picks.push({ id, why });
  };
  if (magic >= 60) {
    if (!hasBoots) add([MR_BOOTS], 'mr');
    add(OPTIONS.mr[style], 'mr');
  } else if (magic <= 40) {
    if (!hasBoots) add([cc ? MR_BOOTS : ARMOR_BOOTS], cc ? 'cc' : 'armor');
    add(OPTIONS.armor[style], 'armor');
  }
  if (cc) {
    if (!hasBoots && magic > 40 && magic < 60) add([MR_BOOTS], 'cc');
    add(OPTIONS.cc[style], 'cc');
  }
  // gegen Heilung nur, wenn du noch kein Item mit Wundheilung hast
  if (heal.length >= 2 && !OPTIONS.heal[style].concat(ANTIHEAL).some((i) => own.has(i))) add(OPTIONS.heal[style], 'heal');

  return {
    magic,
    cc,
    heal: heal.length >= 2 ? heal : [],
    options: picks.slice(0, 3).map(({ id, why }) => ({ id, why, name: ddragon.itemName(id), icon: ddragon.iconUrl('item', id) })),
  };
}

// Neues Spiel: Daten aus dem letzten Spiel bleiben gültig (gleiche Champs), nur Fehlversuche vergessen
function reset() {
  for (const [k, v] of info) if (v === 'loading' || v.failedAt) info.delete(k);
}

module.exports = { assess, reset };
