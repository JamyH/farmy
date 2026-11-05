// Data Dragon: Itempreise und Championnamen, im userData-Ordner gecacht.
const fs = require('fs');
const path = require('path');

let items = {};
let champsById = {};
let version = null;

async function load(cacheDir, language) {
  const cacheFile = path.join(cacheDir, 'ddragon-cache.json');
  try {
    const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
    version = versions[0];
    let cache = null;
    if (fs.existsSync(cacheFile)) cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (!cache || cache.version !== version || cache.language !== language || !cache.runes || !cache.summoners) {
      const base = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${language}`;
      const [itemJson, champJson, runes, summonerJson] = await Promise.all([
        (await fetch(`${base}/item.json`)).json(),
        (await fetch(`${base}/champion.json`)).json(),
        (await fetch(`${base}/runesReforged.json`)).json(),
        (await fetch(`${base}/summoner.json`)).json(),
      ]);
      cache = { version, language, items: itemJson.data, champions: champJson.data, runes, summoners: summonerJson.data };
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    apply(cache);
  } catch (e) {
    // Offline: alten Cache nehmen, falls vorhanden
    if (fs.existsSync(cacheFile)) apply(JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
    console.warn('Data Dragon nicht erreichbar:', e.message);
  }
}

let runeNames = {};
let runeStyles = {};
let summoners = {}; // Key (4 = Blitz) -> { name, icon }
let language = 'de_DE';
function apply(cache) {
  version = cache.version;
  language = cache.language || language;
  items = cache.items;
  runeNames = {};
  runeStyles = {};
  for (const style of cache.runes || []) {
    runeNames[style.id] = { name: style.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}` };
    for (const slot of style.slots) {
      for (const r of slot.runes) {
        runeNames[r.id] = { name: r.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}` };
        runeStyles[r.id] = style.id;
      }
    }
  }
  champsById = {};
  for (const c of Object.values(cache.champions)) champsById[c.key] = { id: c.id, name: c.name };
  summoners = {};
  for (const s of Object.values(cache.summoners || {})) {
    summoners[s.key] = { name: s.name, icon: `https://ddragon.leagueoflegends.com/cdn/${cache.version}/img/spell/${s.image.full}` };
  }
}

// Fähigkeitskosten pro Champion (Q, W, E, R je Rang), einmal geladen und gemerkt
const spellCache = new Map();
function championSpells(id) {
  if (!version || !id) return null;
  if (!spellCache.has(id)) {
    spellCache.set(id, null);
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${id}.json`)
      .then((r) => r.json())
      .then((j) => {
        const c = j.data[id];
        spellCache.set(id, { partype: c.partype, costs: c.spells.map((s) => s.cost) });
      })
      .catch(() => spellCache.delete(id)); // beim nächsten Poll erneut versuchen
  }
  return spellCache.get(id);
}

// Titel, Klassen und Fähigkeiten (Name, Beschreibung, Symbol) in der Sprache der Oberfläche, fürs Champion-Wiki.
// Je Champion und Sprache einmal geladen; schlägt der Abruf fehl, beim nächsten Mal neu
const detailCache = new Map();
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const plainText = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m).replace(/\n{3,}/g, '\n\n').trim();
function championDetail(id) {
  const key = `${id}|${language}`;
  if (!detailCache.has(key)) {
    const img = (kind, file) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/${kind}/${file}`;
    detailCache.set(key, fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${language}/champion/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Data Dragon antwortet mit ${r.status}`);
        return r.json();
      })
      .then((j) => {
        const c = j.data[id];
        const ability = (a, kind) => ({ name: a.name, description: plainText(a.description), icon: img(kind, a.image.full) });
        return { title: c.title, tags: c.tags, passive: ability(c.passive, 'passive'), spells: c.spells.map((s) => ability(s, 'spell')) };
      })
      .catch((e) => {
        detailCache.delete(key);
        throw e;
      }));
  }
  return detailCache.get(key);
}

function itemGold(itemId, fallback = 0) {
  const it = items[String(itemId)];
  return it ? it.gold.total : fallback;
}

function champion(id) {
  return champsById[String(id)] || { id: String(id), name: `#${id}` };
}

// rawChampionName der Live-API -> Data-Dragon-ID. Meist „game_character_displayname_Aatrox“, gesehen 27.10. auch
// „Character_Aatrox_Name“, mit Rose (Skin-Tool) „rose_character_displayname_Jax“ (03.11.) – sonst kein Bild
const rawChampionId = (raw) => (raw || '').replace(/^.*character_displayname_|^Character_|_Name$/g, '');

// Data-Dragon-ID („Ahri“) -> Champion-Key (Zahl), den der Client erwartet
const championKey = (id) => Object.keys(champsById).find((k) => champsById[k].id === id) || null;

const championList = () => Object.values(champsById).sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Kaufbare Items auf Summoner's Rift (Map 11), für den Build-Editor
function itemList() {
  return Object.entries(items)
    .filter(([, it]) => it.gold.purchasable && it.maps?.['11'] && it.gold.total > 0 && !it.requiredChampion)
    .map(([id, it]) => ({ id: Number(id), name: it.name, gold: it.gold.total, completed: !it.into || it.into.length === 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// Fertiges Item für die Build-Statistik: keine Teile, Tränke oder Schmuckstücke. Stiefel der Stufe 2
// zählen mit, obwohl sie sich noch aufwerten lassen.
function finishedItem(itemId) {
  const it = items[String(itemId)];
  if (!it || it.gold.total < 900) return false;
  if ((it.tags || []).some((t) => t === 'Consumable' || t === 'Trinket')) return false;
  return !it.into || it.into.length === 0 || (it.tags || []).includes('Boots');
}

// Fertige Stiefel (Stufe 2 oder höher, nicht die einfachen Stiefel)
const finishedBoots = (itemId) => {
  const it = items[String(itemId)];
  return !!it && (it.tags || []).includes('Boots') && String(itemId) !== '1001' && it.gold.total > 300;
};

// Was kostet das Item noch, wenn man die Teile im Inventar anrechnet? Wie im Shop:
// besitzt man ein Teil des Rezepts, zählt es als bezahlt (owned: Map itemId -> Anzahl, wird verbraucht).
function remainingCost(itemId, owned) {
  const id = String(itemId);
  if ((owned.get(id) || 0) > 0) {
    owned.set(id, owned.get(id) - 1);
    return 0;
  }
  const it = items[id];
  if (!it) return 0;
  return it.gold.base + (it.from || []).reduce((sum, child) => sum + remainingCost(child, owned), 0);
}

// Direkte Teile eines Items, wie der Shop sie im Rezept zeigt (Item-IDs als Zahlen)
const components = (itemId) => (items[String(itemId)]?.from || []).map(Number);

// Name + Icon für Runenbaum oder Rune (Werte-Splitter haben keinen Eintrag -> null)
const rune = (id) => runeNames[id] || null;
// Runenbaum, zu dem eine Rune gehört
const runeStyle = (id) => runeStyles[id] || null;

const itemName = (itemId) => items[String(itemId)]?.name || `#${itemId}`;
// Summoner-Zauber nach Key (wie der Client ihn nennt, z. B. 4 = Blitz, 11 = Zerschmettern)
const summoner = (key) => summoners[String(key)] || null;
// Werte-Kategorien eines Items (Damage, AbilityHaste, ArmorPenetration …)
const itemTags = (itemId) => items[String(itemId)]?.tags || [];
// Werte eines Items (FlatMagicDamageMod, FlatPhysicalDamageMod, FlatArmorMod …)
const itemStats = (itemId) => items[String(itemId)]?.stats || {};

function iconUrl(kind, file) {
  if (!version) return '';
  if (kind === 'champion') return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${file}.png`;
  if (kind === 'item') return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${file}.png`;
  if (kind === 'spell') return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${file}.png`;
  return '';
}

module.exports = {
  load, itemGold, champion, championKey, rawChampionId, championList, championSpells, championDetail, itemList, itemName, itemTags, itemStats, summoner, finishedItem, finishedBoots, remainingCost, components, rune, runeStyle, iconUrl,
  getVersion: () => version,
};
