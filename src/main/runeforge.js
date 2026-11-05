// FarmyDevBuild: RuneForge (runeforge.dev, Mods für League) in einem eigenen Fenster. Du stöberst und klickst selbst
// auf „Download“; Farmy fängt nur die Datei ab, liest von der offenen Mod-Seite Kategorie, Champion und ersetzten
// Skin und legt den Mod über rose-mods.js direkt in Rose' Mods-Ordner.
// Kein Abruf ohne dich: RuneForges Nutzungsbedingungen verbieten automatischen Zugriff (Bots, Scraper), deshalb
// wird nichts selbst durchsucht oder heruntergeladen. Nur Entwicklerversion, wie der Rose-Begleiter.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const ddragon = require('../data/ddragon');
const { balloon } = require('./state');
const { APP_ICON } = require('./env');
const roseMods = require('./rose-mods');

const DEV = !app.isPackaged;
const START = 'https://runeforge.dev/mods';
const PARTITION = 'persist:runeforge'; // eigener Speicher (Login, Cookies), getrennt von Farmy
// Anmelden geht über Fenster dieser Seiten, alles andere öffnet der normale Browser
const POPUP_HOSTS = [/(^|\.)runeforge\.dev$/, /(^|\.)supabase\.co$/, /(^|\.)discord\.com$/, /^accounts\.google\.com$/];

let win = null;
const recent = []; // zuletzt importierte Mods, neueste zuerst (für die Rose-Karte)

// Text der offenen Mod-Seite: Titel und der Bereich „Mod info“. Dort stehen unter ABOUT die Schlagworte je Zeile:
// Kategorie („Champion Skin“), dann Champion („Aatrox“), dann Themen. „Base champion:“ / „Modified Skin:“ stehen
// nur manchmal in der Beschreibung des Autors. Läuft in der Seite, die du gerade ansiehst
const PAGE_INFO = `(() => {
  const info = document.querySelector('[aria-label="Mod info"]');
  return { url: location.href, title: document.title, info: info ? info.innerText : '', body: document.body.innerText.slice(0, 6000) };
})()`;

// Kategorie-Chips von RuneForge -> Kategorie (wie in den Filter-Adressen ?categories=…), spezifische zuerst
const CHIPS = [['Champion Skin', 'champion_skin'], ['Map Skin', 'map_skin'], ['Loading Screen', 'loading_screen'],
  ['Voiceover', 'voiceover'], ['Announcer', 'announcer'], ['Font', 'font'], ['VFX', 'vfx'], ['SFX', 'sfx'], ['UI', 'ui'],
  ['Map', 'map_skin'], ['Other', 'other']];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lines = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

// erste Zeile, die genau ein Kategorie-Chip ist
function category(text) {
  for (const line of lines(text)) {
    const hit = CHIPS.find(([label]) => norm(label) === norm(line));
    if (hit) return hit[1];
  }
  return null;
}

// „Aatrox“ / „Wukong“ / „Kai'Sa“ -> Champion-Key (266)
function championKey(name) {
  const n = norm(name);
  const hit = ddragon.championList().find((c) => norm(c.name) === n || norm(c.id) === n);
  return hit ? Number(ddragon.championKey(hit.id)) : null;
}

// „Modified Skin: Mecha Aatrox“ -> Skin-ID 266001; „Default“ oder unbekannt -> Grundskin (Key × 1000)
async function skinIds(key, skinName) {
  const base = [key * 1000];
  if (!skinName || /^default$/i.test(skinName.trim())) return base;
  try {
    const c = ddragon.champion(key);
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragon.getVersion()}/data/en_US/champion/${c.id}.json`);
    const skins = (await res.json()).data[c.id].skins || [];
    const hit = skins.find((s) => norm(s.name) === norm(skinName) || (s.num === 0 && norm(skinName) === 'default'));
    return hit ? [Number(hit.id)] : base;
  } catch {
    return base;
  }
}

// Seite + Datei -> was rose-mods braucht
async function describe(page, file) {
  const info = page?.info || '';
  const body = page?.body || '';
  const title = page ? page.title.replace(/\s*[|–-]\s*Runeforge\s*$/i, '').trim() : '';
  const mod = { file, title: title || path.parse(file).name, category: category(info) || category(body), url: page?.url };
  if (mod.category !== 'champion_skin') return mod;
  // Champion: Schlagwort-Zeile in „Mod info“, sonst „Base champion: …“ aus der Beschreibung
  const tag = lines(info).map(championKey).find(Boolean);
  const base = (body.match(/Base champion:\s*([^\n]+)/i) || [])[1];
  mod.championKey = tag || (base && championKey(base.trim())) || null;
  if (mod.championKey) mod.skinIds = await skinIds(mod.championKey, (body.match(/Modified Skin:\s*([^\n]+)/i) || [])[1]);
  return mod;
}

function remember(entry) {
  recent.unshift({ ...entry, at: Date.now() });
  recent.length = Math.min(recent.length, 10);
}

function onDownload(e, item, wc) {
  const dir = path.join(app.getPath('userData'), 'runeforge');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, item.getFilename());
  item.setSavePath(file);
  // Seite sofort lesen, solange sie noch die Mod-Seite ist, von der der Download kam
  const page = wc && !wc.isDestroyed() ? wc.executeJavaScript(PAGE_INFO).catch(() => null) : Promise.resolve(null);
  item.once('done', async (ev, result) => {
    if (result !== 'completed') return remember({ title: item.getFilename(), ok: false, error: `Download ${result}` });
    const mod = await describe(await page, file);
    try {
      const target = await roseMods.importMod(mod);
      const champ = mod.championKey ? ddragon.champion(mod.championKey).name : roseMods.CATEGORIES[mod.category];
      remember({ title: mod.title, ok: true, target, where: champ });
      balloon('Mod in Rose importiert', `${mod.title} → ${champ}`);
    } catch (err) {
      // Datei bleibt im Farmy-Ordner liegen, von dort lässt sie sich in Rose von Hand hinzufügen
      remember({ title: mod.title, ok: false, error: err.message, file });
      balloon('Mod nicht importiert', `${mod.title}: ${err.message}`);
    }
  });
}

function open() {
  if (win && !win.isDestroyed()) return win.show(), win.focus();
  win = new BrowserWindow({
    width: 1300, height: 900, title: 'RuneForge – Farmy', icon: APP_ICON, autoHideMenuBar: true,
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const ses = win.webContents.session;
  if (!ses.listenerCount('will-download')) ses.on('will-download', onDownload);
  win.webContents.setWindowOpenHandler(({ url }) => {
    const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    if (POPUP_HOSTS.some((re) => re.test(host))) return { action: 'allow' };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => (win = null));
  win.loadURL(START);
}

function register() {
  if (!DEV) return; // niemals in der gebauten App
  ipcMain.handle('runeforge:open', () => open());
  ipcMain.handle('runeforge:recent', () => recent);
}

module.exports = { register, describe };
