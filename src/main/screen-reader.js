// Bildschirm auslesen, nur während ein Spiel läuft und vorne ist. Jede Sekunde ein Mini-Ausschnitt-Paket aus dem
// Stream; Texterkennung nur wenn nötig: CS alle ocr.intervalMs, Spell-Restzeit einmal pro Cooldown (+ Abgleich).
// Ergebnis steht in screenState, die Spiel-Abfrage (game.js) baut es ins Panel ein.
const { app, ipcMain, nativeImage, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, config, moduleOn, reviewOn } = require('../app/config');
const setup = require('../app/setup');
const ocr = require('../screen/ocr');
const capture = require('../screen/screengrab');
const augments = require('../game/augments');
const anvil = require('../game/anvil');
const arammayhem = require('../data/arammayhem');
const ddragon = require('../data/ddragon');
const lolalytics = require('../data/lolalytics');
const { t } = require('../../renderer/i18n');
const { DEV, devFlag, clockOcr } = require('./env');
const { state, refreshMenu } = require('./state');
const hud = require('./hud');
const review = require('./review');
const windows = require('./windows');

const screenState = { cs: null, xp: null, spells: {}, items: {} };

// Spielstart: Rollen-Quest, Ward und Uhr gelten je Spiel
function resetGame() {
  screenState.quest = screenState.ward = screenState.clock = null;
}

// Augment-Angebot und Werte-Schmiede: drei Karten erkennen, Namen lesen (nur wenn sich der Ausschnitt geändert
// hat, z. B. nach Neu-Würfeln) und bewerten. Augments nach arammayhem.com, Werte-Splitter nach dem eigenen Build.
// Ergebnis landet im Overlay über den Karten.
const augmentCache = [null, null, null]; // je Karte { sig, text }
// Fingerabdruck nur der weißen Schrift: das Glitzern der Karten ändert die Farben laufend, die Schrift nicht.
// So läuft die Texterkennung nur, wenn wirklich ein anderer Name dasteht (statt jede Sekunde)
const cropSig = (c) => {
  let s = 0;
  for (let i = 0; i < c.data.length; i += 8) {
    const r = c.data[i], g = c.data[i + 1], b = c.data[i + 2];
    const white = Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
    s = (s * 31 + (white ? 1 : 0)) >>> 0;
  }
  return s;
};
// Build für die Splitter-Wertung: Lolalytics-Build des Champs plus die schon gekauften fertigen Items
function buildItemTags() {
  const planned = (state.champion && lolalytics.cached(state.champion, 'aram')?.items) || [];
  const owned = state.items.map((it) => it.id).filter(ddragon.finishedItem);
  return [...new Set([...planned, ...owned])].map(ddragon.itemTags);
}
async function readAugmentOffer(augCrops) {
  const frames = augCrops.slice(0, 3), names = augCrops.slice(3);
  if (!frames.every(ocr.augmentFrame)) {
    screenState.augments = null;
    return;
  }
  const texts = await Promise.all(names.map(async (crop, i) => {
    const sig = cropSig(crop);
    if (!augmentCache[i] || augmentCache[i].sig !== sig) {
      const text = await ocr.readText(crop);
      augmentCache[i] = { sig, text };
      if (DEV) fs.appendFileSync(path.join(DATA_DIR, 'augments-debug.log'), `${new Date().toISOString()} Karte ${i}: "${text}"\n`);
    }
    return augmentCache[i].text;
  }));
  const L = hud.regions();
  const pos = (i) => ({ x: hud.toDip(L.augments[i].x), y: hud.toDip(L.augments[i].badgeY) });
  const champ = state.champion;
  const shards = texts.map(anvil.match);
  if (shards.some(Boolean)) {
    const key = champ && ddragon.championKey(champ);
    const info = key ? ddragon.champion(key).info : null;
    const rated = anvil.rateOffer(shards, buildItemTags(), !!info && info.magic > info.attack);
    screenState.augments = rated.map((r, i) => (r ? { ...pos(i), ...r } : { ...pos(i), unknown: true }));
    return;
  }
  const champName = champ ? ddragon.champion(ddragon.championKey(champ)).name : '';
  screenState.augments = texts.map((text, i) => {
    // beim Umdrehen der Karten (Neu-Würfeln) steht kurz kein lesbarer Name da: dann kein Badge
    if ((text.match(/\p{L}/gu) || []).length < 4) return null;
    const id = augments.match(text);
    if (!id) return { ...pos(i), unknown: true };
    const rated = arammayhem.tier(id, champ, champName);
    return { ...pos(i), tier: rated ? rated.tier : null, why: rated ? rated.why : t('keine Daten'), credit: true };
  });
}

// Summoner-Cooldown einer Taste (d/f) aus ihrem Ausschnitt fortschreiben
async function readSpell(slot, crop) {
  const prev = screenState.spells[slot];
  if (!ocr.spellOnCooldown(crop, !!state.blueSpells[slot])) {
    // Mitten im Countdown „bereit“ nicht sofort glauben: tot ist der Bildschirm grau, dann fehlt das Blau
    // des Cooldowns, obwohl der Summoner nicht bereit ist. Tot -> ignorieren, sonst erst beim zweiten Mal
    const left = prev && !prev.ready && prev.cd != null ? prev.cd - (Date.now() - prev.at) / 1000 : 0;
    if (left > 3 && (state.dead || !prev.readySeen)) prev.readySeen = !state.dead;
    else screenState.spells[slot] = { ready: true };
    return;
  }
  if (prev && prev.readySeen) {
    prev.readySeen = false; // war nur ein Ausreißer, Countdown läuft weiter
    return;
  }
  // Zahl lesen beim Start des Cooldowns und danach alle 10 s zum Abgleich
  if (prev && !prev.ready && prev.cd != null && Date.now() - (prev.checkedAt || prev.at) <= (prev.recheckMs || 10000)) return;
  const cd = await ocr.readSpellCd(crop);
  // Kein Summoner startet mit weniger als 10 s. Solche Werte sind Fehllesungen, z. B. die weiße Kugel
  // im Flash-Icon, das wegen seines Blaus immer nach Cooldown aussieht
  const fresh = !prev || prev.ready;
  const left = fresh || prev.cd == null ? null : prev.cd - (Date.now() - prev.at) / 1000;
  if (left != null && cd != null && cd > left + 3) {
    // Höher als erwartet: Fehllesung jetzt oder schon vorher (bei 1080p z. B. 300 als 200 gelesen, danach
    // blieb der Timer bei 0 hängen). Liest Farmy 2 s später denselben Wert (Zeit abgezogen), gilt er;
    // bis dahin weiter runterzählen
    const p = prev.higher;
    if (p && Math.abs(cd - (p.cd - (Date.now() - p.at) / 1000)) <= 3) screenState.spells[slot] = { ready: false, cd, at: Date.now() };
    else Object.assign(prev, { cd: Math.max(0, Math.round(left)), at: Date.now(), checkedAt: Date.now(), recheckMs: 2000, higher: { cd, at: Date.now() } });
  } else if (cd != null && !(fresh && cd < 10)) screenState.spells[slot] = { ready: false, cd, at: Date.now() };
  else if (fresh) screenState.spells[slot] = { ready: true };
  else prev.checkedAt = Date.now(); // nicht lesbar: erst beim nächsten Abgleich wieder (Tesseract ist teuer)
}

// Dev „FPS/Ping ins perf.log“: Schnitt und Minimum der gelesenen Werte seit der letzten Zeile (alle 5 s gelesen)
let hudSamples = { fps: [], ping: [] };
function hudPerf() {
  const { fps, ping } = hudSamples;
  hudSamples = { fps: [], ping: [] };
  if (!fps.length && !ping.length) return {};
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return { fps: avg(fps), fpsMin: fps.length ? Math.min(...fps) : null, ping: avg(ping) };
}

let busy = false;
let lastCsRead = 0;
let lastFpsRead = 0;
async function poll() {
  // anderes Fenster vorne: dort steht nicht das Spiel, Lesen ergäbe Unsinn (z. B. Summoner „bereit“)
  if (!state.gameRunning || busy || !windows.gameFocused(false)) return;
  busy = true;
  try {
    hud.checkChange();
    const L = hud.regions();
    // Welche Regionen gelesen werden: im ⚙ abgeschaltete Anzeigen gar nicht erst. Reihenfolge im Paket:
    // Summoner, Items, dann CS und XP (falls fällig); die übrigen merken sich ihre Stelle
    const slots = moduleOn('spells') ? Object.entries(L.spells) : [];
    const items = moduleOn('items') ? state.items.filter((it) => it.slot < 6) : [];
    const readCs = Date.now() - lastCsRead >= config.ocr.intervalMs;
    const regions = [...slots.map(([, r]) => r), ...items.map((it) => L.items[it.slot])];
    const csIdx = readCs ? regions.push(L.cs, ocr.xpBox(L.xpArc)) - 2 : -1;
    // Rollen-Quest und Ward-Slot nur auf Summoner's Rift (ARAM hat beides nicht)
    const rift = !!state.data && state.data.gameData.mapNumber === 11;
    const questIdx = rift && moduleOn('quest') ? regions.push(L.quest) - 1 : -1;
    const wardIdx = rift && (moduleOn('ward') || debugRegions) ? regions.push(L.items[6]) - 1 : -1;
    const clockIdx = clockOcr() ? regions.push(L.clock) - 1 : -1;
    const fpsIdx = devFlag('fps') && Date.now() - lastFpsRead >= 5000 ? regions.push(L.fps, L.ping) - 2 : -1;
    const ultIdx = devFlag('ultIdle') || reviewOn() ? regions.push(L.ult) - 1 : -1;
    // Mayhem: Augment-Angebote kommen auch lebend (z. B. Stufe 7 auf der Lane), daher immer nachsehen. Der
    // Rahmen-Check kostet fast nichts, Texterkennung läuft nur bei offenem Angebot und geänderter Karte
    const watchAugments = !!state.data && state.data.gameData.gameMode === 'KIWI' && moduleOn('augments');
    const augIdx = watchAugments ? regions.push(...L.augments.map((a) => a.frame), ...L.augments.map((a) => a.name)) - 6 : -1;
    const crops = await capture.grab(regions);

    if (questIdx >= 0) screenState.quest = ocr.readQuest(crops[questIdx], L.quest.r);
    // roh, auch null (unlesbar): ob eine Lesung zählt, entscheidet src/screen/clock.js in der Spiel-Abfrage
    if (clockIdx >= 0) {
      screenState.clock = ocr.readClock(crops[clockIdx]);
      screenState.clockAt = Date.now();
    }
    if (fpsIdx >= 0) {
      lastFpsRead = Date.now();
      screenState.fps = ocr.readHudNumber(crops[fpsIdx]);
      screenState.ping = ocr.readHudNumber(crops[fpsIdx + 1]);
      if (screenState.fps != null) hudSamples.fps.push(screenState.fps);
      if (screenState.ping != null) hudSamples.ping.push(screenState.ping);
    }
    if (ultIdx >= 0) screenState.ultReady = review.trackUlt(crops[ultIdx]);
    if (devFlag('deathRecap') || reviewOn()) await review.checkDeath();
    // Restzeit mittig wie bei den Items; die Ladungszahl unten rechts (Gelbe Ward) zählt nicht
    if (wardIdx >= 0) screenState.ward = ocr.readItemCd(crops[wardIdx]);
    if (augIdx >= 0) await readAugmentOffer(crops.slice(augIdx, augIdx + 6));
    else screenState.augments = null;

    // Item-Cooldowns: jede Sekunde neu lesen (eigene Ziffern-Erkennung, kostet praktisch nichts)
    screenState.items = {};
    for (const [i, it] of items.entries()) {
      const cd = ocr.readItemCd(crops[slots.length + i]);
      if (cd != null) screenState.items[it.slot] = { id: it.id, cd };
    }
    for (const [i, [slot]] of slots.entries()) await readSpell(slot, crops[i]);
    if (csIdx >= 0) {
      lastCsRead = Date.now();
      screenState.cs = await ocr.readCs(crops[csIdx]);
      screenState.xp = ocr.readXp(crops[csIdx + 1], L.xpArc);
    }
  } catch (e) {
    console.warn('OCR:', e.message);
  } finally {
    busy = false;
  }
}

// FarmyDevBuild: alle Stellen, die Farmy gerade liest, als lila Rahmen mit erkanntem Wert ins Overlay
// (Strg+Shift+D oder Dev-Menü). Spart das Rätselraten bei fremden Auflösungen und falschen Timern
let debugRegions = false;
function toggleDebugRegions() {
  debugRegions = DEV && !debugRegions;
  if (!debugRegions) windows.toOverlay('debug-regions', null);
  else if (state.gameRunning && hud.regions()) sendDebugRegions(); // sofort, nicht erst beim nächsten Abruf
  refreshMenu();
}
// zuletzt gelesene Werte; gleiche Auswahl wie poll (belegte Item-Slots, Augment-Karten nur im Mayhem)
function sendDebugRegions() {
  const L = hud.regions();
  const area = hud.area();
  const items = state.items.filter((it) => it.slot < 6);
  const watchAugments = !!state.data && state.data.gameData.gameMode === 'KIWI';
  const dip = hud.toDip;
  const box = (label, r, value) => ({ label, value: value == null ? '–' : String(value),
    x: dip(r.x), y: dip(r.y), width: dip(r.width), height: dip(r.height) });
  const spell = (s) => (!s ? '–' : s.ready ? 'bereit' : s.cd != null ? `${Math.max(0, Math.round(s.cd - (Date.now() - s.at) / 1000))} s` : 'Cooldown');
  // Minimap auch ohne Jungle-Route suchen, damit man die Erkennung prüfen kann
  const m = hud.minimapRect();
  const list = [
    box('Spielfenster', area, `${area.width}×${area.height}`),
    box('CS', L.cs, screenState.cs),
    ...(clockOcr() ? [box('Uhr', L.clock, screenState.clock == null ? null : `${Math.floor(screenState.clock / 60)}:${String(screenState.clock % 60).padStart(2, '0')}`)] : []),
    ...(devFlag('fps') ? [box('FPS', L.fps, screenState.fps), box('Ping', L.ping, screenState.ping)] : []),
    ...(devFlag('ultIdle') ? [box('R', L.ult, `${screenState.ultReady ? 'bereit' : '–'} · ${Math.round(review.ultStats().total)} s`)] : []),
    box('XP', ocr.xpBox(L.xpArc), screenState.xp == null ? null : `${Math.round(screenState.xp * 100)} %`),
    box('Quest', L.quest, screenState.quest == null ? null : `${Math.round(screenState.quest * 100)} %`),
    ...Object.entries(L.spells).map(([k, r]) => box(k.toUpperCase(), r, spell(screenState.spells[k]))),
    ...items.map((it) => box(`Item ${it.slot + 1}`, L.items[it.slot], (screenState.items[it.slot] || {}).cd)),
    box('Ward', L.items[6], screenState.ward == null ? 'bereit' : `${screenState.ward} s`),
    box('Minimap', { x: m.x, y: m.y, width: m.size, height: m.size }, hud.foundMinimap() ? 'gefunden' : 'geschätzt'),
    ...(watchAugments ? L.augments.map((a, i) => box(`Karte ${i + 1}`, a.name, (augmentCache[i] || {}).text)) : []),
  ];
  windows.toOverlay('debug-regions', list);
}

// Erkennung starten, falls in config.json eingeschaltet; true = läuft
async function start() {
  if (!config.ocr || !config.ocr.enabled) return false;
  // ocr.collectDigits: CS-Ausschnitte als Lernmaterial für die eigene Ziffern-Erkennung sammeln
  const collect = config.ocr.collectDigits ? path.join(app.getPath('userData'), 'digit-samples') : null;
  await ocr.init(app.getPath('userData'), { collect });
  state.screenReading = true;
  setInterval(poll, 1000);
  return true;
}

function register() {
  // „Bildschirm-Erkennung prüfen“: zeigt die ausgeschnittenen Bereiche und was daraus gelesen wird
  ipcMain.handle('calib:check', async () => {
    if (!state.gameRunning) throw new Error(t('Nur im laufenden Spiel möglich.'));
    hud.refresh();
    const L = hud.regions();
    const slotItems = state.items.filter((it) => it.slot < 6);
    const regions = [L.cs, L.spells.d, L.spells.f, ocr.xpBox(L.xpArc), ...slotItems.map((it) => L.items[it.slot])];
    const crops = await capture.grab(regions);
    const toUrl = (c) => {
      const bgra = Buffer.from(c.data);
      for (let i = 0; i < bgra.length; i += 4) [bgra[i], bgra[i + 2]] = [bgra[i + 2], bgra[i]];
      return nativeImage.createFromBitmap(bgra, { width: c.width, height: c.height }).toDataURL();
    };
    const spell = async (c) => (ocr.spellOnCooldown(c) ? `Cooldown ${await ocr.readSpellCd(c)}` : t('bereit'));
    const d = screen.getPrimaryDisplay();
    return {
      screen: `${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}`,
      hudScale: setup.readHudScale(config.leaguePath),
      factors: L.factors,
      items: [
        { label: 'CS', img: toUrl(crops[0]), value: String(await ocr.readCs(crops[0])) },
        { label: 'D', img: toUrl(crops[1]), value: await spell(crops[1]) },
        { label: 'F', img: toUrl(crops[2]), value: await spell(crops[2]) },
        { label: 'XP', img: toUrl(crops[3]), value: `${Math.round(ocr.readXp(crops[3], L.xpArc) * 100)} %` },
        ...slotItems.map((it, i) => {
          const cd = ocr.readItemCd(crops[4 + i]);
          return { label: it.name, img: toUrl(crops[4 + i]), value: cd == null ? t('kein Cooldown') : `Cooldown ${cd}` };
        }),
      ],
    };
  });
}

module.exports = {
  register, start, screenState, resetGame, hudPerf, toggleDebugRegions, sendDebugRegions,
  debugRegionsOn: () => debugRegions,
};
