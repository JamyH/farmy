// Overlay: gemeinsame Helfer und Zustand. Klassische Skripte mit gemeinsamem Namensraum, Reihenfolge in
// overlay.html: core, overlays, panel, mouse, settings

const $ = (id) => document.getElementById(id);
const panel = $('panel');
i18n.setLang(window.lol.lang);
i18n.translatePage(document);
const { t, num } = i18n;

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const signed = (n) => `${n >= 0 ? '+' : ''}${num(n)}`;
const cls = (n) => (n >= 0 ? 'good' : 'bad');
// +450 / +1,2k / -12k: höchstens 5 Zeichen
const compact = (n) => {
  const a = Math.abs(n);
  const v = a < 1000 ? String(a) : a < 10000 ? `${num(a / 1000, 1)}k` : `${Math.round(a / 1000)}k`;
  return `${n >= 0 ? '+' : '-'}${v}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// innerHTML nur bei geänderter Ausgabe neu setzen: jede Sekunde neue Knoten (und neu dekodierte Icons) kostet
// das Overlay sonst laufend Arbeit, obwohl sich meist nichts ändert
const setHtml = (el, html) => {
  if (el.__html === html) return false;
  el.__html = html;
  el.innerHTML = html;
  return true;
};
// dasselbe für reinen Text: gleicher Text neu gesetzt ersetzt trotzdem den Textknoten (Layout und Neuzeichnen)
const setText = (el, text) => {
  text = text == null ? '' : String(text); // wie textContent = null/undefined
  if (el.textContent !== text) el.textContent = text;
};
// Panel bleibt im Bild (Ziehen, gespeicherte Position nach Auflösungswechsel)
const clampPos = (x, y) => ({
  x: Math.max(0, Math.min(x, window.innerWidth - panel.offsetWidth)),
  y: Math.max(0, Math.min(y, window.innerHeight - panel.offsetHeight)),
});

// letzter Spielstand vom Hauptprozess (panel.js), für Scoreboard und Neuzeichnen nach geänderten Einstellungen
let lastGame = null;

// Overlay-Einstellungen (⚙), setzt settings.js
let settings = null;
const moduleOn = (key) => !settings || settings.modules[key] !== false;
const isCompact = () => !!(settings && settings.compact);
