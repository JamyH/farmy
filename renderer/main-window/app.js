// Session heute im Kopf der Seitenleiste: Siege/Niederlagen und LP seit dem ersten Blick heute
function renderSession(s) {
  const el = $('session');
  if (!s || s.wins + s.losses === 0) return (el.textContent = '');
  const lp = [['Solo', s.lp.solo], ['Flex', s.lp.flex]].filter(([, v]) => v).map(([q, v]) => `${q} ${v > 0 ? '+' : ''}${v} LP`);
  el.innerHTML = `${t('Heute')} <b class="win">${t('{n}S', { n: s.wins })}</b> <b class="loss">${t('{n}N', { n: s.losses })}</b>${lp.length ? ` · ${lp.join(' · ')}` : ''}` +
    (s.streak >= 3 ? ` · <span class="loss">${t('{n} Niederlagen am Stück', { n: s.streak })}</span>` : '');
}
window.lol.onSession(renderSession);
window.lol.onProgressUpdate(() => renderProgress()); // neue Spielverläufe aus dem Client geladen
// Spiel vorbei: „Letztes Spiel“ neu laden; stand das Fenster noch auf „Live-Spiel“, gleich dorthin wechseln
window.lol.onEndOfGame(() => {
  renderEog();
  if (shownTab === 'live') showTab('eog');
});
window.lol.session().then(renderSession);

// ☰: dasselbe Menü wie am Tray-Icon, direkt unter dem Knopf
$('menuBtn').addEventListener('click', () => {
  const r = $('menuBtn').getBoundingClientRect();
  window.lol.popupMenu({ x: Math.round(r.left), y: Math.round(r.bottom + 4) });
});

// Benutzt: dann bleibt das Fenster beim Spielstart offen (sonst schließt die App es, wenn sie es selbst geöffnet hat)
for (const ev of ['mousedown', 'keydown', 'wheel']) window.addEventListener(ev, () => window.lol.mainWindowUsed(), { once: true });
window.lol.onBuildChampion((id) => selectChampion(id));
window.lol.onRunesStatus((msg) => runeStatus(msg));

async function loadAll() {
  ddVersion = await window.lol.ddVersion();
  const state = $('clientState');
  try {
    const me = await window.lol.summoner();
    $('who').textContent = me.gameName ? `${me.gameName}#${me.tagLine}` : me.displayName;
    state.className = 'client-state on';
    state.lastElementChild.textContent = t('Client verbunden');
  } catch {
    $('who').textContent = '–';
    state.className = 'client-state off';
    state.lastElementChild.textContent = t('Client nicht verbunden');
  }
  // allSettled: ein Teil mit Fehler (z. B. Client gerade weg) soll die anderen und die Reiterwahl nicht aufhalten
  const results = await Promise.allSettled([renderLive(), renderEog(), renderHistory(), loadBuild(), renderProgress()]);
  results.forEach((r) => r.status === 'rejected' && console.warn('Laden:', r.reason && r.reason.message));
  const inGame = results[0].status === 'fulfilled' && results[0].value;
  // läuft gerade ein Spiel, direkt den Live-Tab zeigen
  // sonst „Letztes Spiel“ mit Untertitel (ohne diesen Aufruf blieb der Untertitel beim Start leer)
  if (!loadAll.done && !shownTab) showTab(inGame ? 'live' : 'eog');
  loadAll.done = true;
}

// Seitenleiste: flache Liste in Gruppen (Spiel, Champions, Du), jeder Eintrag öffnet eine <section> in
// main-window.html. „Champions“ hat zwei Ansichten (nach Rolle, Tierliste), umschaltbar im Seitenkopf
// Eintrag in der Seitenleiste → seine Ansichten; die Tierliste nur mit lolalytics (src/data/sources.js)
const VIEWS = { wiki: window.lol.sources.lolalytics ? ['wiki', 'tier'] : ['wiki'] };
// Seite: [Titel, Untertitel, Name als Ansicht]
const PAGES = {
  live: ['Live-Spiel', 'Alle 10 Spieler mit Rang, Items und Werten, sobald ein Spiel läuft'],
  eog: ['Letztes Spiel', 'Auswertung direkt nach dem Spiel'],
  wiki: ['Champions', 'Build, Runen, Summoner und Fähigkeiten je Champion, auch im Spiel', 'Nach Rolle'],
  tier: ['Champions', 'Stärkste Champions je Lane und im ARAM, mit deinen eigenen Spielen', 'Tierliste'],
  build: ['Build & Runen', 'Deine eigenen Builds und Runen und die Champ-Auswahl; Eigenes hat Vorrang vor Vorschlägen'],
  history: ['Verlauf', 'Deine letzten Spiele'],
  progress: ['Fortschritt', 'Deine letzten Spiele gegen deinen eigenen Schnitt'],
  notes: ['Notizen', 'Eigene Notizen je Champion, nur auf deinem PC'],
  player: ['Spieler', 'Spieler deiner Region suchen: Rang, Champions und letzte Spiele'],
  legal: ['Rechtliches', 'Lizenz, Quellen und Hinweise zu Riot Games'],
};
const navOf = (tab) => Object.keys(VIEWS).find((k) => VIEWS[k].includes(tab)) || tab;
const lastView = {}; // zuletzt offene Ansicht je Eintrag, ein Klick in der Seitenleiste kehrt dorthin zurück
let shownTab = null; // schon von außen gewählter Reiter (z. B. Champ-Auswahl → Build & Runen)
// Zurück wie im Browser: jeder Seitenwechsel merkt die vorige Seite (Knopf im Seitenkopf, Maustaste „Zurück“, Alt+←).
// Die Seiten bleiben beim Wechsel erhalten, zurück steht also wieder derselbe Champion, dieselbe Suche da
const backStack = [];
function showTab(tab, { back = false } = {}) {
  if (!back && shownTab && shownTab !== tab) {
    backStack.push(shownTab);
    if (backStack.length > 20) backStack.shift();
  }
  shownTab = tab;
  const nav = navOf(tab);
  lastView[nav] = tab;
  [$('pageTitle').textContent, $('pageSub').textContent] = PAGES[tab].slice(0, 2).map((s) => t(s));
  const views = VIEWS[nav] || [];
  $('subTabs').hidden = !views.length;
  $('subTabs').innerHTML = views.map((x) =>
    `<button role="tab" data-tab="${x}" aria-selected="${x === tab}">${esc(t(PAGES[x][2]))}</button>`).join('');

  document.querySelectorAll('nav button[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === nav));
  document.querySelectorAll('main section').forEach((s) => (s.hidden = s.id !== tab));
  document.body.classList.toggle('fill-page', tab === 'wiki'); // Champions: Seite fensterhoch, Spalten scrollen (wiki.css)
  if (tab === 'live') renderLive();
  if (tab === 'wiki') loadWiki();
  if (tab === 'legal') loadLegal();
  if (tab === 'tier' && !tierData) loadTier(); // erst beim ersten Öffnen laden (ein Abruf bei lolalytics)
  const prev = backStack[backStack.length - 1];
  $('backBtn').hidden = !prev;
  if (prev) $('backBtn').lastElementChild.textContent = `${t('Zurück')}: ${t(PAGES[prev][2] && navOf(prev) === navOf(tab) ? PAGES[prev][2] : PAGES[prev][0])}`;
}
function goBack() {
  const prev = backStack.pop();
  if (prev) showTab(prev, { back: true });
}
$('backBtn').addEventListener('click', goBack);
window.addEventListener('mouseup', (e) => e.button === 3 && goBack()); // Seitentaste „Zurück“ der Maus
window.addEventListener('keydown', (e) => e.altKey && e.key === 'ArrowLeft' && goBack());
document.querySelector('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(lastView[b.dataset.tab] || b.dataset.tab);
});
$('subTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(b.dataset.tab);
});
window.lol.onShowTab(showTab); // Champ-Auswahl öffnet direkt „Build & Runen“

// FarmyDevBuild: eigene Seite „Devtools“ mit Zustand und allen Dev-Werkzeugen (gleiche Aktionen wie Tray → Dev)
if (window.lol.dev) {
  PAGES.dev = ['Devtools', 'Nur in FarmyDevBuild · Strg+Shift+D schaltet die Lese-Bereiche'];
  const nav = document.createElement('button');
  nav.dataset.tab = 'dev';
  nav.className = 'dev-nav';
  nav.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/></svg>Devtools';
  document.querySelector('nav').append(nav);
  const page = document.createElement('section');
  page.id = 'dev';
  page.hidden = true;
  const tools = [
    ['regions', 'Lese-Bereiche an/aus'], ['flag:clockOcr', 'Spielzeit per OCR an/aus'], ['flag:perfectCs', 'Perfekt-CS an/aus'],
    ['flag:fps', 'FPS/Ping-Log an/aus'], ['flag:deathRecap', 'Death Recap an/aus'], ['flag:ultIdle', 'Ulti ungenutzt an/aus'],
    ['restart', 'Neu starten'], ['devtoolsOverlay', 'DevTools: Overlay'],
    ['devtoolsMain', 'DevTools: Hauptfenster'], ['debugDir', 'Debug-Ordner öffnen'], ['testUpdate', 'Update-Meldung testen'],
  ];
  // Rose-Begleiter (Custom-Skins): Rose starten/beenden, Status, Mods-Ordner, aktueller Pick (src/main/rose.js)
  const roseTools = [['runeforge', 'RuneForge öffnen (Mods laden)'], ['start', 'Rose starten'], ['stop', 'Rose beenden'], ['openMods', 'Mods-Ordner öffnen'],
    ['pickExe', 'Rose.exe wählen …'], ['pickMods', 'Mods-Ordner wählen …'], ['download', 'Rose herunterladen']];
  page.innerHTML = '<div class="card dev-card"><h2>Status</h2><div id="devInfo" class="dev-grid"></div></div>' +
    `<div class="card dev-card"><h2>Werkzeuge</h2><div class="dev-tools">${tools.map(([k, label]) =>
      `<button class="ghost" data-dev="${k}">${label}</button>`).join('')}</div></div>` +
    '<div class="card dev-card"><div class="card-head"><h2>Rose (Custom-Skins)</h2><span id="roseState" class="hint"></span></div>' +
    '<div id="roseInfo" class="dev-grid"></div>' +
    '<p id="roseProblem" class="hint loss" style="white-space: pre-wrap" hidden></p>' +
    '<label class="check"><span>Mit Farmy starten</span><input type="checkbox" id="roseAuto"></label>' +
    '<div id="roseMods" class="dev-grid"></div>' +
    `<div class="dev-tools">${roseTools.map(([k, label]) => `<button class="ghost" data-rose="${k}">${label}</button>`).join('')}</div>` +
    '<p class="hint">Nur FarmyDevBuild. Farmy steuert nur dein installiertes Rose an – injiziert nichts, liefert nichts mit. ' +
    'Rose verändert das Spiel (Injection); mit Vanguard auf eigenes Risiko.</p></div>';
  document.querySelector('main').append(page);
  page.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', async () => {
    await window.lol.devAction(b.dataset.dev);
    renderDevInfo();
  }));
  const ROSE_ROWS = [['exe', 'Rose'], ['running', 'Läuft'], ['mods', 'Mods-Ordner'], ['champion', 'Aktueller Pick'],
    ['injection', 'Letzte Injection'], ['phase', 'Phase (laut Rose)']];
  async function renderRose() {
    const s = await window.lol.roseStatus();
    if (!s) return;
    $('roseState').textContent = !s.installed ? 'nicht installiert' : s.running ? 'läuft' : 'bereit';
    $('roseState').className = `hint ${s.running ? 'win' : s.installed ? '' : 'loss'}`;
    const inj = s.injection;
    const val = {
      exe: s.installed ? s.exe : 'nicht gefunden – „Rose.exe wählen …“ oder herunterladen',
      running: s.running ? 'ja' : 'nein', mods: s.mods || '–', champion: s.champion || '– (keine Champ-Auswahl)',
      injection: inj ? `${inj.skin} · ${inj.result} · ${inj.at}` : '– (noch keine im aktuellen Log)', phase: s.phase || '–',
    };
    $('roseInfo').innerHTML = ROSE_ROWS.map(([k, label]) =>
      `<span>${label}</span><b class="${k === 'injection' && inj ? (inj.result === 'ok' ? 'win' : inj.result === 'fehlgeschlagen' ? 'loss' : '') : ''}">${esc(String(val[k]))}</b>`).join('');
    // Rose' eigene Fehlerdiagnose mit Lösungsvorschlag
    $('roseProblem').hidden = !s.problem;
    $('roseProblem').textContent = s.problem ? `Rose meldet: ${s.problem}` : '';
    $('roseAuto').checked = s.autostart;
    // über das RuneForge-Fenster geladene Mods (src/main/runeforge.js), neueste zuerst
    // dazu vom Absturz-Schutz (src/main/rose-guard.js) aus Rose genommene Mods
    const [mods, off] = await Promise.all([window.lol.runeforgeRecent(), window.lol.roseDeactivated()]);
    $('roseMods').innerHTML = (off || []).map((m) => `<span>${esc(m.name)}</span><b class="loss">abgestürzt → deaktiviert</b>`).join('') +
      (mods || []).map((m) => `<span>${esc(m.title)}</span>` +
      `<b class="${m.ok ? 'win' : 'loss'}">${esc(m.ok ? `→ ${m.where}` : m.error)}</b>`).join('');
  }
  $('roseAuto').addEventListener('change', (e) => window.lol.roseAutostart(e.target.checked));
  page.querySelectorAll('[data-rose]').forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.rose;
    await window.lol[`rose${a[0].toUpperCase()}${a.slice(1)}`]();
    setTimeout(renderRose, a === 'start' ? 1500 : 200); // Start braucht kurz, bis Rose in der Prozessliste steht
  }));
  const ROWS = [['version', 'Version'], ['dataDir', 'Datenordner'], ['game', 'Spiel'], ['focused', 'League vorne'],
    ['gameArea', 'Spielfenster'], ['factors', 'Skalierung'], ['minimap', 'Minimap'], ['regions', 'Lese-Bereiche'], ['clock', 'Spielzeit'], ['flags', 'Dev-Schalter an'], ['deaths', 'Tode (Recap)'], ['hud', 'FPS / Ping'], ['ult', 'Ulti ungenutzt'], ['update', 'Updater']];
  async function renderDevInfo() {
    const d = await window.lol.devInfo();
    if (!d) return;
    d.regions = d.regions ? 'an' : 'aus';
    $('devInfo').innerHTML = ROWS.map(([k, label]) => `<span>${label}</span><b>${esc(d[k])}</b>`).join('');
  }
  // nur aktualisieren, solange die Seite offen ist
  setInterval(() => !page.hidden && (renderDevInfo(), renderRose()), 2000);
  nav.addEventListener('click', () => (renderDevInfo(), renderRose()));
}
$('reload').addEventListener('click', () => {
  loadAll();
  if (lastPlayer && shownTab === 'player') searchPlayer(lastPlayer);
  if (shownTab === 'tier') loadTier();
});
loadAll();

// Fensterknöpfe (Fenster ohne Windows-Rahmen)
$('winMin').addEventListener('click', () => window.lol.mainWindowControl('min'));
$('winClose').addEventListener('click', () => window.lol.mainWindowControl('close'));
