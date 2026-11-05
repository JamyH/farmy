// Fremde Datenquellen an einer Stelle: ob Farmy sie nutzen darf (allowed) und wie sie zu nennen sind (Quellenangabe
// und Lizenz für „Rechtliches“ im Hauptfenster). Auch als kostenloses Open-Source-Projekt gilt: eine Quelle ohne offene
// Lizenz oder schriftliche Erlaubnis bleibt aus (in der EU ist eine Statistik-Datenbank geschützt, § 87b UrhG). Liegt die
// Erlaubnis vor, hier allowed: true setzen und den Nachweis in legal/erlaubnisse/ ablegen.
// dev: true = in der Entwicklerversion (FarmyDevBuild, aus dem Quellcode) trotzdem an, zum Weiterentwickeln. Das
// hängt an app.isPackaged: die gebaute App kann eine solche Quelle nie einschalten, auch nicht per config
const { app } = require('electron');

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
  // keine Lizenz und keine Nutzungsbedingungen veröffentlicht: erst nach schriftlicher Erlaubnis
  lolalytics: {
    allowed: false, dev: true, name: 'lolalytics.com', url: 'https://lolalytics.com',
    use: 'Builds, Runen, Summoner, Skill-Reihenfolge, Tierliste, Matchups', license: null,
  },
  // „Jungle Clear Compilation“ von Phylaris (Google-Tabelle): ohne Erlaubnis nur die Standard-Full-Clear
  jungleSheet: {
    allowed: false, dev: true, name: 'Jungle Clear Compilation (Phylaris)',
    url: 'https://docs.google.com/spreadsheets/d/1Gjk5UrtAbcqdYnRlx9KMDuHGxhKsEv50vhn02cN0y-c',
    use: 'Jungle-Routen je Champion', license: null,
  },
};

const allowed = (id) => !!(SOURCES[id] && (SOURCES[id].allowed || (SOURCES[id].dev && !app.isPackaged)));

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
const list = () => Object.entries(SOURCES).map(([id, s]) => ({ id, ...s, allowed: allowed(id), devOnly: !s.allowed && allowed(id) }));

module.exports = { allowed, need, flags, list, SourceOff };
