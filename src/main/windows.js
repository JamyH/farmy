// Fenster: das Overlay über dem Spiel (Klick-durch, Verschiebe-Modus, Einstellungen) und das Hauptfenster
const { BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { config, saveConfig, overlaySettings } = require('../app/config');
const gamewindow = require('../screen/gamewindow');
const { t } = require('../../renderer/i18n');
const { ROOT, DEV, APP_NAME, APP_ICON, PRELOAD } = require('./env');
const { refreshMenu, balloon } = require('./state');

let overlay = null;
let mainWin = null;
let overlayHidden = false;
let editMode = false;
let settingsOpen = false;

// Transparentes Fenster über dem ganzen Bildschirm, Klicks gehen durch zum Spiel.
// League muss dafür im Modus "Randlos" oder "Fenster" laufen, nicht "Vollbild".
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    ...bounds,
    transparent: true,
    icon: APP_ICON,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: PRELOAD },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  // Kein Content-Protection (bewusst): das Overlay soll in Bildschirmaufnahmen sichtbar sein (Discord-Stream, OBS).
  // Es taucht dadurch auch in Farmys eigener Aufnahme auf – das Panel deshalb nicht über die gelesenen HUD-Felder
  // (CS, Gold, Spielzeit) legen, sonst liest die OCR das Overlay statt des Spiels. (nicht wieder setContentProtection(true))
  setPassThrough(false);
  overlay.loadFile('renderer/overlay.html');
  // ausgeblendet kommt kein mouseleave mehr an: Maus wieder durchlassen, sonst fängt das Overlay sie im nächsten Spiel
  overlay.on('hide', () => {
    uiCaptured = false;
    panelHover = false;
    setPassThrough(false);
  });
  overlay.webContents.on('did-finish-load', () => {
    overlay.webContents.send('overlay-settings', overlaySettings());
    overlay.webContents.send('settings-open', settingsOpen);
    overlay.webContents.send('panel-pos', config.panel);
  });
  setInterval(watchMouse, 150);
}

// Auflösung oder Windows-Skalierung geändert: Overlay deckt wieder den ganzen Hauptbildschirm ab
function fitOverlay() {
  overlay.setBounds(screen.getPrimaryDisplay().bounds);
}

// Nachricht ans Overlay bzw. ans Hauptfenster (falls offen)
function toOverlay(channel, payload) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, payload);
}
function toMainWindow(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

// Klicks gehen durchs Overlay zum Spiel. Mausbewegungen ans Overlay weiterleiten (forward) brauchen nur die
// bedienbaren Teile (Hover): Griff, ⚙, offene Einstellungen und, ohne Klick-durch, das Panel. Electron hängt
// dafür einen globalen Maus-Hook ein und schickt jede Bewegung ans Overlay: gemessen ~21 % eines Kerns im
// Hauptprozess plus ~6 % im Overlay. Daher nur einschalten, solange die Maus in der Nähe eines solchen Teils
// ist; das prüft ein billiger Blick auf die Mausposition alle 150 ms.
let forwarding = null; // true/false = Stand der Weiterleitung, null = Overlay fängt die Maus gerade selbst
let hitRects = {}; // grip, gear, panel, settings im Overlay (CSS-Pixel), meldet das Overlay
let uiCaptured = false; // Maus steht über einem bedienbaren Teil, das Overlay fängt sie
let panelHover = false;
const GRIP_MARGIN = 40;
const inRect = (r, x, y, m) => !!r && x >= r.x - m && x <= r.x + r.width + m && y >= r.y - m && y <= r.y + r.height + m;
function setPassThrough(forward) {
  if (forwarding === forward) return;
  forwarding = forward;
  overlay.setIgnoreMouseEvents(true, forward ? { forward: true } : undefined);
}
function captureMouse() {
  forwarding = null;
  overlay.setIgnoreMouseEvents(false);
}
function watchMouse() {
  // beim Beenden (z. B. Dev → Neu starten) ist das Fenster schon zerstört, der Takt läuft noch
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  const p = screen.getCursorScreenPoint();
  const b = overlay.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  // Hover-Transparenz: Panel wird durchsichtiger, solange die Maus darüber steht (auch mit Klick-durch)
  const hover = inRect(hitRects.panel, x, y, 0);
  if (hover !== panelHover) {
    panelHover = hover;
    overlay.webContents.send('panel-hover', hover);
  }
  if (uiCaptured) return;
  // Verschiebe-Modus: nur über dem Panel fangen (zum Ziehen; das Panel wandert mit der Maus mit), sonst gehen die
  // Klicks ans Spiel. Vorher fing das ganze Overlay die Maus, und im Spiel konnte man nicht mehr laufen
  if (editMode) {
    if (!inRect(hitRects.panel, x, y, 60)) setPassThrough(false);
    else if (forwarding !== null) captureMouse();
    return;
  }
  const zones = [hitRects.grip, hitRects.gear, settingsOpen && hitRects.settings, !overlaySettings().clickThrough && hitRects.panel];
  setPassThrough(zones.some((r) => inRect(r, x, y, GRIP_MARGIN)));
}

// Einstellungen gehen auch außerhalb des Spiels auf (Tray); dann bleibt das Overlay sichtbar, bis sie zu sind
function setSettingsOpen(on) {
  settingsOpen = on;
  overlay.webContents.send('settings-open', on);
  if (on) overlay.showInactive();
  else if (overlayHidden) overlay.hide();
  refreshMenu();
}

function setEditMode(on) {
  editMode = on;
  // Steht die Maus beim Beenden noch über Griff/⚙, bliebe uiCaptured hängen: ohne Weiterleitung kommt kein
  // mouseleave mehr, dann wären Griff und ⚙ bis zum Ausblenden tot. Daher Zustand zurücksetzen
  uiCaptured = false;
  if (on) captureMouse();
  else setPassThrough(false);
  overlay.setFocusable(on);
  overlay.webContents.send('edit-mode', on);
  if (on) overlay.showInactive();
  else if (overlayHidden && !settingsOpen) overlay.hide(); // ausgeblendetes Overlay bleibt ausgeblendet
  refreshMenu();
}

function toggleOverlay() {
  overlayHidden = !overlayHidden;
  if (overlayHidden) overlay.hide(); // eingeblendet wird beim nächsten Spiel-Abruf
  if (overlayHidden && settingsOpen) setSettingsOpen(false);
  refreshMenu();
}

// Stand für Tray-Menü und Tastenkürzel
const ui = () => ({ hidden: overlayHidden, editMode, settingsOpen });

// Overlay-Einstellungen ändern: aus dem ⚙ (das Overlay übernimmt die Antwort) oder von außen (Stream Deck, notify:
// das Overlay bekommt den neuen Stand geschickt)
function setOverlay(patch, notify = false) {
  const s = overlaySettings();
  // Farbe auf null = zurück zur Vorgabe
  const colors = Object.fromEntries(Object.entries({ ...s.colors, ...patch.colors }).filter(([, v]) => v));
  saveConfig({ overlay: { ...s, ...patch, modules: { ...s.modules, ...patch.modules }, colors } });
  if (notify && overlay) overlay.webContents.send('overlay-settings', overlaySettings());
  return overlaySettings();
}

// Windows nimmt dem Fenster „immer im Vordergrund“ manchmal weg (z. B. nach Alt+Tab), dann liegt es
// hinter dem Spiel. Daher bei jedem Spiel-Abruf neu setzen; moveTop aktiviert das Fenster nicht.
function raiseOverlay() {
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.moveTop();
}

// Spielstand ins Overlay, jede Sekunde aus der Spiel-Abfrage (summary null = kein Spiel).
// Alt-Tab: liegt ein anderes Fenster vorne, Overlay ausblenden (hing sonst über z. B. WhatsApp)
function showGame(summary) {
  if (summary && !overlayHidden && (gameFocused() || editMode || settingsOpen)) {
    if (!overlay.isVisible()) overlay.showInactive();
    raiseOverlay();
    overlay.webContents.send('game', summary);
  } else if (overlay.isVisible() && !editMode && !settingsOpen) {
    overlay.hide();
  }
}

// Zweiter Start der App: ein ausgeblendetes Overlay kommt zurück, und das Hauptfenster geht auf
function restore() {
  overlayHidden = false;
  if (overlay && overlay.isVisible()) raiseOverlay(); // sonst blendet der nächste Spiel-Abruf es ein
  refreshMenu();
  openMainWindow();
}

// Spiel oder ein Farmy-Fenster vorne (Klick ins ⚙ oder ins Hauptfenster soll das Overlay nicht verstecken).
// Zum Bildschirm-Lesen zählt das Hauptfenster nicht: es liegt dann über dem Spiel und verdeckt das HUD
// (das Overlay selbst taucht in der Aufnahme nicht auf)
const hwnd = (w) => (w && !w.isDestroyed() ? Number(w.getNativeWindowHandle().readBigUInt64LE()) : 0);
const gameFocused = (withMainWin = true) => gamewindow.focused([hwnd(overlay), withMainWin && hwnd(mainWin)].filter(Boolean));

// tab: Reiter, der angezeigt werden soll; inactive: einblenden, ohne dem League-Client den Fokus zu nehmen
// (Champ-Auswahl). Auch Klick-Handler rufen das auf, opts kann dann ein Event sein.
// auto: von der App geöffnet (App-Start, nach dem Spiel). Automatisch geöffnet und nicht benutzt -> schließt sich
// beim Spielstart wieder (im Spiel sieht man es nicht, spart ~125 MB). Klick oder Taste im Fenster = benutzt.
let mainWinUsed = false;
let mainWinAutoClosing = false;
// Windows holt ein Fenster aus einem Hintergrundprogramm mit focus() nicht nach vorne; über dem Spiel landete es
// dahinter. Daher „immer oben“, bis du woanders hinklickst (blur), dann wieder normal. Den Fokus gibt Windows beim
// Öffnen oft kurz und nimmt ihn gleich zurück: ein blur in der ersten Sekunde zählt deshalb nicht
let mainWinRaisedAt = 0;
function raiseMainWindow() {
  mainWinRaisedAt = Date.now();
  mainWin.show();
  // 'floating' (und ohne Ebene) wirkt unter Windows nicht, getestet; 'pop-up-menu' liegt unter dem Overlay
  mainWin.setAlwaysOnTop(true, 'pop-up-menu');
  mainWin.moveTop();
  mainWin.focus();
}
function openMainWindow(opts = {}) {
  const { tab, inactive } = opts;
  const auto = !!(inactive || opts.auto);
  if (mainWin && !mainWin.isDestroyed()) {
    // Strg+Shift+S schaltet um: liegt das Fenster schon oben, verschwindet es wieder (sonst bliebe es über dem
    // Spiel, falls Windows ihm keinen Fokus gab und daher nie ein blur kommt). Nur das Tastenkürzel: Tray, Menü und
    // ein zweiter Start sollen das Fenster immer zeigen, nicht wegschicken
    if (opts.toggle && mainWin.isVisible() && !mainWin.isMinimized() && mainWin.isAlwaysOnTop()) {
      mainWin.setAlwaysOnTop(false);
      return mainWin.minimize();
    }
    if (!auto) mainWinUsed = true;
    if (mainWin.isMinimized()) mainWin.restore();
    if (tab) mainWin.webContents.send('show-tab', tab);
    return inactive ? mainWin.showInactive() : raiseMainWindow();
  }
  mainWinUsed = !auto;
  mainWin = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    // ohne Windows-Rahmen wie das Overlay; Verschieben über Seitenleiste und Kopf, eigene Knöpfe oben rechts
    frame: false,
    title: APP_NAME,
    icon: APP_ICON,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: { preload: PRELOAD },
  });
  mainWin.once('ready-to-show', () => (inactive ? mainWin.showInactive() : raiseMainWindow()));
  mainWin.on('blur', () => {
    const early = 1000 - (Date.now() - mainWinRaisedAt);
    if (early <= 0) return mainWin.setAlwaysOnTop(false);
    // in der ersten Sekunde nicht sofort glauben, aber nachsehen: wer schnell ins Spiel klickt, hätte das Fenster
    // sonst dauerhaft „immer oben“ über dem Spiel
    setTimeout(() => !mainWin.isDestroyed() && !mainWin.isFocused() && mainWin.setAlwaysOnTop(false), early);
  });
  if (tab) mainWin.webContents.once('did-finish-load', () => mainWin.webContents.send('show-tab', tab));
  mainWin.loadFile('renderer/main-window.html');
  // beim ersten Schließen einmal erklären, dass die App im Hintergrund weiterläuft
  mainWin.on('closed', () => {
    if (mainWinAutoClosing) return (mainWinAutoClosing = false);
    if (config.closedHint) return;
    balloon(t('Farmy läuft weiter'), t('Das Overlay bleibt aktiv. Beenden über Rechtsklick aufs Icon hier unten rechts.'));
    saveConfig({ closedHint: true });
  });
}

function closeUnusedMainWindow() {
  if (!mainWin || mainWin.isDestroyed() || mainWinUsed) return;
  mainWinAutoClosing = true;
  mainWin.close();
}

// Menü (Tray-Menü hinter dem ☰-Knopf) im Hauptfenster aufklappen
function popupInMainWindow(menu, pos) {
  if (mainWin && !mainWin.isDestroyed()) menu.popup({ window: mainWin, x: pos.x, y: pos.y });
}

// Beide Fenster neu laden (Sprache gewechselt, Dev: Änderung in renderer/)
function reloadAll() {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.reload();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.reload();
}

// Dev: DevTools für 'overlay' oder 'main' (öffnet das Hauptfenster dafür)
function openDevTools(which) {
  if (which === 'main') openMainWindow();
  const w = which === 'main' ? mainWin : overlay;
  if (w && !w.isDestroyed()) w.webContents.openDevTools({ mode: 'detach' });
}

function register() {
  // Fensterknöpfe des rahmenlosen Hauptfensters
  ipcMain.on('main-window:control', (_e, action) => {
    if (!mainWin || mainWin.isDestroyed()) return;
    if (action === 'min') mainWin.minimize();
    else mainWin.close();
  });
  ipcMain.on('main-window:used', () => {
    mainWinUsed = true;
  });
  // Maus über Griff, ⚙ oder Einstellungen: Fenster fängt Klicks ab, sonst gehen sie durch zum Spiel
  ipcMain.on('ui-hover', (_e, over) => {
    uiCaptured = over;
    if (editMode) return;
    if (over) captureMouse();
    else setPassThrough(true);
  });
  ipcMain.on('hit-rects', (_e, r) => {
    hitRects = r;
  });
  ipcMain.on('overlay:settingsOpen', (_e, on) => setSettingsOpen(on));
  ipcMain.handle('overlay:set', (_e, patch) => setOverlay(patch));
  ipcMain.handle('panel-moved', (_e, pos) => {
    saveConfig({ panel: pos });
  });
  // Entwicklerversion: Änderungen in renderer/ laden sofort neu
  if (DEV) {
    let timer = null;
    fs.watch(path.join(ROOT, 'renderer'), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(reloadAll, 200);
    });
  }
}

module.exports = {
  register, createOverlay, fitOverlay, toOverlay, toMainWindow, setSettingsOpen, setEditMode, toggleOverlay, ui, setOverlay,
  showGame, restore, gameFocused, openMainWindow, closeUnusedMainWindow, popupInMainWindow, reloadAll, openDevTools,
};
