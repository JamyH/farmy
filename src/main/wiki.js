// Champion-Wiki im Hauptfenster: alle Champions nach Rolle, je Champion Build, Runen, Summoner und Skill-Reihenfolge
// (lolalytics, je Lane oder ARAM) und die Fähigkeiten mit Werten und Skalierungen (Texte aus Data Dragon in der
// Sprache der Oberfläche, Zahlen von Meraki). Nur Wissen, keine Siegquoten: das Fenster ist auch im Spiel offen,
// und Siegquoten im Spiel erlaubt Riot nicht.
const { ipcMain } = require('electron');
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const sources = require('../data/sources');
const lcu = require('../client/lcu');
const { config } = require('../app/config');
const meraki = require('../data/meraki');
const { describeRunes } = require('./champselect');

// Rollen wie bei Meraki, in Anzeige-Reihenfolge; dazu die Rolle, die lolalytics.load erwartet
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];
const POSITION = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', SUPPORT: 'utility' };

// Rollen und Fähigkeitswerte; ohne Meraki (offline beim ersten Start) leer, die Liste kommt dann ohne Rollen
const merakiData = () => meraki.wiki().catch((e) => {
  console.warn('Champion-Wiki (Meraki):', e.message);
  return { champions: {} };
});

async function list() {
  const { champions } = await merakiData();
  return ddragon.championList().map((c) => ({
    id: c.id, name: c.name, icon: ddragon.iconUrl('champion', c.id),
    roles: ((champions[c.id] || {}).positions || []).filter((r) => ROLES.includes(r)),
  }));
}

async function champion(id) {
  const [detail, { champions }] = await Promise.all([ddragon.championDetail(id), merakiData()]);
  const kit = (champions[id] || {}).kit || {};
  const texts = [detail.passive, ...detail.spells];
  return {
    id, name: ddragon.champion(ddragon.championKey(id)).name, title: detail.title, tags: detail.tags,
    icon: ddragon.iconUrl('champion', id),
    roles: ((champions[id] || {}).positions || []).filter((r) => ROLES.includes(r)),
    abilities: ['P', 'Q', 'W', 'E', 'R'].map((key, i) => ({ key, ...texts[i], forms: kit[key] || [] })),
  };
}

// Ohne lolalytics: Runen und Summoner, die Riot im Client empfiehlt (braucht den laufenden Client)
async function riotBuild(id, role) {
  const aram = role === 'ARAM';
  const key = ddragon.championKey(id);
  const position = aram ? '' : POSITION[role];
  const map = aram ? 12 : 11;
  const [pages, spells] = await Promise.all([
    lcu.recommendedRunePages(config.leaguePath, key, position, map).catch(() => []),
    lcu.recommendedSpells(config.leaguePath, key, position, map).catch(() => null),
  ]);
  if (!pages.length && !spells) return { riot: true, empty: true };
  return { riot: true, runes: describeRunes(pages[0]), spells: (spells || []).map(ddragon.summoner).filter(Boolean) };
}

// role: TOP … SUPPORT oder ARAM
async function build(id, role) {
  if (!sources.allowed('lolalytics')) return riotBuild(id, role);
  const aram = role === 'ARAM';
  const s = await lolalytics.load(id, aram ? '' : POSITION[role], aram ? 'aram' : 'sr', { touch: false });
  const item = (itemId) => ({ id: itemId, name: ddragon.itemName(itemId), icon: ddragon.iconUrl('item', itemId) });
  return {
    url: s.url, fetchedAt: s.fetchedAt,
    spells: (s.spells || []).map(ddragon.summoner).filter(Boolean),
    runes: describeRunes(s.runes),
    starting: s.starting.map((itemId) => ({ ...item(itemId), count: (s.startCount || {})[itemId] || 1 })),
    items: s.items.map(item),
    skillPriority: s.skillPriority, skillOrder: s.skillOrder,
  };
}

function register() {
  ipcMain.handle('wiki:list', () => list());
  ipcMain.handle('wiki:champion', (_e, id) => champion(String(id)));
  ipcMain.handle('wiki:build', (_e, id, role) => build(String(id), String(role)));
}

module.exports = { register };
