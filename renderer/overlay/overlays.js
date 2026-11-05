// Overlays außerhalb des Panels: Jungle-Route über der Minimap, Augment-Tiers über den Karten, Badges im
// Tab-Scoreboard, dazu die Dev-Lese-Bereiche

// Jungle-Route über der Minimap (erste Runde), nur solange Tab gedrückt ist: Linie und nummerierte Camps,
// rote Seite punktgespiegelt. Camp-Lagen wie im Hauptfenster in Prozent der Karte; Größe und Transparenz im ⚙
const CAMP_XY = { Blue: [26, 47], Gromp: [14, 43], Wolves: [26, 57], Raptors: [47, 63], Red: [53, 73], Krugs: [57, 82] };
let jroute = null;
let tabHeld = false;
let jrouteKey = '';
function renderJungleRoute(j = jroute) {
  jroute = j;
  const svg = $('jroute');
  // SVG-Elemente kennen die Eigenschaft „hidden“ nicht, nur das Attribut
  const show = !!j && tabHeld && moduleOn('jungleRoute');
  svg.toggleAttribute('hidden', !show);
  if (!show) return;
  Object.assign(svg.style, { left: `${j.x}px`, top: `${j.y}px`, width: `${j.size}px`, height: `${j.size}px` });
  const size = settings?.jungleSize ?? 1;
  svg.style.opacity = (1 - (settings?.jungleTransparency ?? 40) / 100).toFixed(2);
  const key = `${j.side}|${j.route.join('-')}|${size}`;
  if (key === jrouteKey) return;
  jrouteKey = key;
  const r = 2.3 * size;
  const pts = j.route.map((c) => (j.side === 'red' ? CAMP_XY[c].map((v) => 100 - v) : CAMP_XY[c]));
  svg.innerHTML = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" stroke-width="${(0.6 * size).toFixed(2)}"/>` +
    pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>` +
      `<text x="${x}" y="${(y + r * 0.42).toFixed(2)}" font-size="${(r * 1.2).toFixed(2)}">${i + 1}</text>`).join('');
}

// FarmyDevBuild: „DEV“ im Panel-Kopf und die Lese-Bereiche als lila Rahmen (Strg+Shift+D)
if (window.lol.dev) {
  const badge = document.createElement('span');
  badge.className = 'dev-badge';
  badge.textContent = 'DEV';
  $('lvl').after(badge);
}
// Lage per CSSOM statt style-Attribut: die CSP des Overlays (style-src ohne 'unsafe-inline') blockt Inline-Styles
window.lol.onDebugRegions((list) => {
  $('dbg').replaceChildren(...(list || []).map((r) => {
    const box = document.createElement('div');
    if (r.y < 16) box.className = 'below'; // am oberen Rand: Beschriftung unter den Rahmen, sonst außerhalb des Bildschirms
    Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    const label = document.createElement('span');
    label.textContent = `${r.label}: ${r.value}`;
    box.append(label);
    return box;
  }));
});

window.lol.onTabHeld((on) => {
  tabHeld = on;
  renderJungleRoute();
});

// Mayhem-Augment-Angebot und Werte-Schmiede: Tier über jeder Karte (keine Siegquoten, die verbietet Riot)
function renderAugments(list) {
  const box = $('aug');
  box.hidden = !list;
  if (!list) return box.replaceChildren();
  box.replaceChildren(...list.map((a, i) => {
    if (!a) return '';
    const el = document.createElement('div');
    el.style.left = `${a.x}px`;
    el.style.top = `${a.y}px`;
    if (a.unknown) {
      el.className = 'aug-badge unknown';
      el.textContent = t('nicht erkannt');
      return el;
    }
    // Tier wie bei Blitz: Buchstabe groß, darunter der Grund. Augment-Tiers stammen von arammayhem.com
    // (CC BY 4.0, Quellenangabe nötig), daher unter der mittleren Karte die Quelle
    el.className = `aug-badge grade-${a.tier || 'none'}`;
    const credit = a.credit && i === 1 ? `<small>${t('Daten: arammayhem.com')}</small>` : '';
    el.innerHTML = `<b>${a.tier ? `${esc(a.tier)} Tier` : '–'}</b><span>${esc(a.why)}</span>${credit}`;
    return el;
  }));
}

// Tab-Scoreboard: Badges relativ zum gefundenen Anker (Mitte des Scoreboard-Ornaments)
let sbState = { open: false };
function renderScoreboard() {
  const sb = lastGame && lastGame.scoreboard;
  const open = sbState.open && !!sb;
  document.body.classList.toggle('sb-open', open);
  $('sb').hidden = !open;
  if (!open) return;
  const { anchor: a, offsets: o } = sbState;

  const team = $('sbTeam');
  team.style.left = `${a.x}px`;
  team.style.top = `${a.y + o.top - 8}px`;
  setHtml(team, `<label>${t('Team-Itemwert')}</label><b class="${cls(sb.teamDiff)}">${signed(sb.teamDiff)} g</b>`);

  // Badges nur neu bauen, wenn sich Werte oder Lage geändert haben (bei gedrückter Tab-Taste kommt jede Sekunde
  // ein neuer Stand, meist mit denselben Zahlen)
  const rows = $('sbRows');
  const key = JSON.stringify([a, o, sb.myTeamLeft, sb.rows.map((r) => r.diff)]);
  if (rows.__key === key) return;
  rows.__key = key;
  // Positionen per element.style setzen: die CSP blockt style-Attribute aus innerHTML
  rows.replaceChildren();
  sb.rows.forEach((r, i) => {
    if (r.diff == null || o.rows[i] == null) return;
    const el = document.createElement('div');
    el.className = `sb-row ${cls(r.diff)}`;
    // über dem Trinket-Slot der Zeile; dein Team steht links (ORDER) oder rechts (CHAOS)
    el.style.left = `${a.x + (sb.myTeamLeft ? o.badgeX : o.badgeXRight)}px`;
    el.style.top = `${a.y + o.rows[i] + o.badgeDy}px`;
    // kompakt, damit es über den Ward-Slot passt; verglichen wird mit der Zeile gegenüber
    el.textContent = compact(r.diff);
    rows.appendChild(el);
  });
}
window.lol.onScoreboard((s) => {
  sbState = s;
  renderScoreboard();
});
