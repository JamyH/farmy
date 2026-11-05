// Einstellungen der App: config.json im Datenordner (%APPDATA%\Farmy oder --data-dir), dazu die Overlay-Vorgaben.
// main.js lädt das erst nach Wahl des Datenordners und der Übernahme aus „All You Need“.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const setup = require('./setup');

// Config und Debug-Dateien liegen unter %APPDATA%\Farmy, beim Start aus dem Quellcode genauso wie in
// der installierten App, damit beide dieselben Einstellungen, Builds und Runen nutzen
const DATA_DIR = app.getPath('userData');
fs.mkdirSync(DATA_DIR, { recursive: true });
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
// Erster Start: eigene config.json aus der Vorlage anlegen (config.json steht nicht im Repo)
if (!fs.existsSync(CONFIG_FILE)) fs.copyFileSync(path.join(__dirname, '..', '..', 'config.example.json'), CONFIG_FILE);
const EXAMPLE = path.join(__dirname, '..', '..', 'config.example.json');
// Kaputte config.json (von Hand falsch bearbeitet, Platte voll beim Schreiben einer alten Version): beiseitelegen
// und mit der Vorlage weitermachen, statt beim Start ohne Meldung abzustürzen. Die alte bleibt als config.kaputt-….json
function readFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    const aside = path.join(DATA_DIR, `config.kaputt-${Date.now()}.json`);
    try {
      fs.renameSync(CONFIG_FILE, aside);
    } catch {
      // nicht da oder gesperrt: dann eben nur die Vorlage
    }
    console.warn(`config.json unlesbar (${e.message}), beiseitegelegt als ${aside}`);
    fs.copyFileSync(EXAMPLE, CONFIG_FILE);
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
}
// Erst in eine Temp-Datei, dann umbenennen: ist die Platte voll, bleibt die alte config.json heil.
const writeFile = (data) => {
  fs.writeFileSync(`${CONFIG_FILE}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${CONFIG_FILE}.tmp`, CONFIG_FILE);
};

// Bis 1.9 hieß das Hauptfenster „Stats-Fenster“: dessen Schlüssel einmal umbenennen
function renameOldKeys(c) {
  let changed = false;
  if ('autoOpenStatsAfterGame' in c) {
    c.autoOpenAfterGame ??= c.autoOpenStatsAfterGame;
    delete c.autoOpenStatsAfterGame;
    changed = true;
  }
  if (c.hotkeys && 'openStats' in c.hotkeys) {
    c.hotkeys.openMain ??= c.hotkeys.openStats;
    delete c.hotkeys.openStats;
    changed = true;
  }
  if (changed) writeFile(c);
  return c;
}
const config = renameOldKeys(readFile());
// Nur geänderte Schlüssel zurückschreiben, damit Handänderungen an config.json erhalten bleiben.
const saveConfig = (patch) => {
  Object.assign(config, patch);
  writeFile({ ...readFile(), ...patch });
};

// League-Ordner automatisch finden (Installationsliste des Riot Clients), falls der eingetragene nicht passt
const detectedPath = setup.findLeaguePath(config.leaguePath);
if (detectedPath !== config.leaguePath) saveConfig({ leaguePath: detectedPath });

// Overlay-Einstellungen (⚙ im Panel-Kopf): Module ein/aus, UI-Größe, Transparenz, Farben, Klick-durch.
// Fehlende Werte (ältere config.json) kommen aus den Vorgaben.
const OVERLAY_DEFAULTS = { modules: {}, scale: 1, bgTransparency: 30, hoverTransparency: 20, clickThrough: true, compact: false,
  jungleSize: 1, jungleTransparency: 40, colors: {} };
const overlaySettings = () => ({
  ...OVERLAY_DEFAULTS,
  ...config.overlay,
  modules: { ...(config.overlay && config.overlay.modules) },
  colors: { ...(config.overlay && config.overlay.colors) },
});
// Modul an? Ausgeschaltete Module sparen auch die Bildschirm-Erkennung (Cooldowns, Augments, Scoreboard)
const moduleOn = (key) => overlaySettings().modules[key] !== false;
// Spiel-Rückblick: Death Recap und eigene Ulti mitlesen, fürs Spielprotokoll (Reiter „Letztes Spiel“)
const reviewOn = () => moduleOn('review');

module.exports = { DATA_DIR, CONFIG_FILE, config, saveConfig, overlaySettings, moduleOn, reviewOn };
