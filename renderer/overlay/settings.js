// Overlay-Einstellungen im ⚙-Fenster neben dem Panel

// Overlay-Einstellungen (⚙ im Panel-Kopf oder Tray): Module ein/aus, UI-Größe, Transparenz, Klick-durch.
// Gespeichert in config.json unter „overlay“; main liest dieselben Werte (abgeschaltete Module werden dort
// gar nicht erst vom Bildschirm gelesen)
const MODULES = [
  ['Panel', [
    ['stats', 'Werte (KDA, CS, Gold, Vision)'],
    ['skill', 'Skill-Hinweis'],
    ['build', 'Spar-Ziel und Recall'],
    ['mana', 'Mana und NO MANA'],
    ['spells', 'Summoner-Cooldowns'],
    ['items', 'Item-Cooldowns'],
    ['xp', 'XP bis Level-Up'],
    ['lane', 'Lane-Gegner'],
    ['team', 'Team-Itemwert'],
    ['ward', 'Ward-Cooldown'],
    ['csTarget', 'CS-Ziel'],
    ['clear', 'Erste Runde (Jungle)'],
    ['gank', 'Lane-Stand (Jungle)'],
    ['threat', 'Gegner-Team und Items dagegen'],
    ['quest', 'Rollen-Quest'],
    ['goal', 'Session-Ziel'],
    ['tips', 'Hinweise aus deinen Spielen'],
  ]],
  ['Weitere Overlays', [
    ['scoreboard', 'Tab: Itemwert je Spieler'],
    ['augments', 'Mayhem: Augment-Tiers'],
    ['jungleRoute', 'Jungle-Route auf der Minimap'],
    ['review', 'Rückblick: Tode und Ulti mitlesen'],
  ]],
];
// [Schlüssel, Name, min, max, Schritt, Anzeige]
const SLIDERS = [
  ['scale', 'UI-Größe', 0.7, 1.5, 0.05, (v) => num(v, 2)],
  ['bgTransparency', 'Hintergrund-Transparenz', 0, 90, 5, (v) => `${v} %`],
  ['hoverTransparency', 'Hover-Transparenz', 0, 90, 5, (v) => `${v} %`],
  ['jungleSize', 'Jungle-Route: Größe', 0.5, 2, 0.1, (v) => num(v, 1)],
  ['jungleTransparency', 'Jungle-Route: Transparenz', 0, 90, 5, (v) => `${v} %`],
];
// [Schlüssel, Name, Vorgabe wie in overlay.css]
const COLORS = [
  ['panel', 'Hintergrund', '#16181d'],
  ['accent', 'Akzent', '#5eead4'],
  ['text', 'Text', '#e8eaed'],
  ['gold', 'Gold', '#f2c14e'],
  ['bad', 'Warnung', '#ff8a7a'],
];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Schrift auf Akzent-, Gold- und Warn-Flächen: dunkel auf hellen Farben, sonst weiß
const ink = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#111111' : '#ffffff';
};


function buildSettings() {
  const toggle = (attr, key, name) =>
    `<label class="toggle"><span>${esc(t(name))}</span><input type="checkbox" ${attr}="${key}"><i></i></label>`;
  $('settingsBody').innerHTML =
    MODULES.map(([title, list]) => `<h4>${t(title)}</h4>${list.map(([k, n]) => toggle('data-mod', k, n)).join('')}`).join('') +
    `<h4>${t('Allgemein')}</h4>` +
    toggle('data-opt', 'compact', 'Kompakt-Modus') +
    toggle('data-opt', 'clickThrough', 'Klick-durch') +
    SLIDERS.map(([k, n, min, max, step]) =>
      `<div class="slider"><label><span>${t(n)}</span><output data-out="${k}"></output></label>` +

      `<input type="range" data-range="${k}" min="${min}" max="${max}" step="${step}"></div>`).join('') +
    `<h4>${t('Farben')}</h4>` +
    COLORS.map(([k, n]) => `<label class="color"><span>${esc(t(n))}</span><input type="color" data-color="${k}"></label>`).join('') +
    `<button type="button" id="colorsReset" class="reset">${esc(t('Farben zurücksetzen'))}</button>`;

  $('settingsBody').querySelectorAll('[data-mod]').forEach((el) => el.addEventListener('change', () =>
    save({ modules: { [el.dataset.mod]: el.checked } })));
  $('settingsBody').querySelectorAll('[data-opt]').forEach((el) => el.addEventListener('change', () =>
    save({ [el.dataset.opt]: el.checked })));
  $('settingsBody').querySelectorAll('[data-range]').forEach((el) => {
    const key = el.dataset.range;
    // beim Ziehen sofort anzeigen, gespeichert wird beim Loslassen
    el.addEventListener('input', () => applySettings({ ...settings, [key]: Number(el.value) }));
    el.addEventListener('change', () => save({ [key]: Number(el.value) }));
  });
  $('settingsBody').querySelectorAll('[data-color]').forEach((el) => {
    const key = el.dataset.color;
    // wie bei den Reglern: beim Auswählen anzeigen, gespeichert wird beim Schließen des Farbwählers
    el.addEventListener('input', () => applySettings({ ...settings, colors: { ...settings.colors, [key]: el.value } }));
    el.addEventListener('change', () => save({ colors: { [key]: el.value } }));
  });
  $('colorsReset').addEventListener('click', () => save({ colors: Object.fromEntries(COLORS.map(([k]) => [k, null])) }));
  $('settings').addEventListener('mousedown', () => {
    holding = true;
    sendHover();
  });
  $('settingsClose').addEventListener('click', () => window.lol.settingsOpen(false));
  $('gear').addEventListener('click', () => window.lol.settingsOpen($('settings').hidden));
}
const save = (patch) => window.lol.setOverlay(patch).then(applySettings);

function applySettings(s) {
  settings = s;
  const root = document.documentElement.style;
  root.setProperty('--ui', s.scale);
  root.setProperty('--bg-a', (1 - s.bgTransparency / 100).toFixed(2));
  root.setProperty('--hover-op', (1 - s.hoverTransparency / 100).toFixed(2));
  // nicht gesetzte Farben: Vorgabe aus overlay.css
  const colors = s.colors || {};
  for (const [k] of COLORS) {
    const c = colors[k];
    const vars = k === 'panel' ? { '--panel-rgb': c && rgb(c).join(', ') } :
      k === 'text' ? { '--text': c } : { [`--${k}`]: c, [`--${k}-ink`]: c && ink(c) };
    for (const [v, val] of Object.entries(vars)) val ? root.setProperty(v, val) : root.removeProperty(v);
  }
  for (const [, list] of MODULES) for (const [k] of list) document.body.classList.toggle(`off-${k}`, s.modules[k] === false);
  document.body.classList.toggle('click-through', s.clickThrough);
  document.body.classList.toggle('compact', !!s.compact);
  // Kompakt-Modus und Fußzeile hängen an den Einstellungen: sofort neu zeichnen, nicht erst beim nächsten Abruf
  if (lastGame) renderGame(lastGame);
  renderJungleRoute();

  const body = $('settingsBody');
  body.querySelectorAll('[data-mod]').forEach((el) => { el.checked = s.modules[el.dataset.mod] !== false; });
  body.querySelectorAll('[data-opt]').forEach((el) => { el.checked = !!s[el.dataset.opt]; });
  for (const [k, , def] of COLORS) body.querySelector(`[data-color="${k}"]`).value = colors[k] || def;
  for (const [k, , , , , show] of SLIDERS) {
    const el = body.querySelector(`[data-range="${k}"]`);
    if (Number(el.value) !== s[k]) el.value = s[k];
    body.querySelector(`[data-out="${k}"]`).textContent = show(s[k]);
  }
  // Panel kann durch Ausblenden oder Skalieren die Größe ändern: Maus-Zonen neu melden
  requestAnimationFrame(reportRects);
}

// Neben das Panel, auf die Seite mit mehr Platz. Abstand nach der größten UI-Größe: so bleibt das Fenster beim
// Ziehen am Größen-Regler stehen (rückte es mit, rutschte der Regler unter der Maus weg) und das Panel wächst
// trotzdem nie darunter
const MAX_SCALE = SLIDERS.find(([k]) => k === 'scale')[3];
function placeSettings() {
  const box = $('settings');
  const left = panel.offsetLeft;
  const top = panel.offsetTop;
  const w = box.offsetWidth;
  const reach = left + panel.offsetWidth * MAX_SCALE + 12;
  const right = reach + w <= window.innerWidth;
  box.style.left = `${right ? reach : Math.max(8, left - 12 - w)}px`;
  box.style.top = `${Math.max(8, Math.min(top, window.innerHeight - box.offsetHeight - 8))}px`;
  reportRects(); // Verschieben meldet kein ResizeObserver
}

buildSettings();
new ResizeObserver(reportRects).observe(panel);
new ResizeObserver(reportRects).observe($('settings'));
window.lol.onOverlaySettings(applySettings);
window.lol.onSettingsOpen((on) => {
  $('settings').hidden = !on;
  document.body.classList.toggle('settings-open', on);
  if (on) placeSettings();
  else {
    hot.delete($('settings'));
    holding = false;
    sendHover();
  }
  reportRects();
});
