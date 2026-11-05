// Tray-Icon unten rechts: zeigt, dass die App läuft; Klick öffnet das Hauptfenster, Rechtsklick das Menü mit Beenden.
// Dasselbe Menü hängt hinter dem ☰-Knopf im Hauptfenster. Hört auf Menü- und Meldungs-Ereignisse aus state.js
const { app, dialog, ipcMain, Menu, nativeImage, Tray } = require('electron');
const { DATA_DIR, config, saveConfig } = require('../app/config');
const riot = require('../app/riot');
const ddragon = require('../data/ddragon');
const i18n = require('../../renderer/i18n');
const { t } = i18n;
const { DATA_DIR_ARG } = require('./datadir');
const { DEV, APP_NAME, APP_ICON, APP_PNG, DD_LANG } = require('./env');
const { events } = require('./state');
const windows = require('./windows');
const themes = require('./themes');
const updates = require('./updates');
const dev = require('./dev');

let tray = null;

function balloon(title, content) {
  if (tray) tray.displayBalloon({ iconType: 'custom', icon: nativeImage.createFromPath(APP_PNG), title, content });
}

// Autostart: beim Start aus dem Quellcode electron.exe mit dem Projektordner eintragen, nicht electron.exe allein
const LOGIN_ITEM = {
  ...(app.isPackaged ? {} : { path: process.execPath }),
  args: [...(app.isPackaged ? [] : [app.getAppPath()]), ...(DATA_DIR_ARG ? [DATA_DIR_ARG] : [])],
};

// League hängt nach einem Vanguard-Fehler: Riot Client, League-Client und Spiel auf einen Klick beenden
async function quitLeague() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: t('League komplett beenden'),
    message: t('Riot Client, League-Client und ein laufendes Spiel werden sofort beendet.'),
    detail: t('Gedacht für den Fall, dass League nach einem Vanguard-Fehler hängt. Ein laufendes Spiel verlässt du damit; danach League normal neu starten.'),
    buttons: [t('Beenden'), t('Abbrechen')],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return;
  const { before, left } = await riot.quitAll();
  balloon(
    t('League komplett beenden'),
    !before.length ? t('League lief gar nicht.')
      : left.length ? t('Noch nicht beendet: {list}. Dann bitte im Task-Manager.', { list: left.join(', ') })
        : t('League und Riot Client sind beendet. Du kannst League jetzt neu starten.'),
  );
}

// Sprache umschalten: Namen aus Data Dragon neu laden, Menü neu bauen und beide Fenster neu laden
async function setLanguage(lang) {
  if (lang === i18n.lang()) return;
  i18n.setLang(lang);
  saveConfig({ uiLanguage: lang });
  refresh();
  await ddragon.load(DATA_DIR, DD_LANG[lang]);
  windows.reloadAll();
}

function appMenu() {
  const keys = config.hotkeys;
  const ui = windows.ui();
  return Menu.buildFromTemplate([
    { label: t('Farmy öffnen'), accelerator: keys.openMain, click: () => windows.openMainWindow() },
    { type: 'separator' },
    { label: t('Overlay anzeigen'), type: 'checkbox', checked: !ui.hidden, accelerator: keys.toggleOverlay, click: () => windows.toggleOverlay() },
    { label: t('Panel verschieben'), type: 'checkbox', checked: ui.editMode, accelerator: keys.editMode, click: () => windows.setEditMode(!ui.editMode) },
    { label: t('Overlay-Einstellungen'), type: 'checkbox', checked: ui.settingsOpen, click: () => windows.setSettingsOpen(!ui.settingsOpen) },
    {
      label: t('Spiel automatisch annehmen'),
      type: 'checkbox',
      checked: config.autoAccept === true,
      click: (item) => {
        saveConfig({ autoAccept: item.checked });
        windows.toMainWindow('autoAccept', item.checked);
      },
    },
    {
      label: t('Mit Windows starten'),
      type: 'checkbox',
      checked: app.getLoginItemSettings(LOGIN_ITEM).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: item.checked }),
    },
    // Sprachnamen immer in der eigenen Sprache, damit man zurückfindet
    {
      label: t('Stil'),
      submenu: themes.menu(t),
    },
    {
      label: 'Sprache / Language',
      submenu: [['de', 'Deutsch'], ['en', 'English']].map(([lang, label]) => ({
        label, type: 'radio', checked: i18n.lang() === lang,
        click: () => setLanguage(lang).catch((e) => console.warn('Sprache:', e.message)),
      })),
    },
    { type: 'separator' },
    { label: t('League komplett beenden …'), click: () => quitLeague().catch((e) => console.warn('League beenden:', e.message)) },
    { type: 'separator' },
    { label: `${APP_NAME} ${app.getVersion()}`, enabled: false },
    { label: t('Über Farmy und Rechtliches'), click: () => windows.openMainWindow({ tab: 'legal' }) },
    ...updates.menuItems(),
    ...dev.menuItems(),
    { label: t('Beenden'), click: () => app.quit() },
  ]);
}

function refresh() {
  if (!tray) return;
  tray.setContextMenu(appMenu());
  tray.setToolTip(DEV ? `${APP_NAME} ${app.getVersion()}` : t('Farmy {version} läuft', { version: app.getVersion() }));
}

function create() {
  tray = new Tray(APP_ICON);
  tray.on('click', () => windows.openMainWindow());
  refresh();
  // erster Start: zeigen, wo die App steckt
  if (!config.welcomed) {
    balloon(t('Farmy läuft'), t('Du findest es hier unten rechts im Infobereich. Rechtsklick aufs Icon für Einstellungen und Beenden.'));
    saveConfig({ welcomed: true });
  }
}

function register() {
  events.on('menu', refresh);
  events.on('balloon', balloon);
  ipcMain.on('i18n:lang', (e) => {
    e.returnValue = i18n.lang();
  });
  ipcMain.on('menu:popup', (_e, pos) => windows.popupInMainWindow(appMenu(), pos));
}

module.exports = { register, create };
