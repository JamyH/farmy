// Maus: Panel ziehen, bedienbare Teile an den Hauptprozess melden (nur dort fängt das Overlay die Maus,
// sonst gehen Klicks ans Spiel), Hover-Zustand

// Bearbeiten-Modus: Panel verschieben, Position wird in config.json gespeichert
window.lol.onPanelPos((p) => {
  const c = clampPos(p.x, p.y);
  panel.style.left = `${c.x}px`;
  panel.style.top = `${c.y}px`;
  if (!$('settings').hidden) placeSettings(); // kommt beim Laden nach „settings-open“
  reportRects();
});
// Lage der bedienbaren Teile an main melden: nur in ihrer Nähe werden Mausbewegungen ans Overlay
// weitergeleitet; über dem Panel schaltet main die Hover-Transparenz
const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
function reportRects() {
  const box = $('settings');
  window.lol.hitRects({ grip: rectOf(grip), gear: rectOf($('gear')), panel: rectOf(panel), settings: box.hidden ? null : rectOf(box) });
}
window.lol.onEditMode((on) => document.body.classList.toggle('edit', on));
window.lol.onPanelHover((on) => document.body.classList.toggle('panel-hover', on));

// Maus über einem bedienbaren Teil: Overlay fängt die Maus (Klicks gehen dann nicht ans Spiel).
// hot = Teile, über denen die Maus gerade steht; holding = Regler wird gerade gezogen
let drag = null;
let holding = false;
let hotSent = false;
const hot = new Set();
const grip = $('grip');
function sendHover() {
  const on = hot.size > 0 || holding || !!drag;
  document.body.classList.toggle('ui-hot', on);
  if (on === hotSent) return;
  hotSent = on;
  window.lol.uiHover(on);
}
function hotZone(el, active = () => true) {
  el.addEventListener('mouseenter', () => {
    if (!active()) return;
    hot.add(el);
    sendHover();
  });
  el.addEventListener('mouseleave', () => {
    if (hot.delete(el)) sendHover();
  });
}
hotZone(grip);
hotZone($('gear'));
hotZone($('settings'));
hotZone(panel, () => settings && !settings.clickThrough);

panel.addEventListener('mousedown', (e) => {
  if (e.target === $('gear')) return;
  const free = document.body.classList.contains('edit') || (settings && !settings.clickThrough);
  if (!free && e.target !== grip) return;
  drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
  document.body.classList.add('dragging');
});
window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const c = clampPos(e.clientX - drag.dx, e.clientY - drag.dy);
  panel.style.left = `${c.x}px`;
  panel.style.top = `${c.y}px`;
});
window.addEventListener('mouseup', () => {
  holding = false;
  if (drag) {
    drag = null;
    document.body.classList.remove('dragging');
    window.lol.panelMoved({ x: panel.offsetLeft, y: panel.offsetTop });
    reportRects();
    if (!$('settings').hidden) placeSettings();
  }
  sendHover();
});

// Overlay ausgeblendet (Spielende): kein mouseleave mehr, daher Maus-Zustand hier vergessen; main setzt
// seine Seite beim Ausblenden ebenfalls zurück
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  hot.clear();
  holding = false;
  hotSent = false;
  document.body.classList.remove('ui-hot', 'panel-hover');
});
