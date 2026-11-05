// Einstellungsfelder der drei Aktionen (stat.html, button.html, dial.html): eine Auswahl je Taste
// (<select id="choice" data-setting="…">, Einträge aus window.FARMY_CHOICES) und für alle Tasten gemeinsam
// der Farmy-Port
let ws;
let uuid;
let settings = {};
const send = (msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));

// Vom Stream Deck aufgerufen, sobald das Feld offen ist
// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(port, inUUID, registerEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  const lang = String(JSON.parse(inInfo).application.language || 'en').startsWith('de') ? 'de' : 'en';
  document.querySelectorAll('[data-de]').forEach((el) => { el.textContent = el.dataset[lang]; });

  const select = document.getElementById('choice');
  const key = select.dataset.setting;
  const choices = window.FARMY_CHOICES;
  for (const c of choices) select.add(new Option(c.name[lang], c.id));
  const current = (s) => (choices.some((c) => c.id === s[key]) ? s[key] : choices[0].id);
  settings = JSON.parse(inActionInfo).payload.settings || {};
  select.value = current(settings);
  select.onchange = () => {
    settings = { ...settings, [key]: select.value };
    send({ event: 'setSettings', context: uuid, payload: settings });
  };

  let global = {};
  const portInput = document.getElementById('port');
  portInput.onchange = () => {
    const p = Number(portInput.value);
    global = { ...global, port: p || undefined };
    send({ event: 'setGlobalSettings', context: uuid, payload: global });
  };

  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen = () => {
    send({ event: registerEvent, uuid });
    send({ event: 'getGlobalSettings', context: uuid });
  };
  ws.onmessage = (ev) => {
    const { event, payload } = JSON.parse(ev.data);
    // Drücken/Drehen am Gerät ändert die Auswahl: mitziehen
    if (event === 'didReceiveSettings') select.value = current((settings = payload.settings || {}));
    if (event === 'didReceiveGlobalSettings') {
      global = payload.settings || {};
      portInput.value = global.port || '';
    }
  };
}
