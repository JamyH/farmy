// Tastenabfrage im Spiel (src/screen/keys.js): Tab fürs Scoreboard und die Jungle-Route, dazu die Tastenkürzel,
// die League im Spiel als globale Hotkeys schluckt. Läuft nur während eines Spiels (Start/Ende in game.js).
//
// Tab-Scoreboard: die Tab-Taste steuert Ein- und Ausblenden sofort (Taste wird nur gelesen, das Spiel
// bekommt sie normal). Kurz nach dem Drücken bestätigt ein Pixel-Check, dass das Scoreboard wirklich offen ist
// und wo es liegt (es lässt sich verschieben); neuer Anker wird gespeichert, sonst wird wieder ausgeblendet.
const { config, saveConfig, moduleOn } = require('../app/config');
const capture = require('../screen/screengrab');
const keys = require('../screen/keys');
const { state } = require('./state');
const hud = require('./hud');
const hotkeys = require('./hotkeys');
const windows = require('./windows');

let sbOpen = false;
let tabDown = false;
let tabPressId = 0;

// gelernter Anker gilt nur, solange er im Spielfenster liegt (Fenster verschoben -> Standardlage)
const sbAnchor = () => {
  const a = hud.area(), saved = config.scoreboard.anchor;
  if (saved && saved.x >= a.x && saved.x < a.x + a.width && saved.y >= a.y && saved.y < a.y + a.height) return saved;
  return { x: Math.round(a.x + a.width / 2), y: Math.round(a.y + 406 * hud.regions().factors.res) };
};
// Ausschnitt um den letzten bekannten Scoreboard-Anker (wächst mit der Auflösung)
const sbNear = (a) => {
  const s = hud.regions().scoreboard.scale;
  return { x: Math.max(0, Math.round(a.x - 200 * s)), y: Math.max(0, Math.round(a.y - 180 * s)), width: Math.round(400 * s), height: Math.round(220 * s) };
};

function sendScoreboard(open, anchor) {
  sbOpen = open;
  const dip = hud.toDip;
  const a = anchor || sbAnchor(), o = hud.regions().scoreboard.offsets;
  const offsets = { ...o, top: dip(o.top), badgeX: dip(o.badgeX), badgeXRight: dip(o.badgeXRight), badgeDy: dip(o.badgeDy),
    rows: o.rows.map((r) => (r == null ? r : dip(r))) };
  windows.toOverlay('scoreboard-state', { open, anchor: { x: dip(a.x), y: dip(a.y) }, offsets });
}

async function confirmScoreboard(pressId) {
  const sb = config.scoreboard;
  const a = sbAnchor();
  const scale = hud.regions().scoreboard.scale;
  const stillThisPress = () => tabDown && pressId === tabPressId;
  try {
    for (const waitMs of sb.confirmMs) {
      await new Promise((r) => setTimeout(r, waitMs));
      if (!stillThisPress()) return;
      const found =
        (await capture.findScoreboard(sbNear(a), scale)) || (await capture.findScoreboard(null, scale));
      if (!stillThisPress()) return;
      if (found) {
        if (found.x !== a.x || found.y !== a.y) {
          saveConfig({ scoreboard: { ...config.scoreboard, anchor: found } });
          sendScoreboard(true, found);
        }
        return;
      }
    }
    // nach allen Versuchen nichts gefunden (z. B. Tab im Chat): wieder ausblenden
    if (stillThisPress()) sendScoreboard(false);
  } catch (e) {
    console.warn('Scoreboard:', e.message);
  }
}

function start() {
  const scoreboardOn = !!(config.scoreboard && config.scoreboard.enabled);
  keys.start(
    () => {
      // Tab in einem anderen Fenster (Alt-Tab in Discord, Browser): das Overlay ist dann ausgeblendet, die
      // Scoreboard-Suche über den ganzen Bildschirm wäre vergebens
      if (!windows.gameFocused(false)) return;
      windows.toOverlay('tab-held', true); // Jungle-Route auf der Minimap nur, solange Tab gedrückt ist
      // im ⚙ abgeschaltet oder ohne Bildschirm-Erkennung: keine Scoreboard-Suche
      if (!scoreboardOn || !state.screenReading || !moduleOn('scoreboard')) return;
      tabDown = true;
      tabPressId++;
      sendScoreboard(true);
      confirmScoreboard(tabPressId);
    },
    () => {
      windows.toOverlay('tab-held', false);
      tabDown = false;
      if (sbOpen) sendScoreboard(false);
    },
    hotkeys.actions(),
  );
}
function stop() {
  keys.stop();
  tabDown = false;
  windows.toOverlay('tab-held', false);
  if (sbOpen) sendScoreboard(false);
}

module.exports = { start, stop };
