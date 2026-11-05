// Datenordner festlegen, bevor irgendetwas config.json liest oder die Instanz-Sperre setzt (die hängt am Datenordner)
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// --data-dir=<Ordner> legt Einstellungen, Caches und Debug-Dateien woandershin als %APPDATA%
// (z. B. wenn C: voll ist)
const DATA_DIR_ARG = process.argv.find((a) => a.startsWith('--data-dir='));

// Bis 1.5 hieß die App „All You Need“: Einstellungen, Builds, Runen und Caches beim ersten Start als Farmy aus dem
// alten Ordner übernehmen. Chromiums eigene Ordner (Cache, Local Storage …) baut Electron selbst neu auf.
const CHROMIUM_ENTRIES = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Local Storage',
  'Session Storage', 'Network', 'Shared Dictionary', 'blob_storage', 'Crashpad', 'Local State', 'Preferences', 'lockfile']);

function prepare() {
  if (DATA_DIR_ARG) app.setPath('userData', path.resolve(DATA_DIR_ARG.slice('--data-dir='.length)));
  const oldDir = path.join(app.getPath('appData'), 'All You Need');
  const dir = app.getPath('userData');
  if (DATA_DIR_ARG || fs.existsSync(path.join(dir, 'config.json')) || !fs.existsSync(path.join(oldDir, 'config.json'))) return;
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(oldDir)) {
    if (CHROMIUM_ENTRIES.has(name) || name.startsWith('Singleton')) continue;
    try {
      fs.cpSync(path.join(oldDir, name), path.join(dir, name), { recursive: true });
    } catch (e) {
      console.warn('Übernahme aus „All You Need“:', name, e.message); // ein Cache fehlt dann nur und wird neu geladen
    }
  }
}

module.exports = { DATA_DIR_ARG, prepare };
