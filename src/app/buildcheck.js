// Build-Check für „Letztes Spiel“ (Kluft): deine Runen, Summoner und Start-Items aus dem Spielverlauf
// (src/client/timelines.js, build) neben dem meistgespielten Build von lolalytics für Champion und Lane. Zeigt nur
// Unterschiede als Vergleich, es bewertet nicht und ändert nichts. Quelle aus oder Seite nicht lesbar -> null
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const sources = require('../data/sources');

const LANES = ['top', 'jungle', 'middle', 'bottom', 'utility'];
// Tränke und Schmuckstücke zählen beim Start nicht mit (die kauft fast jeder anders)
const IGNORE = new Set([2003, 2031, 2033, 3340, 3363, 3364]);

const runeName = (id) => (ddragon.rune(id) || {}).name || `#${id}`;
const spellName = (key) => (ddragon.summoner(key) || {}).name || `#${key}`;
const sameSet = (a, b) => [...new Set(a)].sort().join() === [...new Set(b)].sort().join();

// tl: Spielverlauf (mit build und lane). Gibt [{ what, mine, ref }] nur für Abweichungen zurück, [] = alles wie
// lolalytics, null = kein Vergleich möglich
async function check(tl) {
  const b = tl && tl.build;
  if (!b || !b.champ || !LANES.includes(tl.lane) || !sources.allowed('lolalytics')) return null;
  const champ = ddragon.champion(b.champ); // Champion-Key (Zahl) -> Data-Dragon-Eintrag
  let ref;
  try {
    ref = await lolalytics.load(champ.id, tl.lane, 'sr', { touch: false });
  } catch {
    return null;
  }
  const out = [];
  if (ref.runes && b.perks.length) {
    const [key] = ref.runes.selectedPerkIds;
    if (b.perks[0] !== key) out.push({ what: 'keystone', mine: runeName(b.perks[0]), ref: runeName(key) });
    if (b.primary && b.primary !== ref.runes.primaryStyleId) out.push({ what: 'primary', mine: runeName(b.primary), ref: runeName(ref.runes.primaryStyleId) });
    if (b.sub && b.sub !== ref.runes.subStyleId) out.push({ what: 'sub', mine: runeName(b.sub), ref: runeName(ref.runes.subStyleId) });
  }
  if (ref.spells && b.spells.length === 2 && !sameSet(b.spells, ref.spells)) {
    out.push({ what: 'spells', mine: b.spells.map(spellName).join(' + '), ref: ref.spells.map(spellName).join(' + ') });
  }
  const mine = b.start.filter((id) => !IGNORE.has(id));
  const theirs = (ref.starting || []).filter((id) => !IGNORE.has(id));
  if (mine.length && theirs.length && !sameSet(mine, theirs)) {
    out.push({ what: 'start', mine: [...new Set(mine)].map(ddragon.itemName).join(', '), ref: theirs.map(ddragon.itemName).join(', ') });
  }
  return out;
}

module.exports = { check };
