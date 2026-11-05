// Fremde Datenquellen an einer Stelle: ob Farmy sie nutzt (allowed) und wie sie zu nennen sind (Quellenangabe und
// Lizenz für „Rechtliches“ im Hauptfenster). allowed: false schaltet eine Quelle überall ab.
const SOURCES = {
  ddragon: {
    allowed: true, name: 'Data Dragon (Riot Games)', url: 'https://developer.riotgames.com/docs/lol#data-dragon',
    use: 'Champions, Items, Runen, Summoner, Icons', license: 'Riot Games Developer Policies',
  },
  meraki: {
    allowed: true, name: 'Meraki Analytics', url: 'https://github.com/meraki-analytics/lolstaticdata',
    use: 'Rollen und Fähigkeitswerte der Champions', license: 'MIT',
  },
  leagueWiki: {
    allowed: true, name: 'League of Legends Wiki', url: 'https://wiki.leagueoflegends.com/',
    use: 'Grundlage der Fähigkeitswerte (über Meraki)', license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  arammayhem: {
    allowed: true, name: 'arammayhem.com', url: 'https://arammayhem.com/data/',
    use: 'Augment-Tiers für ARAM Mayhem (Pickrate, keine Siegquoten)', license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  communityDragon: {
    allowed: true, name: 'CommunityDragon', url: 'https://communitydragon.org',
    use: 'Englische Augment-Namen', license: 'Riot Games Developer Policies',
  },
  // keine Lizenz veröffentlicht; genutzt wie bis 1.9 (Jamys Entscheidung vom 2026-11-05)
  lolalytics: {
    allowed: true, name: 'lolalytics.com', url: 'https://lolalytics.com',
    use: 'Builds, Runen, Summoner, Skill-Reihenfolge, Tierliste, Matchups', license: null,
  },
  // „Jungle Clear Compilation“ von Phylaris (öffentliche Google-Tabelle), genutzt wie bis 1.9
  jungleSheet: {
    allowed: true, name: 'Jungle Clear Compilation (Phylaris)',
    url: 'https://docs.google.com/spreadsheets/d/1Gjk5UrtAbcqdYnRlx9KMDuHGxhKsEv50vhn02cN0y-c',
    use: 'Jungle-Routen je Champion', license: null,
  },
};

const allowed = (id) => !!(SOURCES[id] && SOURCES[id].allowed);

// Fehler für abgeschaltete Quellen: off = true, die Oberfläche zeigt dann einen ruhigen Hinweis statt eines Fehlers
class SourceOff extends Error {
  constructor(id) {
    super(`${SOURCES[id].name}: off`);
    this.off = true;
  }
}
function need(id) {
  if (!allowed(id)) throw new SourceOff(id);
}

// was die Oberfläche braucht: an/aus je Quelle und die Liste für „Rechtliches“
const flags = () => Object.fromEntries(Object.keys(SOURCES).map((id) => [id, allowed(id)]));
const list = () => Object.entries(SOURCES).map(([id, s]) => ({ id, ...s, allowed: allowed(id) }));

module.exports = { allowed, need, flags, list, SourceOff };
