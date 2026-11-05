// Farmy, Hauptprozess: nur Start und Verdrahtung. Was wo passiert, steht in src/main/ (Überblick in CLAUDE.md).
const { app, globalShortcut, screen } = require('electron');

// Datenordner (--data-dir, Übernahme aus „All You Need“) vor allem anderen: config.json und die Instanz-Sperre
// hängen daran
require('./src/main/datadir').prepare();

// Nur eine Instanz: ein zweiter Start öffnet das Hauptfenster der laufenden App statt eines zweiten Overlays
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const { config, saveConfig } = require('./src/app/config');
const mainWindowData = require('./src/app/main-window-data');
const ddragon = require('./src/data/ddragon');
const i18n = require('./renderer/i18n');
const { DEV, DD_LANG } = require('./src/main/env');
const { state } = require('./src/main/state');
const windows = require('./src/main/windows');
const hud = require('./src/main/hud');
const reader = require('./src/main/screen-reader');
const champselect = require('./src/main/champselect');
const wiki = require('./src/main/wiki');
const client = require('./src/main/client');
const game = require('./src/main/game');
const hotkeys = require('./src/main/hotkeys');
const updates = require('./src/main/updates');
const dev = require('./src/main/dev');
const tray = require('./src/main/tray');
const themes = require('./src/main/themes');
const legal = require('./src/main/legal');
const rose = require('./src/main/rose');
const runeforge = require('./src/main/runeforge');
const roseGuard = require('./src/main/rose-guard');
const deck = require('./src/main/deck');

// Daten-Module mit eigenem Cache im Datenordner
const STORES = [require('./src/data/lolalytics'), require('./src/data/meraki'), require('./src/client/history'),
  require('./src/game/gamelog'), require('./src/app/notes'), require('./src/client/timelines'), require('./src/client/archive'),
  require('./src/game/augments'), require('./src/data/arammayhem'), require('./src/data/jungle'), require('./src/game/clears')];

// eigener Eintrag in der Taskleiste statt „Electron“ (gleiche ID wie die Verknüpfungen des Installers).
// Die ID bleibt aus der Zeit als „All You Need“: so ersetzt der Installer die alte Installation, statt daneben zu landen
app.setAppUserModelId(DEV ? 'com.jamyh.allyouneed.dev' : 'com.jamyh.allyouneed');

dev.register();
windows.register();
reader.register();
champselect.register();
wiki.register();
client.register();
game.register();
tray.register();
themes.register();
legal.register();
rose.register(); // FarmyDevBuild: Rose-Begleiter (nur Entwicklerversion, src/main/rose.js)
runeforge.register(); // FarmyDevBuild: RuneForge-Fenster, Downloads direkt in Rose (src/main/runeforge.js)
roseGuard.register(); // FarmyDevBuild: crashende Custom-Mods aus Rose nehmen (src/main/rose-guard.js)
mainWindowData.register({ toMainWindow: windows.toMainWindow });
app.on('second-instance', () => windows.restore());

app.whenReady().then(async () => {
  // Sprache der Oberfläche: gespeicherte Wahl, beim ersten Start die von Windows (Deutsch, sonst Englisch)
  if (!config.uiLanguage) saveConfig({ uiLanguage: app.getLocale().startsWith('de') ? 'de' : 'en' });
  i18n.setLang(config.uiLanguage);
  await ddragon.load(app.getPath('userData'), DD_LANG[i18n.lang()]);
  for (const store of STORES) store.init(app.getPath('userData'));

  hud.refresh();
  themes.start(); // vor dem ersten Fenster: liefert Dateien eigener Stile aus
  windows.createOverlay();
  tray.create();
  updates.start();
  // Auflösung oder Windows-Skalierung geändert (z. B. anderer Monitor als Hauptbildschirm): Overlay mitziehen,
  // Bildschirm-Regionen neu rechnen. Sonst deckte das Overlay nur einen Teil ab und las an falschen Stellen
  screen.on('display-metrics-changed', () => {
    windows.fitOverlay();
    hud.refresh();
  });
  // kein Fenster beim Start: die App läuft im Hintergrund (Overlay + Tray), das Hauptfenster nur auf Wunsch
  hotkeys.register();
  game.start();
  deck.start(); // Werte fürs Stream-Deck-Plugin (src/main/deck.js)
  client.start();
  rose.start(); // FarmyDevBuild: Rose mitstarten
  roseGuard.start();
  if ((await reader.start()) && state.gameRunning) game.startWatch();
});

// Overlay läuft im Hintergrund weiter, auch wenn das Hauptfenster zu ist.
app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
