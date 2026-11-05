// Wo League zeichnet: Spielfenster, Lese-Regionen des HUD (src/screen/layout.js) und die Minimap.
// Alles in physischen Pixeln; toDip rechnet für das Overlay um.
const { screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { config } = require('../app/config');
const setup = require('../app/setup');
const layout = require('../screen/layout');
const minimap = require('../screen/minimap');
const gamewindow = require('../screen/gamewindow');
const capture = require('../screen/screengrab');
const { gameFocused } = require('./windows');

// Bereich, in dem League zeichnet: das Spielfenster, ohne Spiel der ganze Hauptbildschirm. Randlos in voller
// Auflösung ist beides gleich; im Fenstermodus oder bei kleinerer Spielauflösung nicht
let gameArea = { x: 0, y: 0, width: 0, height: 0 };
// Regionen aus Auflösung und HUD-Größe (game.cfg); neu bei jedem Spielstart, falls die HUD-Skalierung inzwischen
// geändert wurde
let L = null;
let minimapFound = null;
let minimapTriedAt = 0;

function refresh() {
  const d = screen.getPrimaryDisplay();
  const hud = setup.readHudScale(config.leaguePath);
  gameArea = gamewindow.rect() || { x: 0, y: 0, width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  const a = gameArea;
  L = layout.compute(a.width, a.height, hud || 0, setup.readMinimap(config.leaguePath), a);
  minimapFound = null; // Auflösung oder Minimap-Größe geändert: neu suchen
  capture.setScreen(a); // Spielfenster für die Scoreboard-Suche
  console.log('Layout', JSON.stringify(L.factors), 'HUD-Skalierung', hud, 'Spielfenster', JSON.stringify(a));
}

// game.cfg alle paar Sekunden auf Änderungen prüfen: League schreibt die HUD-Skalierung sofort,
// wenn sie im Spiel geändert wird (nur Änderungszeit lesen, kostet praktisch nichts)
let cfgMtime = 0;
let cfgChecked = 0;
function checkChange() {
  if (Date.now() - cfgChecked < 3000) return;
  cfgChecked = Date.now();
  // Spielfenster verschoben oder in der Größe geändert (Fenstermodus, andere Auflösung): Regionen neu
  const w = gamewindow.rect();
  if (w && ['x', 'y', 'width', 'height'].some((k) => w[k] !== gameArea[k])) return refresh();
  try {
    const m = fs.statSync(path.join(config.leaguePath, 'Config', 'game.cfg')).mtimeMs;
    if (cfgMtime && m !== cfgMtime) refresh();
    cfgMtime = m;
  } catch {
    // game.cfg fehlt -> Standardwerte bleiben
  }
}

// Bildschirm-Regionen sind physische Pixel, das Overlay rechnet in CSS-Pixeln (DIP). Bei Windows-Skalierung
// 125/150 % säßen Badges sonst um diesen Faktor zu weit rechts unten
const toDip = (v) => Math.round(v / screen.getPrimaryDisplay().scaleFactor);

// Minimap auf dem Bildschirm suchen (schwarzer Kartensaum, src/screen/minimap.js): passt so bei jeder Größe, Auflösung
// und mit „Minimap links“. Einmal je Spiel bzw. nach geänderter game.cfg, bei Fehlschlag alle 5 s neu
async function findMinimap() {
  minimapTriedAt = Date.now();
  try {
    const a = gameArea;
    const flip = !!setup.readMinimap(config.leaguePath).flip;
    const side = Math.round(a.height * 0.6);
    const x0 = a.x + (flip ? 0 : a.width - side), y0 = a.y + a.height - side;
    const [crop] = await capture.grab([{ x: x0, y: y0, width: side, height: side }]);
    const m = minimap.find(crop, flip);
    if (m && m.size >= a.height * 0.15) minimapFound = { x: x0 + m.x, y: y0 + m.y, size: m.size };
  } catch (e) {
    console.warn('Minimap suchen:', e.message);
  }
}
// Lage der Minimap { x, y, size }: gefunden oder bis dahin die Maße aus game.cfg (vermessen bei Größe 3).
// Sucht nebenher, solange nichts gefunden ist (nur mit dem Spiel vorne)
function minimapRect() {
  if (!minimapFound && Date.now() - minimapTriedAt > 5000 && gameFocused(false)) findMinimap();
  return minimapFound || L.minimap;
}

module.exports = {
  refresh, checkChange, toDip, minimapRect,
  regions: () => L,
  area: () => gameArea,
  foundMinimap: () => minimapFound,
};
