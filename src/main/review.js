// Spiel-Rückblick vom Bildschirm: wie lange die eigene Ulti bereit lag und was dich getötet hat (Death Recap).
// Fürs Spielprotokoll (Reiter „Letztes Spiel“, Modul „review“) und als Dev-Messung in debug/
const { nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { reviewOn } = require('../app/config');
const ocr = require('../screen/ocr');
const capture = require('../screen/screengrab');
const gamelog = require('../game/gamelog');
const { DEBUG_DIR, writeDebug, devFlag } = require('./env');
const { state } = require('./state');
const hud = require('./hud');

// Ulti ungenutzt: Sekunden, in denen R gelernt war, du gelebt hast und R bereit war (keine Restzeit auf dem
// Symbol). Nur deine eigene Ulti. Dev: am Spielende eine Zeile in debug/ult-idle.log
let ultIdle = { total: 0, streak: 0, longest: 0, at: 0 };
// crop: Ausschnitt des R-Symbols; gibt zurück, ob R gerade bereit ist
function trackUlt(crop) {
  const now = Date.now();
  const dt = ultIdle.at ? Math.min(5, (now - ultIdle.at) / 1000) : 0; // Lücken (anderes Fenster vorne) nicht zählen
  ultIdle.at = now;
  const r = state.data && state.data.activePlayer.abilities && state.data.activePlayer.abilities.R;
  const ready = !!r && r.abilityLevel > 0 && !state.dead && !ocr.ultOnCooldown(crop);
  if (ready) {
    ultIdle.total += dt;
    ultIdle.streak += dt;
    ultIdle.longest = Math.max(ultIdle.longest, ultIdle.streak);
  } else ultIdle.streak = 0;
  return ready;
}
const ultStats = () => ({ total: ultIdle.total, longest: ultIdle.longest });

// Death Recap: einmal je Tod, 3 s danach, ein Bild des Spielfensters und daraus Gesamtschaden und Schadensarten
// (Ring im Recap oben links) → deaths (je Spiel) und Spielprotokoll. Dev: Bild in debug/deathrecap/ zum Nachprüfen
// und eine Zeile in debug/deaths.log
let deadSince = 0;
let deathSaved = false;
let deaths = [];
// „3 Tode · 81 % physisch · 5 % magisch · 14 % echt“, gewichtet mit dem Gesamtschaden, soweit gelesen
function deathSummary() {
  const read = deaths.filter((d) => d.phys != null);
  if (!read.length) return deaths.length ? `${deaths.length} Tode, Recap nicht lesbar` : 'noch keine Tode';
  const w = (d) => d.total || 1;
  const sum = read.reduce((a, d) => a + w(d), 0);
  const share = (k) => Math.round(read.reduce((a, d) => a + d[k] * w(d), 0) / sum);
  return `${deaths.length} Tode · ${share('phys')} % physisch · ${share('magic')} % magisch · ${share('true')} % echt`;
}
// jede Sekunde aus der Bildschirm-Abfrage
async function checkDeath() {
  if (!state.dead) {
    deadSince = 0;
    deathSaved = false;
    return;
  }
  if (!deadSince) deadSince = Date.now();
  if (deathSaved || Date.now() - deadSince < 3000) return;
  deathSaved = true;
  const [img] = await capture.grab([hud.area()]);
  if (!img) return;
  // Bild nur in der Entwicklerversion mit Dev-Schalter (zum Nachprüfen der Erkennung)
  const name = devFlag('deathRecap') ? `${new Date().toISOString().replace(/[:.]/g, '-')}_${state.champion || 'x'}.png` : null;
  if (name) {
    const bgra = Buffer.from(img.data);
    for (let i = 0; i < bgra.length; i += 4) [bgra[i], bgra[i + 2]] = [bgra[i + 2], bgra[i]];
    const dir = path.join(DEBUG_DIR, 'deathrecap');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFile(path.join(dir, name), nativeImage.createFromBitmap(bgra, { width: img.width, height: img.height }).toPNG(), () => {});
  }
  const d = hud.regions().deathRecap;
  const ring = ocr.deathRing(img, d.cx, d.cy, d.r);
  const total = ring ? await ocr.readDeathTotal(ocr.subCrop(img, d.total)) : null;
  const death = { t: new Date().toISOString(), gameTime: state.data ? Math.round(state.data.gameData.gameTime) : null,
    champion: state.champion, total, ...(ring || { phys: null, magic: null, true: null }), image: name };
  deaths.push(death);
  gamelog.death({ gameTime: death.gameTime, total, phys: death.phys, magic: death.magic, true: death.true });
  if (name) fs.appendFile(path.join(DEBUG_DIR, 'deaths.log'), JSON.stringify(death) + '\n', () => {});
}

// Spielstart: Tode gelten je Spiel
function start() {
  deaths = [];
}
// Spielende: Ulti-Werte fürs Spielprotokoll (gamelog.finish), Dev-Zeile schreiben, Zähler zurücksetzen
function finish() {
  const u = ultIdle;
  ultIdle = { total: 0, streak: 0, longest: 0, at: 0 };
  if (devFlag('ultIdle') && u.total) {
    writeDebug('ult-idle.log', JSON.stringify({ t: new Date().toISOString(), champion: state.champion,
      readySec: Math.round(u.total), longestSec: Math.round(u.longest) }) + '\n');
  }
  return reviewOn() ? { ult: { readySec: Math.round(u.total), longestSec: Math.round(u.longest) } } : {};
}

module.exports = { trackUlt, ultStats, checkDeath, deathSummary, start, finish };
