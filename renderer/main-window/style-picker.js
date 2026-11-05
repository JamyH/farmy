// --- Stil-Auswahl unten in der Seitenleiste: Kacheln mit Farbvorschau, ein Klick wechselt den Stil sofort (live,
// auch im Overlay), die Auswahl bleibt dabei offen. Schließen: Esc, Klick daneben oder erneut auf „Stil“ ---
async function drawStyles() {
  const { current, themes } = await window.lol.themeList();
  const tile = (x) => `<button class="style-tile" data-theme="${esc(x.id)}" aria-pressed="${x.id === current}">` +
    `<span class="style-swatch" data-bg="${esc(x.colors[0])}" data-accent="${esc(x.colors[1])}"><i></i></span>` +
    `<span>${esc(x.own ? x.label : t(x.label))}</span></button>`;
  const own = themes.filter((x) => x.own);
  $('styleList').innerHTML = themes.filter((x) => !x.own).map(tile).join('') +
    (own.length ? `<h3>${t('Eigene')}</h3>${own.map(tile).join('')}` : '');
  $('styleFolder').textContent = t('Eigene Stile öffnen …');
  // Farben per Script: die CSP blockt style-Attribute im HTML
  $('styleList').querySelectorAll('.style-swatch').forEach((s) => {
    s.style.setProperty('--sw-bg', s.dataset.bg);
    s.style.setProperty('--sw-accent', s.dataset.accent);
  });
}

function toggleStyles() {
  const d = $('stylePicker');
  if (d.open) return d.close();
  const r = $('styleBtn').getBoundingClientRect();
  d.style.left = `${Math.round(r.right + 8)}px`;
  d.style.bottom = `${Math.round(window.innerHeight - r.bottom)}px`;
  d.show();
  drawStyles();
}

$('styleBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleStyles();
});
$('styleList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-theme]');
  if (!b) return;
  await window.lol.setTheme(b.dataset.theme);
  drawStyles();
});
$('styleFolder').addEventListener('click', () => window.lol.themeFolder());
$('styleReread').addEventListener('click', async () => {
  await window.lol.themeReread();
  drawStyles();
});
document.addEventListener('click', (e) => {
  if ($('stylePicker').open && !e.target.closest('#stylePicker')) $('stylePicker').close();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && $('stylePicker').open && $('stylePicker').close());
