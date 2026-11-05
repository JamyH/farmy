// FarmyDevBuild: heruntergeladene Mods so in Rose' Mods-Ordner (%LOCALAPPDATA%\Rose\mods) legen, wie Rose' eigener
// Import es tut (injection/mods/storage.py in github.com/Alban1911/Rose), damit Rose sie in der Champ-Auswahl anbietet:
// - Skin-Mods: Archiv unverändert nach skins\<Champion-Key × 1000>\, Eintrag in rose_mod_targets.json mit den
//   Skin-IDs, die der Mod ersetzt (Rose entpackt Archive erst beim Einspielen)
// - alle anderen Kategorien: entpackter Ordner unter <Kategorie>\, Eintrag in rose_category_mods.json
//   (.modpkg kann nur Rose selbst entpacken, dafür braucht es zstd)
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Rose', 'mods') : null;
const ARCHIVES = ['.fantome', '.zip', '.modpkg'];
// RuneForge-Kategorie -> Rose-Ordner
const CATEGORIES = {
  champion_skin: 'skins', map_skin: 'maps', font: 'fonts', announcer: 'announcers', ui: 'ui', voiceover: 'voiceover',
  loading_screen: 'loading_screen', vfx: 'vfx', sfx: 'sfx', other: 'others',
};

// Windows-tauglicher Ordner-/Dateiname, bei Bedarf mit „ (2)“ eindeutig
function freeName(dir, title, ext = '') {
  const base = String(title).replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).replace(/[ .]+$/, '') || 'Mod';
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} (${n})`;
    if (!fs.existsSync(path.join(dir, name + ext))) return name;
  }
}

// Manifest lesen: {} wenn es keins gibt; ist es kaputt, nicht überschreiben (sonst wären Rose' andere Mods weg)
function readManifest(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    return m && typeof m === 'object' ? m : {};
  } catch {
    throw new Error(`${path.basename(file)} ist nicht lesbar, Mod nicht eingetragen`);
  }
}
// wie Rose: erst in eine Zwischendatei, dann umbenennen
function writeManifest(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function importSkin(file, { championKey, skinIds, title }) {
  const dir = path.join(ROOT, 'skins', String(championKey * 1000));
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file).toLowerCase();
  const name = freeName(dir, title, ext);
  const manifestFile = path.join(dir, 'rose_mod_targets.json');
  const manifest = readManifest(manifestFile);
  fs.copyFileSync(file, path.join(dir, name + ext));
  // Rose findet den Eintrag über den Dateinamen ohne Endung
  const mods = { ...(manifest.mods || {}), [name]: { name, targets: skinIds, displayName: String(title).slice(0, 100) } };
  writeManifest(manifestFile, {
    version: 1, championId: championKey, targets: manifest.targets || [],
    mods: Object.fromEntries(Object.entries(mods).sort(([a], [b]) => a.localeCompare(b))),
  });
  return path.join(dir, name + ext);
}

// .zip/.fantome mit dem tar von Windows entpacken (bsdtar: kann zip, lehnt Pfade mit „..“ und absolute Pfade ab).
// Fester Pfad, ein anderes tar im PATH (z. B. GNU tar aus Git) hält „C:“ für einen Netzwerk-Rechner
const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const untar = (file, dest) => new Promise((resolve, reject) => {
  execFile(TAR, ['-xf', file, '-C', dest], { windowsHide: true }, (err, out, errOut) => (err ? reject(new Error(errOut || err.message)) : resolve()));
});

async function importCategory(file, category, title) {
  if (path.extname(file).toLowerCase() === '.modpkg') {
    throw new Error('.modpkg-Mods für diese Kategorie kann nur Rose selbst entpacken (im Client über Rose „+ Mod hinzufügen“)');
  }
  const dir = path.join(ROOT, category);
  fs.mkdirSync(dir, { recursive: true });
  const name = freeName(dir, title);
  const manifestFile = path.join(dir, 'rose_category_mods.json');
  const manifest = readManifest(manifestFile);
  const tmp = fs.mkdtempSync(path.join(dir, '.rose-import-')); // Rose' eigenes Präfix, räumt es notfalls selbst weg
  try {
    await untar(file, tmp);
    if (!fs.readdirSync(tmp).length) throw new Error('Archiv ist leer');
    fs.renameSync(tmp, path.join(dir, name));
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  const mods = { ...(manifest.mods || {}), [name]: { name, path: name } };
  writeManifest(manifestFile, {
    ...manifest, version: 1, category, mods: Object.fromEntries(Object.entries(mods).sort(([a], [b]) => a.localeCompare(b))),
  });
  return path.join(dir, name);
}

// mod: { file, category (RuneForge), championKey, skinIds, title } -> Zielpfad in Rose' Mods-Ordner
async function importMod(mod) {
  if (!ROOT || !fs.existsSync(ROOT)) throw new Error('Rose-Mods-Ordner nicht gefunden (Rose installiert?)');
  if (!ARCHIVES.includes(path.extname(mod.file).toLowerCase())) throw new Error(`${path.basename(mod.file)} ist kein Mod-Archiv (.fantome, .zip, .modpkg)`);
  const category = CATEGORIES[mod.category];
  if (!category) throw new Error(`Kategorie unbekannt (${mod.category || 'nicht erkannt'})`);
  if (category === 'skins') {
    if (!mod.championKey) throw new Error('Champion nicht erkannt');
    return importSkin(mod.file, mod);
  }
  return importCategory(mod.file, category, mod.title);
}

module.exports = { importMod, CATEGORIES, ROOT };
