// --- Jungle-Route: erste Runde je Startcamp als nummerierte Mini-Karte (nur vor dem Spiel) ---
// Camp-Lagen der blauen Seite auf Summoner's Rift in Prozent der Karte (links unten = blaue Basis),
// die rote Seite ist punktgespiegelt
const CAMP_XY = { Blue: [26, 47], Gromp: [14, 43], Wolves: [26, 57], Raptors: [47, 63], Red: [53, 73], Krugs: [57, 82] };
const CAMP_NAME = { Blue: 'Blau', Gromp: 'Gromp', Wolves: 'Wölfe', Raptors: 'Raptoren', Red: 'Rot', Krugs: 'Krugs' };
function jungleMap(route, side) {
  const xy = (c) => (side === 'red' ? CAMP_XY[c].map((v) => 100 - v) : CAMP_XY[c]);
  const pts = route.map(xy);
  const line = pts.map((p) => p.join(',')).join(' ');
  const dots = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.6"/><text x="${x}" y="${y + 2}">${i + 1}</text>`).join('');
  // Lanes und Fluss nur als Orientierung
  return `<svg class="jmap" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="6"/>` +
    `<path class="lane" d="M8 92 L8 8 L92 8 M8 92 L92 92 L92 8 M8 92 L92 8"/><path class="river" d="M6 6 L94 94"/>` +
    `<polyline points="${line}"/>${dots}</svg>`;
}
const fmtClear = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
async function renderJungle() {
  const card = $('jungleCard');
  const forChamp = champId;
  // in der Champ-Auswahl nur für Jungler, sonst (Build ansehen) nur, wenn die Tabelle den Champ kennt
  if (!forChamp || (matchup.position && matchup.position !== 'jungle')) return (card.hidden = true);
  const d = await window.lol.jungleRoutes(forChamp).catch(() => null);
  if (forChamp !== champId) return;
  if (!d || (!matchup.position && d.routes[0].standard)) return (card.hidden = true);
  card.hidden = false;
  $('jungleSource').hidden = !d.source; // ohne Tabelle (Quelle aus) gibt es nichts zu verlinken
  $('jungleSource').onclick = (e) => (e.preventDefault(), window.lol.openSource(d.source));
  const side = matchup.side || 'blue';
  const chosen = d.routes.some((r) => r.route[0] === d.chosen) ? d.chosen : d.routes[0].route[0];
  $('jungleList').innerHTML = d.routes.map((r) => {
    const time = r.time ? `${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}` : '';
    const meta = r.standard
      ? t('Standard-Full-Clear (kein Eintrag für diesen Champ)')
      : [time && t('{time} bis zum letzten Camp', { time }), r.smites && t('{n}× Smite', { n: r.smites }), `Patch ${r.patch}`]
        .filter(Boolean).join(' · ');
    const video = r.link ? `<a href="#" data-link="${esc(r.link)}">${t('Video')}${r.player ? ` (${esc(r.player)})` : ''}</a>` : '';
    const on = r.route[0] === chosen;
    const pick = `<button class="ghost${on ? ' on' : ''}" data-start="${esc(r.route[0])}">${on ? t('Auf der Minimap ✓') : t('Auf der Minimap')}</button>`;
    return `<div class="jroute">${jungleMap(r.route, side)}<div><b>${t('Start {camp}', { camp: t(CAMP_NAME[r.route[0]]) })}${r.variant ? ` (${esc(r.variant)})` : ''}` +
      `${r.camps < 6 ? ` · ${t('{n} Camps', { n: r.camps })}` : ' · Full Clear'}</b>` +
      `<ol>${r.route.map((c) => `<li>${t(CAMP_NAME[c])}</li>`).join('')}</ol><small>${meta}</small>${video}${pick}</div></div>`;
  }).join('') + `<p class="hint">${side === 'red' ? t('Rote Seite (oben rechts)') : t('Blaue Seite (unten links)')}</p>` +
    (d.clears ? `<p class="clears">${t('Deine erste Runde mit dem Champ')}: <b>${fmtClear(d.clears.last)}</b> · ` +
      `${t('beste')} <b>${fmtClear(d.clears.best)}</b> · Ø ${fmtClear(d.clears.avg)} (${d.clears.count}×)</p>` : '');
  $('jungleList').querySelectorAll('[data-link]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), window.lol.openSource(a.dataset.link))));
  $('jungleList').querySelectorAll('[data-start]').forEach((b) => (b.onclick = async () => {
    await window.lol.jungleChoose(forChamp, b.dataset.start);
    renderJungle();
  }));
}
