// --- Tierliste: lolalytics je Lane bzw. ARAM (Emerald+, aktueller Patch), dazu deine eigenen Spiele je Champ ---
const LOLA_TIERS = ['', 'S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-'];
const TIER_KEY = 'farmy.tierMode';
let tierMode = 'middle';
try { tierMode = localStorage.getItem(TIER_KEY) || tierMode; } catch { /* ohne Speicher Mid */ }
let tierData = null;
let tierSort = 'rank';
let tierReq = 0; // Lane gewechselt, während die alte noch lädt: die alte nicht mehr anzeigen
// Suche ohne Akzente, Leerzeichen und Apostrophe („khazix“ findet Kha'Zix, „nunu“ Nunu & Willump)
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function loadTier() {
  document.querySelectorAll('#tierModes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === tierMode)));
  const req = ++tierReq;
  $('tierOut').innerHTML = `<span class="hint">${t('Lädt…')}</span>`;
  let d;
  try {
    d = await window.lol.tierList(tierMode);
  } catch (e) {
    if (req === tierReq) $('tierOut').innerHTML = `<p class="hint">${esc(errText(e))}</p>`;
    return;
  }
  if (req !== tierReq) return;
  tierData = d;
  const at = new Date(d.fetchedAt).toLocaleString(i18n.locale(), { dateStyle: 'short', timeStyle: 'short' });
  $('tierSource').innerHTML = `${t('Daten: lolalytics.com · Emerald+ · aktueller Patch · Stand {at}', { at: esc(at) })} · ` +
    `<a href="#" data-link="${esc(d.url)}">${t('Auf lolalytics öffnen')}</a>`;
  drawTier();
}

// Spalten: Schlüssel, Überschrift, Wert zum Sortieren (größer = weiter oben)
const TIER_COLS = [
  ['rank', '#', (r) => (r.rank ? -r.rank : -1e9)],
  ['wr', 'Siegquote', (r) => r.wr],
  ['pr', 'Pickrate', (r) => r.pr ?? -1],
  ['br', 'Bannrate', (r) => r.br ?? -1],
  ['games', 'Spiele', (r) => r.games ?? -1],
  ['own', 'Du', (r) => (r.own ? r.own.games + r.own.wins / 1000 : -1)],
];
function drawTier() {
  if (!tierData) return;
  const q = fold($('tierSearch').value);
  const mine = $('tierMine').checked;
  const aram = tierMode === 'aram';
  // auf der Lane zu selten gespielte Champs (tier 0) nur bei der Suche, damit Off-Meta-Picks auffindbar bleiben
  let rows = tierData.rows.filter((r) => (q ? fold(r.name).includes(q) : r.tier > 0) && (!mine || r.own));
  const key = (TIER_COLS.find((c) => c[0] === tierSort) || TIER_COLS[0])[2];
  rows = rows.sort((a, b) => key(b) - key(a) || b.wr - a.wr);
  const cols = TIER_COLS.filter(([k]) => !(aram && k === 'br')); // ARAM hat keine Bans
  const head = `<tr><th>${t('Champion')}</th><th>Tier</th>${cols.map(([k, label]) =>
    `<th><button class="sort${k === tierSort ? ' on' : ''}" data-sort="${k}">${esc(t(label))}</button></th>`).join('')}</tr>`;
  const pct = (v) => (v == null ? '–' : `${dec(v, v >= 10 ? 1 : 2)} %`);
  const own = (o) => (o ? `${n(o.games)} · <span class="${o.wins * 2 >= o.games ? 'win' : 'loss'}">${Math.round((o.wins / o.games) * 100)} %</span>` : '–');
  const cell = {
    rank: (r) => (r.rank ? r.rank : '–'),
    wr: (r) => pct(r.wr),
    pr: (r) => pct(r.pr),
    br: (r) => pct(r.br),
    games: (r) => (r.games == null ? '–' : n(r.games)),
    own: (r) => own(r.own),
  };
  const body = rows.map((r) => {
    const tier = LOLA_TIERS[r.tier] || '';
    return `<tr class="tier-row" data-champ="${esc(r.id)}" title="${esc(t('Build und Fähigkeiten ansehen'))}">` +
      `<td><span class="champ">${champImg(r)}${esc(r.name)}</span></td>` +
      `<td>${tier ? `<span class="tier-badge t-${tier[0].toLowerCase()}">${tier}</span>` : '–'}</td>` +
      cols.map(([k]) => `<td>${cell[k](r)}</td>`).join('') + '</tr>';
  }).join('');
  $('tierOut').innerHTML = rows.length
    ? `<table class="pool tier-table"><thead>${head}</thead><tbody>${body}</tbody></table>`
    : `<p class="hint">${t(mine && !q ? 'Hier hast du noch keinen Champ gespielt.' : 'Kein Champion gefunden.')}</p>`;
}

$('tierModes').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (!b || b.dataset.mode === tierMode) return;
  tierMode = b.dataset.mode;
  try { localStorage.setItem(TIER_KEY, tierMode); } catch { /* egal */ }
  loadTier();
});
$('tierSearch').addEventListener('input', drawTier);
$('tierMine').addEventListener('change', drawTier);
$('tierOut').addEventListener('click', (e) => {
  const s = e.target.closest('button[data-sort]');
  if (s) {
    tierSort = s.dataset.sort;
    drawTier();
    return;
  }
  // Klick: Champion im Nachschlagen-Reiter, Build gleich für die Lane dieser Tierliste
  const row = e.target.closest('tr[data-champ]');
  if (row) {
    showTab('wiki');
    openWikiChamp(row.dataset.champ, tierMode === 'aram' ? 'ARAM' : tierMode.toUpperCase());
  }
});
$('tierSource').addEventListener('click', (e) => {
  const a = e.target.closest('[data-link]');
  if (a) (e.preventDefault(), window.lol.openSource(a.dataset.link));
});
