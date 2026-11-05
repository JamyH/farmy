// Feste Werte des Hauptprozesses: Entwicklerversion, Name und Icons, Debug-Ordner, Dev-Schalter
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, config } = require('../app/config');

const ROOT = path.join(__dirname, '..', '..');
// Entwicklerversion (aus dem Quellcode): eigener Name und lila Icon, damit man sie von der installierten App
// unterscheidet (Tray, Taskleiste, Meldungen, Hauptfenster)
const DEV = !app.isPackaged;
const APP_NAME = DEV ? 'FarmyDevBuild' : 'Farmy';
const APP_ICON = path.join(ROOT, 'assets', DEV ? 'icon-dev.ico' : 'icon.ico');
const APP_PNG = path.join(ROOT, 'assets', DEV ? 'icon-dev.png' : 'icon.png');
const PRELOAD = path.join(ROOT, 'preload.js');
// Data-Dragon-Sprache (Item-, Champion-, Runen- und Summoner-Namen) folgt der Sprache der Oberfläche
const DD_LANG = { de: 'de_DE', en: 'en_US' };

// Rohdaten, Fehler und Messungen landen in debug/ im Datenordner
const DEBUG_DIR = path.join(DATA_DIR, 'debug');
// Datei in debug/ anhängen oder neu schreiben; false, wenn das nicht ging (z. B. Platte voll). Debug-Dateien sind
// nur Beiwerk, das Overlay muss trotzdem weiterlaufen
function writeDebug(name, text, append = true) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    (append ? fs.appendFileSync : fs.writeFileSync)(path.join(DEBUG_DIR, name), text);
    return true;
  } catch {
    return false;
  }
}

// FarmyDevBuild-Schalter (Tray → Dev und Devtools-Seite), gespeichert in config.devFlags
const DEV_FLAGS = [
  ['clockOcr', 'Spielzeit per OCR (statt Live-API)'],
  ['perfectCs', 'Perfekt-CS im CS-Feld'],
  ['fps', 'FPS/Ping ins perf.log'],
  ['deathRecap', 'Death Recap auswerten'],
  ['ultIdle', 'Ulti ungenutzt zählen'],
];
const devFlag = (k) => DEV && !!(config.devFlags || {})[k];
const clockOcr = () => devFlag('clockOcr');

module.exports = { ROOT, DEV, APP_NAME, APP_ICON, APP_PNG, PRELOAD, DD_LANG, DEBUG_DIR, writeDebug, DEV_FLAGS, devFlag, clockOcr };
