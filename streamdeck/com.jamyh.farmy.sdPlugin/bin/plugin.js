// Farmy-Plugin für das Stream Deck: holt jede Sekunde die Werte von Farmy (src/main/deck.js,
// http://127.0.0.1:<port>/stats) und schickt Knopfdrücke dorthin (POST /action). Drei Aktionen:
// - Farmy-Wert:      ein Wert aus dem Spiel (stats.js), Drücken/Drehen wechselt den Wert
// - Farmy-Knopf:     Overlay, Hauptfenster, Marke, Build, Auto-Accept (buttons.js), die Taste zeigt den Stand
// - Overlay-Regler:  Drehregler für Größe bzw. Hintergrund-Transparenz des Overlays
// Dazu ein fertiges Profil „Farmy“ (Stream Deck +, manifest.json → Profiles), das man selbst auswählt.
// Ohne Fremdpakete: Node 24 bringt WebSocket und fetch mit. Gezeichnet wird nur, wenn sich das Bild ändert – jedes
// Bild geht per USB ans Gerät, und zu viele davon machen das Stream Deck träge.
const STATS = require('./stats');
const BUTTONS = require('./buttons');
const { C, txt, svg, pct } = require('./look');

// Start-Argumente vom Stream Deck: -port 28196 -pluginUUID … -registerEvent registerPlugin -info {…}
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-/, '')] = process.argv[i + 1];
const info = JSON.parse(args.info || '{}');
const lang = String((info.application && info.application.language) || 'en').startsWith('de') ? 'de' : 'en';

const UUID = { stat: 'com.jamyh.farmy.stat', button: 'com.jamyh.farmy.button', dial: 'com.jamyh.farmy.dial' };
const DEFAULT_PORT = 47101;
const VERSION = 2; // Antwort-Format, das dieses Plugin versteht (deck.js → VERSION)
// Overlay-Regler: Grenzen wie in deck.js → ADJUST
const DIAL = {
  scale: { min: 0.7, max: 1.5, label: { de: 'GRÖSSE', en: 'SIZE' }, show: (v) => `${Math.round(v * 100)} %` },
  bgTransparency: { min: 0, max: 90, label: { de: 'TRANSPARENZ', en: 'TRANSPARENCY' }, show: (v) => `${v} %` },
};

let port = DEFAULT_PORT;
let data = null; // letzte Antwort von Farmy, null = Farmy nicht erreichbar
const actions = new Map(); // context → { uuid, controller, settings, last }

const ws = new WebSocket(`ws://127.0.0.1:${args.port}`);
const send = (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
ws.onopen = () => {
  send({ event: args.registerEvent, uuid: args.pluginUUID });
  send({ event: 'getGlobalSettings', context: args.pluginUUID });
};
ws.onclose = () => process.exit(0);
ws.onmessage = (ev) => {
  const { event, action, context, payload = {} } = JSON.parse(ev.data);
  const a = actions.get(context);
  switch (event) {
    case 'willAppear':
      actions.set(context, { uuid: action, controller: payload.controller, settings: payload.settings || {}, last: null });
      draw(context);
      break;
    case 'willDisappear':
      actions.delete(context);
      break;
    case 'didReceiveSettings':
      if (a) {
        a.settings = payload.settings || {};
        draw(context);
      }
      break;
    case 'didReceiveGlobalSettings':
      port = Number(payload.settings && payload.settings.port) || DEFAULT_PORT;
      break;
    case 'keyDown':
    case 'dialDown':
    case 'touchTap':
      if (a) pressed(context, a);
      break;
    case 'dialRotate':
      if (a) rotated(context, a, payload.ticks);
      break;
  }
};

function pressed(context, a) {
  if (a.uuid === UUID.stat) step(context, a, 1);
  else if (a.uuid === UUID.button) run(context, BUTTONS.pick(a.settings.button).action);
  else if (a.uuid === UUID.dial) save(context, a, { key: dialKey(a) === 'scale' ? 'bgTransparency' : 'scale' });
}
function rotated(context, a, ticks) {
  if (a.uuid === UUID.stat) step(context, a, ticks > 0 ? 1 : -1);
  else if (a.uuid === UUID.dial) run(context, { id: 'adjust', key: dialKey(a), ticks }, true);
}
const dialKey = (a) => (DIAL[a.settings.key] ? a.settings.key : 'scale');

// Einstellung der Taste ändern, gespeichert wie eine Auswahl im Einstellungsfeld
function save(context, a, patch) {
  a.settings = { ...a.settings, ...patch };
  send({ event: 'setSettings', context, payload: a.settings });
  draw(context);
}
// Farmy-Wert: nächster bzw. vorheriger Wert
function step(context, a, dir) {
  const ids = STATS.list.map((s) => s.id);
  const i = ids.indexOf(STATS.pick(a.settings.stat).id);
  save(context, a, { stat: ids[(i + dir + ids.length) % ids.length] });
}

// Knopf an Farmy schicken; quiet: kein Häkchen (Drehregler, sonst blinkt es bei jeder Raste)
async function run(context, body, quiet = false) {
  let res = null;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    res = await r.json();
  } catch {
    res = null; // Farmy aus
  }
  if (!res || !res.ok) send({ event: 'showAlert', context });
  else if (!quiet) send({ event: 'showOk', context });
  poll(); // Stand sofort zeigen, nicht erst in einer Sekunde
}

function viewOf(a) {
  if (a.uuid === UUID.button) return BUTTONS.view(BUTTONS.pick(a.settings.button), data, lang);
  if (a.uuid === UUID.dial) {
    const key = dialKey(a);
    const d = DIAL[key];
    const label = d.label[lang] || d.label.en;
    if (!data) return { label, value: '–', sub: txt(lang).off, color: C.dim, bar: null };
    const v = data.overlay[key];
    return { label, value: d.show(v), bar: pct(((v - d.min) / (d.max - d.min)) * 100), color: C.text };
  }
  return STATS.view(STATS.pick(a.settings.stat), data, lang);
}

function draw(context) {
  const a = actions.get(context);
  if (!a) return;
  const view = viewOf(a);
  if (a.controller === 'Encoder') {
    const feedback = {
      title: view.label,
      value: view.sub ? `${view.value}  ${view.sub}` : String(view.value),
      indicator: { value: view.bar == null ? 0 : view.bar },
    };
    const key = JSON.stringify(feedback);
    if (key === a.last) return;
    a.last = key;
    send({ event: 'setFeedback', context, payload: feedback });
  } else {
    const image = svg(view);
    if (image === a.last) return;
    a.last = image;
    send({ event: 'setImage', context, payload: { image: `data:image/svg+xml;charset=utf8,${encodeURIComponent(image)}`, target: 0 } });
  }
}

let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/stats`, { signal: AbortSignal.timeout(800) });
    const json = res.ok ? await res.json() : null;
    data = json && json.v === VERSION ? json : null;
  } catch {
    data = null; // Farmy aus oder Brücke abgeschaltet
  }
  polling = false;
  for (const context of actions.keys()) draw(context);
}
setInterval(poll, 1000);
