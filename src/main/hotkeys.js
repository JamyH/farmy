// Tastenkürzel: außerhalb des Spiels als globale Hotkeys, im Spiel zusätzlich über die Tastenabfrage (scoreboard.js →
// src/screen/keys.js), weil League sie dort schluckt. Falls beide Wege dieselbe Taste sehen, zählt sie nur einmal
const { globalShortcut } = require('electron');
const { config } = require('../app/config');
const { DEV } = require('./env');
const windows = require('./windows');
const reader = require('./screen-reader');

const lastHotkey = {};
const once = (name, run) => () => {
  if (Date.now() - (lastHotkey[name] || 0) < 400) return;
  lastHotkey[name] = Date.now();
  run();
};
const HOTKEYS = {
  toggleOverlay: once('toggleOverlay', () => windows.toggleOverlay()),
  editMode: once('editMode', () => windows.setEditMode(!windows.ui().editMode)),
  openMain: once('openMain', () => windows.openMainWindow({ toggle: true })),
};
// FarmyDevBuild: Lese-Bereiche ein/aus (fest, nicht in config.json)
const DEV_HOTKEYS = { debugRegions: 'Ctrl+Shift+D' };
if (DEV) HOTKEYS.debugRegions = once('debugRegions', () => reader.toggleDebugRegions());
const hotkeyFor = (name) => config.hotkeys[name] || DEV_HOTKEYS[name];

// für die Tastenabfrage im Spiel
const actions = () => Object.entries(HOTKEYS).map(([name, run]) => ({ accelerator: hotkeyFor(name), run }));

function register() {
  for (const [name, run] of Object.entries(HOTKEYS)) {
    if (!globalShortcut.register(hotkeyFor(name), run)) console.warn(`Tastenkürzel ${hotkeyFor(name)} ist belegt`);
  }
}

module.exports = { register, actions, DEV_HOTKEYS };
