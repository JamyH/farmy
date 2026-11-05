// --- Schnellsuche (Strg+K oder „Suchen“ in der Seitenleiste): Champion tippen öffnet ihn in „Nachschlagen“,
// Name#Tag die Spielersuche; zuletzt gesuchte Spieler stehen mit drin. Braucht wiki.js (wikiChampList,
// openWikiChamp) und players.js (openPlayer, recentSearches) ---
let quickItems = [];
let quickPos = 0;

async function openQuick() {
  if ($('quick').open) return;
  $('quickInput').value = '';
  $('quick').showModal();
  $('quickInput').focus();
  drawQuick();
  try {
    await wikiChampList();
    drawQuick();
  } catch {
    // ohne Champion-Liste bleibt die Spielersuche
  }
}

function drawQuick() {
  const raw = $('quickInput').value.trim();
  const q = fold(raw);
  const champs = (wikiChamps || []).filter((c) => q && fold(c.name).includes(q))
    // Treffer am Anfang des Namens zuerst („ka“: Kai'Sa vor Akali)
    .sort((a, b) => fold(b.name).startsWith(q) - fold(a.name).startsWith(q))
    .slice(0, 8)
    .map((c) => ({ kind: 'champ', id: c.id, label: c.name, icon: c.icon }));
  const players = recentSearches().filter((id) => !q || fold(id).includes(q)).slice(0, raw ? 3 : 6)
    .map((id) => ({ kind: 'player', id, label: id }));
  // eingetippte Riot-ID, die noch nicht in der Liste steht
  if (raw.includes('#') && !players.some((p) => p.id.toLowerCase() === raw.toLowerCase())) {
    players.unshift({ kind: 'player', id: raw, label: t('Spieler „{id}“ suchen', { id: raw }) });
  }
  quickItems = [...champs, ...players];
  quickPos = Math.min(quickPos, Math.max(0, quickItems.length - 1));
  const icon = (x) => (x.icon ? `<img src="${esc(x.icon)}" alt="">`
    : '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>');
  $('quickList').innerHTML = quickItems.length
    ? quickItems.map((x, i) => `<button role="option" data-i="${i}" aria-selected="${i === quickPos}">${icon(x)}` +
      `<span>${esc(x.label)}</span><small>${x.kind === 'champ' ? t('Champion') : t('Spieler')}</small></button>`).join('')
    : `<p class="hint">${raw ? t('Nichts gefunden. Spieler mit Name#Tag suchen.') : t('Champion oder Spieler (Name#Tag) eintippen.')}</p>`;
}

function pickQuick(i) {
  const x = quickItems[i];
  if (!x) return;
  $('quick').close();
  if (x.kind === 'champ') {
    showTab('wiki');
    openWikiChamp(x.id);
  } else {
    openPlayer(x.id);
  }
}

$('quickBtn').addEventListener('click', openQuick);
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openQuick();
  }
});
$('quickInput').addEventListener('input', () => {
  quickPos = 0;
  drawQuick();
});
$('quickInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = quickItems.length;
    if (n) quickPos = (quickPos + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    drawQuick();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    pickQuick(quickPos);
  }
});
$('quickList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (b) pickQuick(Number(b.dataset.i));
});
// Klick neben das Fenster schließt
$('quick').addEventListener('click', (e) => e.target === $('quick') && $('quick').close());
