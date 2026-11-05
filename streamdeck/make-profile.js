// Baut das mitgelieferte Stream-Deck-Profil „Farmy“ (Stream Deck +: 4×2 Tasten, 4 Drehregler) als
// com.jamyh.farmy.sdPlugin/profiles/Farmy.streamDeckProfile. Auswählen tut man es selbst.
// Aufruf: node streamdeck/make-profile.js  (danach Plugin-Version in manifest.json hochzählen, sonst installiert das
// Stream Deck das neue Profil nicht). Format wie die Profile des Stream Decks (ProfilesV3, Version 3.0): eine ZIP mit
// <UUID>.sdProfile/manifest.json und je Seite Profiles/<SEITE>/manifest.json.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PLUGIN = JSON.parse(fs.readFileSync(path.join(__dirname, 'com.jamyh.farmy.sdPlugin', 'manifest.json'), 'utf8'));
const OUT = path.join(__dirname, 'com.jamyh.farmy.sdPlugin', 'profiles', 'Farmy.streamDeckProfile');
// feste IDs, damit ein neu gebautes Profil das alte ersetzt statt daneben zu landen
const PROFILE_ID = '5F4A2C1E-7B3D-4E8A-9C6F-0A1B2C3D4E5F';
const PAGE_ID = '8E2D6F4A-1C3B-4A5E-9D7F-6B8C0E2A4F1D';
// leere Vorlage-Seite: das Stream Deck führt „Default“ getrennt von den sichtbaren Seiten (wie in eigenen Profilen)
const DEFAULT_ID = '3B7C9E1F-5A2D-4C6B-8E0F-2D4A6C8E0B1A';

let n = 0;
function action(uuid, name, settings) {
  n += 1;
  return {
    ActionID: `f4a1e000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    LinkedTitle: true,
    Name: name,
    Plugin: { Name: PLUGIN.Name, UUID: PLUGIN.UUID, Version: PLUGIN.Version },
    Resources: null,
    Settings: settings,
    State: 0,
    States: [{ ShowTitle: false }],
    UUID: uuid,
  };
}
const stat = (id) => action('com.jamyh.farmy.stat', 'Farmy-Wert', { stat: id });
const button = (id) => action('com.jamyh.farmy.button', 'Farmy-Knopf', { button: id });
const dial = (key) => action('com.jamyh.farmy.dial', 'Overlay-Regler', { key });

// Belegung: oben die Werte, die man im Spiel am häufigsten anschaut, unten Knöpfe und Timer; Regler: Overlay + Session
const page = {
  Controllers: [
    { Type: 'Keypad', Actions: {
      '0,0': stat('csm'), '1,0': stat('kda'), '2,0': stat('spellD'), '3,0': stat('spellF'),
      '0,1': button('overlay'), '1,1': button('mark'), '2,1': stat('item'), '3,1': stat('xp'),
    } },
    { Type: 'Encoder', Actions: {
      '0,0': dial('scale'), '1,0': dial('bgTransparency'), '2,0': stat('time'), '3,0': stat('session'),
    } },
  ],
  Icon: '',
  Name: '',
};
const profile = {
  Device: { Model: '20GBD9901', UUID: '' }, // Stream Deck +
  Name: 'Farmy',
  Pages: { Current: PAGE_ID.toLowerCase(), Default: DEFAULT_ID.toLowerCase(), Pages: [PAGE_ID.toLowerCase()] },
  Version: '3.0',
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'farmy-profile-'));
const root = path.join(tmp, `${PROFILE_ID}.sdProfile`);
fs.mkdirSync(path.join(root, 'Images'), { recursive: true });
fs.mkdirSync(path.join(root, 'Profiles', PAGE_ID, 'Images'), { recursive: true });
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(profile));
fs.writeFileSync(path.join(root, 'Profiles', PAGE_ID, 'manifest.json'), JSON.stringify(page));
fs.mkdirSync(path.join(root, 'Profiles', DEFAULT_ID, 'Images'), { recursive: true });
fs.writeFileSync(path.join(root, 'Profiles', DEFAULT_ID, 'manifest.json'),
  JSON.stringify({ Controllers: [{ Type: 'Keypad', Actions: {} }, { Type: 'Encoder', Actions: {} }], Icon: '', Name: '' }));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(OUT, { force: true });
// Windows-tar (bsdtar) schreibt ZIP mit Schrägstrichen, wie das Stream Deck sie erwartet. Ausdrücklich das aus
// System32: das tar von Git Bash (GNU) kann kein ZIP
execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'),['--format=zip', '-cf', OUT, '-C', tmp, `${PROFILE_ID}.sdProfile`]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Profil geschrieben: ${OUT}`);
