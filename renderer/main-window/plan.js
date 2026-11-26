// --- „Dein Plan“ in „Build & Runen“ (Champ-Auswahl): Notiz zum Champion, zuletzt Gelerntes, Session-Ziel, Fokus aus
// dem Fortschritt, deine eigene Bilanz mit dem Champion und gegen die gegnerischen Picks und die Lane-Einschätzung.
// Notizen selbst: notes.js; „Bearbeiten“ springt in den Reiter „Notizen“ ---
function renderNoteCard() {
  if (!champId) return;
  const note = notesData[champId];
  $('noteText').innerHTML = note && note.text ? esc(note.text) : `<span class="hint">${t('Noch keine Notiz zu diesem Champion.')}</span>`;
  $('noteEdit').textContent = note && note.text ? t('Bearbeiten') : t('Notiz schreiben');
  const parts = [];
  const learned = [...((note || {}).journal || [])].sort((a, b) => b.at - a.at).slice(0, 3);
  if (learned.length) parts.push([t('Zuletzt gelernt'), learned.map((j) => esc(j.text)).join('<br>')]);
  if (progGoal) {
    const f = (v) => (progGoal.key === 'deaths' ? String(v) : dec(v, progGoal.key === 'vision' ? 2 : 1));
    parts.push([t('Session-Ziel'), esc(t(GOAL_TEXT[progGoal.key], { n: f(progGoal.target) }))]);
  }
  // Fokus auf der Map des kommenden Spiels (ARAM-Bank sichtbar = ARAM)
  const map = $('benchCard').hidden ? 11 : 12;
  const games = progGames.filter((g) => g.map === map && g.cs != null);
  if (games.length >= MIN_COMPARE) {
    const { focus } = rateSkills(games, map);
    if (focus && focus.better < 0) parts.push([t('Fokus'), `${esc(t(focus.label))}: ${esc(t(focus.tip))}`]);
  }
  if (map === 11) parts.push(...ownRecord(games));
  const mu = Object.entries(matchupResults).filter(([id]) => id !== champId && matchupResults[id] && !matchupResults[id].error);
  if (mu.length) {
    parts.push([t('Lane'), mu.map(([id, d]) => {
      const [label, cls] = laneVerdict(d);
      return `${esc((champById(id) || { name: id }).name)} <span class="${cls}">${esc(label)}</span>`;
    }).join(' · ')]);
  }
  $('planMore').innerHTML = parts.map(([label, html]) => `<div class="rv-row"><span class="rv-label">${label}</span><span>${html}</span></div>`).join('');
}
// Deine eigene Bilanz (Kluft) mit dem gewählten Champion und gegen die gegnerischen Picks: als Lane-Gegner (aus den
// Spielverläufen, mit Gold-Differenz bei 15 min) oder sonst im Gegnerteam. Nur Zeilen mit genug Spielen
function ownRecord(games) {
  const keyOf = (id) => Number((champById(id) || {}).key);
  const wl = (l) => {
    const w = l.filter((g) => g.win).length;
    return `<span class="${w * 2 >= l.length ? 'win' : 'loss'}">${w}–${l.length - w}</span>`;
  };
  const rows = [];
  const mine = games.filter((g) => g.champ === keyOf(champId));
  if (mine.length) {
    const deaths = mean(mine.map((g) => g.d));
    rows.push([t('Du mit {champ}', { champ: esc((champById(champId) || { name: champId }).name) }),
      `${wl(mine)} · ${t('Ø {d} Tode', { d: dec(deaths, 1) })}` +
      (mine.length >= 3 && mine.filter((g) => g.win).length * 100 / mine.length < 45 ? ` · <span class="loss">${t('läuft bei dir bisher schlecht')}</span>` : '')]);
  }
  for (const id of [...new Set(matchup.enemies)].filter((x) => x !== champId)) {
    const key = keyOf(id);
    const name = esc((champById(id) || { name: id }).name);
    const lane = games.filter((g) => (progTimelines[g.id] || {}).oppChamp === key);
    if (lane.length >= 2) {
      const gd = lane.map((g) => progTimelines[g.id]).filter((tl) => tl.at15 && tl.opp15).map((tl) => tl.at15.gold - tl.opp15.gold);
      const lead = gd.length >= 2 ? mean(gd) : null;
      const thrown = lead != null && lead > 0 && lane.filter((g) => g.win).length * 2 < lane.length;
      rows.push([t('Gegen {champ}', { champ: name }), `${wl(lane)} ${t('als Lane-Gegner')}` +
        (lead != null ? ` · ${t('bei 15 min Ø {g} g', { g: `${lead >= 0 ? '+' : '−'}${n(Math.abs(Math.round(lead)))}` })}` : '') +
        (thrown ? ` · <span class="loss">${t('meist vorne und trotzdem verloren: Vorsprung in Türme und Druck umsetzen')}</span>` : '')]);
      continue;
    }
    const team = games.filter((g) => ((progTimelines[g.id] || {}).enemies || []).includes(key));
    if (team.length >= 3) rows.push([t('Gegen {champ}', { champ: name }), `${wl(team)} ${t('im Gegnerteam')}`]);
  }
  return rows;
}
$('noteEdit').addEventListener('click', () => {
  showTab('notes');
  openNote(champId);
  $('noteArea').focus();
});
