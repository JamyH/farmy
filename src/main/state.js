// Zustand, den mehrere Teile des Hauptprozesses lesen. Geschrieben wird jedes Feld nur an den Stellen, die am Feld
// stehen. Dazu Tray-Menü und Tray-Meldungen als Ereignisse: so muss kein Modul das Tray kennen (tray.js hört zu)
const { EventEmitter } = require('events');

const state = {
  phase: null, // Client-Phase (gameflow), null = Client zu. client.js
  // 'sr' oder 'aram' (auch ARAM Mayhem): aus der Map der Champ-Auswahl bzw. des laufenden Spiels. Bestimmt
  // lolalytics-Seite, Item-Set-Map und Riots Runen-Empfehlung. champselect.js und game.js
  gameMode: 'sr',
  champion: null, // zuletzt gespielter / gewählter Champion (Data-Dragon-ID). champselect.js und game.js
  position: '', // Rolle aus der letzten Champ-Auswahl, für Riots Runen-Empfehlung. champselect.js
  gameRunning: false, // game.js
  data: null, // letzte Antwort der Live-API, null ohne Spiel. game.js
  items: [], // Inventar aus der Live-API, damit die Bildschirm-Abfrage nur belegte Item-Slots liest. game.js
  dead: false, // tot: Bildschirm grau, Cooldown-Erkennung der Summoner unzuverlässig. game.js
  blueSpells: {}, // { d, f }: Summoner mit blauem Symbol, siehe ocr.spellOnCooldown. game.js
  screenReading: false, // Bildschirm-Erkennung eingeschaltet (config.ocr.enabled) und bereit. screen-reader.js
};
const mapId = () => (state.gameMode === 'aram' ? 12 : 11);

const events = new EventEmitter();
// Häkchen und Einträge im Tray-Menü haben sich geändert
const refreshMenu = () => events.emit('menu');
// Meldung am Tray-Icon
const balloon = (title, content) => events.emit('balloon', title, content);

module.exports = { state, mapId, events, refreshMenu, balloon };
