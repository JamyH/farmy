// --- Champions: kleines Wiki zum Nachschlagen, auch im Spiel. Icons nach Rolle (Meraki), Klick zeigt Build, Runen,
// Summoner und Skill-Reihenfolge je Lane (lolalytics) und die Fähigkeiten mit Werten und Skalierungen. Keine
// Siegquoten: das Fenster ist auch im Spiel offen. Braucht fold aus tier.js ---
const WIKI_ROLES = [['TOP', 'Top'], ['JUNGLE', 'Jungle'], ['MIDDLE', 'Mid'], ['BOTTOM', 'Bot'], ['SUPPORT', 'Support']];
const WIKI_ROLE_KEY = 'farmy.wikiRole';
let wikiRole = ''; // Filter oben: '' = alle, nach Hauptrolle gruppiert
try { wikiRole = localStorage.getItem(WIKI_ROLE_KEY) || ''; } catch { /* ohne Speicher alle */ }
let wikiChamps = null;
let wikiGame = []; // Champions im laufenden Spiel: [{ id, enemy }]
let wikiSel = null; // geöffneter Champion (Antwort von wikiChampion)
let wikiBuildRole = null; // TOP … SUPPORT oder ARAM
let wikiReq = 0; // anderer Champion oder andere Lane gewählt, während die alte Antwort noch lädt

// Champion-Liste einmal laden, auch für die Schnellsuche (quick.js)
async function wikiChampList() {
  if (!wikiChamps) wikiChamps = await window.lol.wikiList();
  return wikiChamps;
}

async function loadWiki() {
  if (!wikiChamps) {
    $('wikiGrid').innerHTML = `<p class="hint">${t('Lädt…')}</p>`;
    try {
      await wikiChampList();
    } catch (e) {
      $('wikiGrid').innerHTML = `<p class="hint">${esc(errText(e))}</p>`;
      return;
    }
  }
  // im Spiel: die anderen 9 Champions als Abkürzung oben, Gegner zuerst
  const live = await window.lol.liveData().catch(() => null);
  wikiGame = [];
  for (const team of (live && live.teams) || []) {
    for (const p of team.players) if (!p.isMe && p.championId) wikiGame.push({ id: p.championId, enemy: team.id !== live.myTeam });
  }
  wikiGame.sort((a, b) => b.enemy - a.enemy);
  drawWikiGrid();
}

const wikiTile = (c) => `<button class="wiki-tile${wikiSel && wikiSel.id === c.id ? ' on' : ''}" data-champ="${esc(c.id)}">` +
  `<img src="${esc(c.icon)}" alt="" loading="lazy"><span>${esc(c.name)}</span></button>`;
function wikiMatches() {
  const q = fold($('wikiSearch').value);
  return wikiChamps.filter((c) => (!q || fold(c.name).includes(q)) && (!wikiRole || c.roles.includes(wikiRole)));
}
function drawWikiGrid() {
  if (!wikiChamps) return;
  document.querySelectorAll('#wikiRoles button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === wikiRole)));
  const searching = !!$('wikiSearch').value.trim();
  const group = (label, list, cls = '') => (list.length
    ? `<h3>${esc(label)} <small>${list.length}</small></h3><div class="wiki-grid ${cls}">${list.map(wikiTile).join('')}</div>` : '');
  let html = '';
  const byId = new Map(wikiChamps.map((c) => [c.id, c]));
  const game = wikiGame.map((g) => byId.get(g.id) && { ...byId.get(g.id), enemy: g.enemy }).filter(Boolean);
  if (game.length && !searching) html += group(t('In diesem Spiel'), game, 'game');
  if (searching || wikiRole) {
    html += group(searching ? t('Treffer') : t(WIKI_ROLES.find(([r]) => r === wikiRole)[1]), wikiMatches());
  } else {
    for (const [role, label] of WIKI_ROLES) html += group(t(label), wikiChamps.filter((c) => c.roles[0] === role));
    html += group(t('Ohne Rolle'), wikiChamps.filter((c) => !c.roles.length));
  }
  $('wikiGrid').innerHTML = html || `<p class="hint">${t('Kein Champion gefunden.')}</p>`;
  // Gegner im laufenden Spiel rot umrandet
  const enemies = new Set(game.filter((c) => c.enemy).map((c) => c.id));
  $('wikiGrid').querySelectorAll('.wiki-grid.game .wiki-tile').forEach((b) => b.classList.toggle('enemy', enemies.has(b.dataset.champ)));
}

// role: Lane für den Build (TOP … SUPPORT, ARAM), z. B. aus der Tierliste; sonst die gefilterte oder die Hauptrolle
async function openWikiChamp(id, role) {
  const req = ++wikiReq;
  $('wikiDetail').innerHTML = `<div class="card"><p class="hint">${t('Lädt…')}</p></div>`;
  let c;
  try {
    c = await window.lol.wikiChampion(id);
  } catch (e) {
    if (req === wikiReq) $('wikiDetail').innerHTML = `<div class="card"><p class="hint">${esc(errText(e))}</p></div>`;
    return;
  }
  if (req !== wikiReq) return;
  wikiSel = c;
  wikiBuildRole = role || (wikiRole && c.roles.includes(wikiRole) ? wikiRole : c.roles[0] || 'MIDDLE');
  drawWikiGrid();
  drawWikiDetail();
  loadWikiBuild();
  $('wikiDetail').scrollTop = 0;
}

// Werte je Rang: gleich auf allen Rängen nur einmal, 18 Werte (je Level) als Spanne, sonst „40 / 65 / 90“
const wikiNum = (x) => num(x, Number.isInteger(x) ? 0 : Number.isInteger(x * 10) ? 1 : 2);
function wikiValues(values) {
  const v = values.map((x) => Math.round(Number(x) * 100) / 100);
  if (v.every((x) => x === v[0])) return wikiNum(v[0]);
  if (v.length >= 18) return `${wikiNum(v[0])}–${wikiNum(v[v.length - 1])} (${t('Level 1–18')})`;
  return v.map(wikiNum).join(' / ');
}
const wikiMods = (mods) => (mods || []).map((m) => `${wikiValues(m.values)}${m.unit}`).join(' + ');
const WIKI_RESOURCE = { MANA: 'Mana', ENERGY: 'Energie', HEALTH: 'Leben', FURY: 'Wut', RAGE: 'Wut' };
function wikiCdCost(f) {
  const parts = [];
  if (f.cooldown) parts.push(`${t('Abklingzeit')} ${wikiMods(f.cooldown)} s`);
  if (f.cost) parts.push(`${wikiMods(f.cost)} ${WIKI_RESOURCE[f.resource] ? t(WIKI_RESOURCE[f.resource]) : ''}`.trim());
  return parts.join(' · ');
}
// Fähigkeiten als Reiter: Icon-Leiste P Q W E R, darunter nur die gewählte (Klick oder Taste), damit Build und
// Fähigkeit ohne Scrollen auf einen Bildschirm passen. Die Wahl bleibt beim Champion-Wechsel
let wikiAbilityKey = 'Q';
function wikiAbility(a) {
  const forms = a.forms.map((f) => {
    const rows = f.rows.filter((r) => r.mods).map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(wikiMods(r.mods))}</td></tr>`).join('');
    const head = a.forms.length > 1 ? `<h4>${esc(f.name)}</h4>` : '';
    const cd = wikiCdCost(f);
    return head + (cd ? `<p class="ab-cd">${esc(cd)}</p>` : '') + (rows ? `<table class="ab-rows">${rows}</table>` : '');
  }).join('');
  return `<div class="ab-head"><b>${esc(a.name)}</b></div>` +
    `<p class="ab-desc">${esc(a.description).replace(/\n/g, '<br>')}</p>${forms}`;
}
function drawWikiAbility() {
  const a = wikiSel.abilities.find((x) => x.key === wikiAbilityKey) || wikiSel.abilities[0];
  document.querySelectorAll('#wikiDetail [data-ability]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ability === a.key)));
  $('wikiAbility').innerHTML = wikiAbility(a);
}

function drawWikiDetail() {
  const c = wikiSel;
  const roles = [...WIKI_ROLES, ['ARAM', 'ARAM']].map(([r, label]) =>
    `<button data-build-role="${r}" aria-pressed="${r === wikiBuildRole}"${c.roles.includes(r) ? ' class="main"' : ''}>${esc(t(label))}</button>`).join('');
  const tabs = c.abilities.map((a) => `<button data-ability="${a.key}" title="${esc(a.name)}">` +
    `<img src="${esc(a.icon)}" alt=""><b>${a.key === 'P' ? t('Passiv') : a.key}</b></button>`).join('');
  $('wikiDetail').innerHTML = `
    <div class="wiki-head">
      <img src="${esc(c.icon)}" alt="">
      <div><h2>${esc(c.name)}</h2><p>${esc(c.title)}${c.tags.length ? ` · ${esc(c.tags.join(', '))}` : ''}</p></div>
      <div class="seg wiki-lanes">${roles}</div>
    </div>
    <div id="wikiBuild" class="card"></div>
    <div class="card wiki-abilities">
      <div class="ab-tabs" role="tablist">${tabs}<span class="hint">${t('Tasten P Q W E R')}</span></div>
      <div id="wikiAbility"></div>
      <p class="hint">${t('Werte: Meraki Analytics (englisch), Texte: Riot Data Dragon')}</p>
    </div>`;
  drawWikiAbility();
}

async function loadWikiBuild() {
  const req = ++wikiReq;
  const box = $('wikiBuild');
  box.innerHTML = `<p class="hint">${t('Lädt…')}</p>`;
  let b;
  try {
    b = await window.lol.wikiBuild(wikiSel.id, wikiBuildRole);
  } catch (e) {
    if (req === wikiReq) box.innerHTML = `<p class="hint">lolalytics.com: ${esc(errText(e))}</p>`;
    return;
  }
  if (req !== wikiReq) return;
  if (b.riot) return drawRiotBuild(box, b);
  // nur Icons, der Name steht beim Drüberfahren: so passt alles nebeneinander
  const img = (x, cls = '') => (x ? `<img class="${cls}" src="${esc(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}">` : '');
  const item = (x) => `<span class="wiki-item">${img(x)}${x.count > 1 ? `<i>×${x.count}</i>` : ''}</span>`;
  const r = b.runes;
  const keystone = r && r.perks[0];
  // eine Zeile: Schlüsselrune mit Name, drei Hauptrunen, dann der Nebenpfad mit seinen zwei
  const runes = r
    ? `<div class="wiki-runes">${img(keystone, 'keystone')}<b>${esc(keystone?.name || '')}</b>${r.perks.slice(1, 4).map((p) => img(p)).join('')}` +
      `<span class="sep"></span>${img(r.sub, 'style')}${r.perks.slice(4, 6).map((p) => img(p)).join('')}</div>`
    : `<p class="hint">${t('Keine Runen erkannt.')}</p>`;
  const order = b.skillOrder
    ? `<div class="wiki-skills">${b.skillOrder.map((k, i) => `<span class="k-${k.toLowerCase()}"><small>${i + 1}</small>${k}</span>`).join('')}</div>` : '';
  const at = new Date(b.fetchedAt).toLocaleDateString(i18n.locale());
  box.innerHTML = `
    <div class="wiki-build">
      <div><h3>${t('Runen')}</h3>${runes}</div>
      <div><h3>${t('Summoner')}</h3><div class="wiki-row">${b.spells.map((x) => img(x)).join('') || '–'}</div></div>
      <div><h3>${t('Start')}</h3><div class="wiki-row">${b.starting.map(item).join('') || '–'}</div></div>
      ${b.skillPriority ? `<div><h3>${t('Skills')}</h3><p class="wiki-prio">${b.skillPriority.join(' › ')}</p></div>` : ''}
    </div>
    <h3>${t('Items')}</h3>
    <div class="wiki-row wiki-items">${b.items.map((x, i) => (i === 3 ? '<span class="sep">›</span>' : '') + item(x)).join('')}</div>
    ${order}
    <p class="hint">${t('Meistgespielt laut {link} · Emerald+ · Stand {date}', { link: `<a href="#" data-link="${esc(b.url)}">lolalytics.com</a>`, date: esc(at) })}
      · <a href="#" data-open-build>${t('In „Build & Runen“ öffnen')}</a></p>`;
}

// Ohne lolalytics (src/data/sources.js): Runen und Summoner, die Riot im Client empfiehlt
function drawRiotBuild(box, b) {
  const open = `<a href="#" data-open-build>${t('In „Build & Runen“ öffnen')}</a>`;
  if (b.empty) {
    box.innerHTML = `<p class="hint">${t('Riots Empfehlung für Runen und Summoner kommt aus dem League-Client. Starte ihn, dann steht sie hier.')} · ${open}</p>`;
    return;
  }
  const img = (x, cls = '') => (x ? `<img class="${cls}" src="${esc(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}">` : '');
  const r = b.runes;
  const keystone = r && r.perks[0];
  const runes = r
    ? `<div class="wiki-runes">${img(keystone, 'keystone')}<b>${esc(keystone?.name || '')}</b>${r.perks.slice(1, 4).map((p) => img(p)).join('')}` +
      `<span class="sep"></span>${img(r.sub, 'style')}${r.perks.slice(4, 6).map((p) => img(p)).join('')}</div>`
    : '–';
  box.innerHTML = `
    <div class="wiki-build">
      <div><h3>${t('Runen')}</h3>${runes}</div>
      <div><h3>${t('Summoner')}</h3><div class="wiki-row">${b.spells.map((x) => img(x)).join('') || '–'}</div></div>
    </div>
    <p class="hint">${t('Empfehlung von Riot aus dem League-Client')} · ${open}</p>`;
}

$('wikiRoles').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-role]');
  if (!b) return;
  wikiRole = b.dataset.role === wikiRole ? '' : b.dataset.role;
  try { localStorage.setItem(WIKI_ROLE_KEY, wikiRole); } catch { /* egal */ }
  drawWikiGrid();
});
$('wikiSearch').addEventListener('input', drawWikiGrid);
// Enter öffnet den ersten Treffer
$('wikiSearch').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !wikiChamps) return;
  const first = wikiMatches()[0];
  if (first) openWikiChamp(first.id);
});
$('wikiGrid').addEventListener('click', (e) => {
  const tile = e.target.closest('button[data-champ]');
  if (tile) openWikiChamp(tile.dataset.champ);
});
$('wikiDetail').addEventListener('click', (e) => {
  const lane = e.target.closest('button[data-build-role]');
  if (lane && lane.dataset.buildRole !== wikiBuildRole) {
    wikiBuildRole = lane.dataset.buildRole;
    document.querySelectorAll('#wikiDetail [data-build-role]').forEach((b) => b.setAttribute('aria-pressed', String(b === lane)));
    return loadWikiBuild();
  }
  if (e.target.closest('[data-open-build]')) {
    e.preventDefault();
    selectChampion(wikiSel.id);
    return showTab('build');
  }
  const ability = e.target.closest('button[data-ability]');
  if (ability) {
    wikiAbilityKey = ability.dataset.ability;
    return drawWikiAbility();
  }
  const link = e.target.closest('[data-link]');
  if (link) (e.preventDefault(), window.lol.openSource(link.dataset.link));
});
// P Q W E R wechselt die Fähigkeit, solange „Champions“ offen ist und nicht gerade getippt wird
window.addEventListener('keydown', (e) => {
  const key = e.key.toUpperCase();
  if (!wikiSel || $('wiki').hidden || e.ctrlKey || e.altKey || e.metaKey || !'PQWER'.includes(key) || key.length !== 1) return;
  if (e.target.closest('input, textarea, dialog')) return;
  wikiAbilityKey = key;
  drawWikiAbility();
});
