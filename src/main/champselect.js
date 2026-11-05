// Champ-Auswahl und Build-Werkzeuge: Runen, Summoner und Item-Set setzen (eigene oder lolalytics/Riot),
// Matchup- und Team-Karte, ARAM-Bank. Dazu die IPC-Handler des Build-Reiters im Hauptfenster.
const { ipcMain, shell } = require('electron');
const { config, saveConfig } = require('../app/config');
const lcu = require('../client/lcu');
const scout = require('../client/scout');
const history = require('../client/history');
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const sources = require('../data/sources');
const meraki = require('../data/meraki');
const early = require('../data/early');
const jungle = require('../data/jungle');
const clears = require('../game/clears');
const { t } = require('../../renderer/i18n');
const { state, mapId, refreshMenu } = require('./state');
const { openMainWindow, toMainWindow } = require('./windows');

// lolalytics-Vorschläge: nur mit Erlaubnis (data/sources.js), dann an, solange nicht ausdrücklich abgeschaltet
const suggestionsOn = () => sources.allowed('lolalytics') && (!config.lolalytics || config.lolalytics.enabled !== false);
const ownBuild = (champId) => ((config.builds || {})[champId] || []).length > 0;
// Spar-Ziel im Spiel: eigener Build, sonst der zuletzt geladene Vorschlag
function buildFor(champId) {
  if (ownBuild(champId)) return config.builds[champId];
  return (suggestionsOn() && lolalytics.cached(champId, state.gameMode)?.items) || null;
}

const describeRunes = (r) =>
  r && {
    primary: ddragon.rune(r.primaryStyleId),
    sub: ddragon.rune(r.subStyleId),
    perks: r.selectedPerkIds.map((id) => ddragon.rune(id)).filter(Boolean),
  };

async function applyRunesFor(champId) {
  const rune = (config.runes || {})[champId];
  if (!rune) throw new Error(t('Für {champ} ist keine Runenseite gespeichert.', { champ: champId }));
  await lcu.applyRunePage(config.leaguePath, rune);
  return t('Runen für {champ} gesetzt (Seite „{page}“).', { champ: champId, page: lcu.PAGE_NAME });
}

// Fester Pick ohne eigene Runen/eigenen Build: Vorschlag von lolalytics laden (aus dem Cache, wenn
// jünger als ein Tag) und die Runen setzen. Antwortet lolalytics nicht, kommen Riots eigene Empfehlungen.
async function useSuggestion(champId, key, position) {
  if (ownBuild(champId) && (config.runes || {})[champId]) return; // nichts zu ergänzen, kein Abruf
  let source = 'lolalytics.com';
  let rune = null;
  try {
    if (suggestionsOn()) {
      rune = (await lolalytics.load(champId, position, state.gameMode)).runes;
      toMainWindow('suggestion', champId);
    }
  } catch (e) {
    console.warn('lolalytics:', e.message);
  }
  if (!rune) source = t('Riot-Empfehlung');
  const ownRunes = (config.runes || {})[champId];
  if (ownRunes || config.runesAuto === false) return;
  if (!rune) rune = await lcu.recommendedRunes(config.leaguePath, key, position, mapId()).catch(() => null);
  if (!rune) return;
  await lcu.applyRunePage(config.leaguePath, rune);
  toMainWindow('runes:status', t('Runen für {champ} von {source} gesetzt (Seite „{page}“).', { champ: champId, source, page: lcu.PAGE_NAME }));
}

// Summoner beim festen Pick setzen: das meistgespielte Paar laut lolalytics, sonst Riots Empfehlung.
// Was schon richtig liegt, bleibt auf seiner Taste (Blitz auf D oder F, wie gewohnt); nur der Rest wird getauscht.
function placeSpells(current, rec) {
  const out = [null, null];
  for (const s of rec) {
    const i = current.indexOf(s);
    if (i >= 0 && out[i] === null) out[i] = s;
  }
  const rest = rec.filter((s) => !out.includes(s));
  return out.map((s) => (s === null ? rest.shift() : s));
}
async function applySpells(champId, key, position, current) {
  let rec = null;
  let source = 'lolalytics.com';
  if (suggestionsOn()) rec = await lolalytics.load(champId, position, state.gameMode).then((s) => s.spells, () => null);
  if (!rec) {
    source = t('Riot-Empfehlung');
    rec = await lcu.recommendedSpells(config.leaguePath, key, position, mapId()).catch(() => null);
  }
  if (!rec) return t('Summoner: keine Empfehlung gefunden.');
  const [d, f] = placeSpells(current, rec);
  const name = (k) => ddragon.summoner(k)?.name || k;
  const vars = { d: name(d), f: name(f), source };
  if (d === current[0] && f === current[1]) return t('Summoner {d} (D) + {f} (F) passen schon ({source}).', vars);
  await lcu.applySpells(config.leaguePath, d, f);
  return t('Summoner {d} (D) + {f} (F) von {source} gesetzt.', vars);
}

// Item-Set „Farmy – Champ“ in den Client schreiben, im Spiel im Shop wählbar: eigener Build
// und/oder der lolalytics-Vorschlag (Start, Kern, danach). Ohne beides passiert nichts.
const LANE_LABEL = { top: 'Top', jungle: 'Jungle', middle: 'Mid', bottom: 'Bot', support: 'Support' };
// Vor jedes Item seine Teile (gleiche Teile zusammengefasst, z. B. 2× Verstärkender Foliant), dann das Item
const withParts = (ids) =>
  ids.flatMap((id) => {
    const parts = new Map();
    for (const p of ddragon.components(id)) parts.set(p, (parts.get(p) || 0) + 1);
    return [...[...parts].map(([pid, count]) => ({ id: pid, count })), { id }];
  });
// Builds aus dem Vorschlag; shown = der, den die Seite zeigt und der als Kern-Build oben steht
const BUILD_KINDS = { pick: 'Meistgespielt', win: 'Höchste Siegrate', alt: 'Alternative' };
const sameCore = (a, b) => [...a.slice(0, 3)].sort().join() === [...b.slice(0, 3)].sort().join();
const buildChoices = (s) => (s.builds || []).map((b) => ({ ...b, shown: sameCore(b.items, s.items) }));
const buildTitle = (b) => (b.wr != null
  ? t('{kind} ({wr} % Siege) – lolalytics.com', { kind: t(BUILD_KINDS[b.kind]), wr: Math.round(b.wr) })
  : t('{kind} – lolalytics.com', { kind: t(BUILD_KINDS[b.kind]) }));
async function importItemSet(champId) {
  const key = ddragon.championKey(champId);
  const s = suggestionsOn() ? lolalytics.cached(champId, state.gameMode) : null;
  const blocks = [];
  if (ownBuild(champId)) blocks.push({ title: t('Dein Build (Farmy)'), items: withParts(config.builds[champId]) });
  if (s) {
    blocks.push({ title: t('Start – lolalytics.com'), items: s.starting.map((id) => ({ id, count: (s.startCount || {})[id] || 1 })) });
    // Kern-Build erst ohne Teile als Überblick, dann jedes Item mit seinen Teilen in Kaufreihenfolge
    blocks.push({ title: t('Kern-Build – lolalytics.com'), items: s.items.slice(0, 3).map((id) => ({ id })) });
    s.items.slice(0, 3).forEach((id, i) => blocks.push({ title: t('{n}. {item} – Teile', { n: i + 1, item: ddragon.itemName(id) }), items: withParts([id]) }));
    if (s.items.length > 3) blocks.push({ title: t('Danach – lolalytics.com'), items: withParts(s.items.slice(3)) });
    // die anderen Builds (meistgespielt, höchste Siegrate, Alternative) kompakt als je eine Zeile
    for (const b of buildChoices(s).filter((x) => !x.shown)) blocks.push({ title: buildTitle(b), items: b.items.map((id) => ({ id })) });
  }
  if (!key || !blocks.length) throw new Error(t('Für {champ} gibt es weder eigenen Build noch Vorschlag.', { champ: champId }));
  const name = ddragon.champion(key).name;
  const label = s && (s.mode === 'aram' ? 'ARAM' : LANE_LABEL[s.lane]);
  await lcu.applyItemSet(config.leaguePath, key, `Farmy – ${name}${label ? ` ${label}` : ''}`, blocks, mapId());
  return t('Item-Set „Farmy – {name}“ ist im Client, im Spiel im Shop wählbar.', { name });
}

// ARAM-Bank: dein Champ und die Bank-Champs mit ARAM-Siegrate (lolalytics-Tierliste, einmal am Tag),
// beste zuerst. Das Hauptfenster zeigt das als Tausch-Hilfe; getauscht wird weiter von Hand im Client.
let benchInfo = null;
function setBench(info) {
  if (JSON.stringify(info) === JSON.stringify(benchInfo)) return;
  benchInfo = info;
  toMainWindow('bench', info);
}
async function updateBench(sel) {
  if (!suggestionsOn() || !sel.bench.length) return setBench(null);
  const tier = await lolalytics.aramTier();
  const row = (key, mine) => {
    const c = ddragon.champion(key);
    const r = tier.champs[key];
    return { id: c.id, name: c.name, icon: ddragon.iconUrl('champion', c.id), wr: r ? r.wr : null, games: r ? r.games : null, mine };
  };
  const list = [...(sel.key ? [row(sel.key, true)] : []), ...sel.bench.map((k) => row(k, false))];
  list.sort((a, b) => (b.wr ?? 0) - (a.wr ?? 0));
  setBench({ list, url: tier.url, fetchedAt: tier.fetchedAt });
}

// Je Champ-Auswahl nur bei Änderungen: Schlüssel der zuletzt verarbeiteten Stände
let lastRuneKey = null;
let lastSuggestionKey = null;
let lastMatchupKey = null;
let lastTeamKey = null;
let matchupState = null; // { champId, position, side, enemies } fürs Hauptfenster
let teamState = null; // { allies } (Karte „Dein Team“), null außerhalb der Champ-Auswahl

// Alle 3 s während der Champ-Auswahl (client.js); state.phase ist dabei noch die vorige Phase
async function update() {
  try {
    if (state.phase !== 'ChampSelect') state.gameMode = (await lcu.mapId(config.leaguePath)) === 12 ? 'aram' : 'sr';
    const sel = await lcu.champSelect(config.leaguePath);
    const champId = sel.key ? ddragon.champion(sel.key).id : null;
    state.position = sel.position;
    if (state.gameMode === 'aram') updateBench(sel).catch((e) => console.warn('ARAM-Bank:', e.message));
    // Matchup-Karte im Hauptfenster: gegnerische Picks, sobald sich etwas ändert (nur Summoner's Rift)
    const enemies = state.gameMode === 'sr' ? sel.enemies.map((k) => ddragon.champion(k).id) : [];
    const matchupKey = `${champId}|${sel.position}|${sel.side}|${enemies.join(',')}`;
    if (matchupKey !== lastMatchupKey) {
      lastMatchupKey = matchupKey;
      matchupState = { champId, position: sel.position, side: sel.side, enemies };
      toMainWindow('matchup:enemies', matchupState);
    }
    // Karte „Dein Team“: Mitspieler mit Rolle und Pick, sobald sich etwas ändert
    const allies = sel.allies.map((a) => ({ ...a, champId: a.championKey ? ddragon.champion(a.championKey).id : null }));
    const teamKey = JSON.stringify(allies);
    if (teamKey !== lastTeamKey) {
      lastTeamKey = teamKey;
      teamState = { allies };
      toMainWindow('lobby:team', teamState);
    }
    // gespeicherte Runen des gewählten Champs automatisch setzen (einmal pro Champ)
    if (sel.key && sel.key !== lastRuneKey) {
      lastRuneKey = sel.key;
      state.champion = champId;
      toMainWindow('build:champion', champId);
      if (config.runesAuto !== false && (config.runes || {})[champId]) {
        toMainWindow('runes:status', await applyRunesFor(champId));
      }
    }
    // Vorschlag erst beim festen Pick, damit Durchklicken beim Hovern keine Abrufe auslöst
    const suggestionKey = `${sel.key}|${sel.position}`;
    if (sel.locked && suggestionKey !== lastSuggestionKey) {
      lastSuggestionKey = suggestionKey;
      if (config.openInChampSelect !== false) openMainWindow({ tab: 'build', inactive: true });
      if (suggestionsOn()) await useSuggestion(champId, sel.key, sel.position);
      if (config.spellsAuto !== false) {
        await applySpells(champId, sel.key, sel.position, sel.spells)
          .then((msg) => toMainWindow('spells:status', msg), (e) => toMainWindow('spells:status', `${t('Summoner')}: ${e.message}`));
      }
      if (config.itemSetAuto !== false) {
        importItemSet(champId).then((msg) => toMainWindow('build:status', msg), (e) => toMainWindow('build:status', `${t('Item-Set')}: ${e.message}`));
      }
    }
  } catch (e) {
    toMainWindow('runes:status', `${t('Runen')}: ${e.message}`);
  }
}

// Außerhalb der Champ-Auswahl: nächste Auswahl fängt frisch an, Bank und Team-Karte verschwinden
function leave() {
  lastRuneKey = lastSuggestionKey = lastMatchupKey = lastTeamKey = null;
  setBench(null);
  if (teamState) toMainWindow('lobby:team', (teamState = null));
}

// Runenseiten zur Auswahl: lolalytics-Vorschlag (falls geladen) und Riots empfohlene Seiten für Champion
// und Rolle. Doppelte Seiten fliegen raus. Die Liste wird gemerkt, „Setzen“/„Merken“ geben nur den Index an.
const runeOptions = new Map();
const LANE_TO_POSITION = { top: 'top', jungle: 'jungle', middle: 'middle', bottom: 'bottom', support: 'utility' };

function register() {
  ipcMain.handle('build:data', () => ({
    champions: ddragon.championList(),
    items: ddragon.itemList(),
    builds: config.builds || {},
    runes: Object.fromEntries(Object.entries(config.runes || {}).map(([c, r]) => [c, describeRunes(r)])),
    runesAuto: config.runesAuto !== false,
    spellsAuto: config.spellsAuto !== false,
    suggestions: suggestionsOn(),
    openInChampSelect: config.openInChampSelect !== false,
    autoAccept: config.autoAccept === true,
    itemSetAuto: config.itemSetAuto !== false,
    current: state.champion,
  }));
  ipcMain.handle('build:set', (_e, champId, ids) => {
    saveConfig({ builds: { ...(config.builds || {}), [champId]: ids } });
  });
  ipcMain.handle('runes:saveCurrent', async (_e, champId) => {
    const page = await lcu.currentRunePage(config.leaguePath);
    const rune = { primaryStyleId: page.primaryStyleId, subStyleId: page.subStyleId, selectedPerkIds: page.selectedPerkIds };
    saveConfig({ runes: { ...(config.runes || {}), [champId]: rune } });
    return describeRunes(rune);
  });
  ipcMain.handle('runes:apply', (_e, champId) => applyRunesFor(champId));
  ipcMain.handle('runes:auto', (_e, on) => saveConfig({ runesAuto: on }));
  ipcMain.handle('spells:auto', (_e, on) => saveConfig({ spellsAuto: on }));
  // „Jetzt setzen“ im Hauptfenster: geht nur in der Champ-Auswahl mit gewähltem Champion
  ipcMain.handle('spells:apply', async () => {
    if (state.phase !== 'ChampSelect') return t('Summoner lassen sich nur in der Champ-Auswahl setzen.');
    const sel = await lcu.champSelect(config.leaguePath);
    if (!sel.key) return t('Erst einen Champion wählen.');
    return applySpells(ddragon.champion(sel.key).id, sel.key, sel.position, sel.spells);
  });

  // Matchup gegen einen Lane-Gegner: lolalytics (Siegrate, First Blood) plus Level-1–3-Duell aus den Grundwerten.
  // Nur vor dem Spiel im Hauptfenster: Siegraten im Spiel erlaubt Riot nicht
  ipcMain.handle('matchup:state', () => matchupState);
  ipcMain.handle('lobby:team', () => teamState);
  // Mitspieler einschätzen: erst Rang/Form/Champs (schnell), dann die Skill-Einschätzung (lädt 20 Spieldetails)
  ipcMain.handle('lobby:player', (_e, puuid) => scout.player(config.leaguePath, String(puuid)));
  ipcMain.handle('lobby:skill', (_e, puuid) => scout.skill(config.leaguePath, String(puuid)));
  // Jungle-Route (Phylaris' Clear-Tabelle) fürs Hauptfenster; reine Vorbereitung vor dem Spiel
  ipcMain.handle('jungle:routes', async (_e, champId) => ({
    ...(await jungle.routes(ddragon.champion(ddragon.championKey(champId)).name)),
    chosen: (config.jungleStart || {})[champId] || null,
    clears: clears.stats(champId), // eigene gemessene erste Runden mit diesem Champ
  }));
  // Startcamp für die Minimap merken (je Champion)
  ipcMain.handle('jungle:choose', (_e, champId, start) => saveConfig({ jungleStart: { ...(config.jungleStart || {}), [champId]: start } }));
  ipcMain.handle('matchup:get', async (_e, champId, vsId, position) => {
    const stats = (id) => ddragon.champion(ddragon.championKey(id)).stats;
    // Fähigkeiten von Meraki; fehlen sie (offline, unbekannter Champ), rechnet das Duell nur mit Grundwerten
    const kit = (id) => meraki.champion(id).then((c) => c.abilities, () => null);
    const [abilA, abilB] = await Promise.all([kit(champId), kit(vsId)]);
    const duel = early.levels(stats(champId), stats(vsId), abilA, abilB);
    try {
      return { ...(await lolalytics.matchup(champId, vsId, position || state.position)), duel };
    } catch (e) {
      if (e.off) return { duel }; // Quelle abgeschaltet (data/sources.js): nur das Duell
      return { error: e.message, duel };
    }
  });

  // lolalytics-Vorschlag fürs Hauptfenster: aus dem Cache; load = true holt ihn (Standard-Rolle des Champs)
  ipcMain.handle('suggestion:get', async (_e, champId, load) => {
    let s = lolalytics.cached(champId, state.gameMode) || (load ? await lolalytics.load(champId, '', state.gameMode) : null);
    // Vorschlag von vor der Build-Auswahl: einmal neu holen (gleiche Lane), sonst den alten zeigen
    if (s && !('builds' in s)) s = await lolalytics.load(champId, LANE_TO_POSITION[s.lane] || '', state.gameMode, { touch: false }).catch(() => s);
    return s && {
      lane: s.lane, url: s.url, fetchedAt: s.fetchedAt, starting: s.starting, items: s.items,
      builds: buildChoices(s).map((b) => ({ ...b, label: buildTitle(b) })),
      spells: (s.spells || []).map(ddragon.summoner).filter(Boolean),
      runes: describeRunes(s.runes),
    };
  });
  ipcMain.handle('bench:get', () => benchInfo);
  // Eigene meistgebaute Items für den Champ im aktuellen Modus (SR oder ARAM)
  ipcMain.handle('history:items', (_e, champId) => {
    const key = Number(ddragon.championKey(champId));
    const top = history.topItems(key, mapId(), ddragon.finishedItem);
    return { mode: state.gameMode, games: top.games, items: top.items.slice(0, 8).map((i) => ({ ...i, name: ddragon.itemName(i.id) })) };
  });
  ipcMain.handle('history:take', (_e, champId) => {
    const top = history.topItems(Number(ddragon.championKey(champId)), mapId(), ddragon.finishedItem);
    const ids = top.items.slice(0, 6).map((i) => i.id);
    if (!ids.length) throw new Error(t('Noch keine eigenen Spiele mit diesem Champion.'));
    saveConfig({ builds: { ...(config.builds || {}), [champId]: ids } });
  });
  ipcMain.handle('suggestion:take', (_e, champId, what) => {
    const s = lolalytics.cached(champId, state.gameMode);
    if (!s) throw new Error(t('Kein Vorschlag geladen.'));
    if (what === 'build') saveConfig({ builds: { ...(config.builds || {}), [champId]: s.items } });
    // „build:1“: einer der weiteren Builds (Index in s.builds)
    const other = /^build:(\d+)$/.test(what) && (s.builds || [])[Number(what.slice(6))];
    if (other) saveConfig({ builds: { ...(config.builds || {}), [champId]: other.items } });
    if (what === 'runes' && s.runes) saveConfig({ runes: { ...(config.runes || {}), [champId]: s.runes } });
  });
  ipcMain.handle('runes:options', async (_e, champId) => {
    const s = suggestionsOn() ? lolalytics.cached(champId, state.gameMode) : null;
    const position = (champId === state.champion && state.position) || LANE_TO_POSITION[s?.lane] || '';
    const options = [];
    if (s?.runes) options.push({ source: 'lolalytics.com', url: s.url, runes: s.runes });
    const riot = await lcu.recommendedRunePages(config.leaguePath, ddragon.championKey(champId), position, mapId()).catch(() => []);
    riot.forEach((runes) => options.push({ source: t('Riot-Empfehlung'), runes }));
    const seen = new Set();
    const unique = options.filter((o) => {
      const k = o.runes.selectedPerkIds.join(',');
      return !seen.has(k) && seen.add(k);
    });
    runeOptions.set(champId, unique);
    return unique.map((o) => ({ source: o.source, url: o.url, runes: describeRunes(o.runes) }));
  });
  ipcMain.handle('runes:useOption', async (_e, champId, i, save) => {
    const o = (runeOptions.get(champId) || [])[i];
    if (!o) throw new Error(t('Runenseite nicht mehr verfügbar, bitte neu laden.'));
    if (save) {
      saveConfig({ runes: { ...(config.runes || {}), [champId]: o.runes } });
      return t('Als deine Runen gespeichert.');
    }
    await lcu.applyRunePage(config.leaguePath, o.runes);
    return t('Gesetzt (Seite „{page}“).', { page: lcu.PAGE_NAME });
  });
  ipcMain.handle('build:itemSet', (_e, champId) => importItemSet(champId));
  ipcMain.handle('build:itemSetAuto', (_e, on) => saveConfig({ itemSetAuto: on }));
  ipcMain.handle('build:openInChampSelect', (_e, on) => saveConfig({ openInChampSelect: on }));
  ipcMain.handle('queue:autoAccept', (_e, on) => {
    saveConfig({ autoAccept: on });
    refreshMenu(); // Häkchen im Tray-Menü mitziehen
  });
  ipcMain.handle('suggestion:enabled', (_e, on) => saveConfig({ lolalytics: { ...(config.lolalytics || {}), enabled: on } }));
  // Quellen-Link im Standardbrowser öffnen, nur lolalytics-Seiten, die Jungle-Tabelle und deren YouTube-Videos
  ipcMain.handle('suggestion:open', (_e, url) => {
    if (/^https:\/\/(lolalytics\.com|www\.youtube\.com|youtube\.com)\//.test(url) || url === jungle.SOURCE) shell.openExternal(url);
  });
}

module.exports = { register, update, leave, buildFor, suggestionsOn, describeRunes, applyRunesFor, importItemSet };
