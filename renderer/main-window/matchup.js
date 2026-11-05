// --- Matchup: Lane gewinnend oder verlierend und wer auf Level 1–3 vorne liegt (nur vor dem Spiel) ---
const matchup = { enemies: [], position: '', manual: null };
let matchupResults = {}; // Gegner-ID -> Matchup-Daten (für die Plan-Karte), gilt für den gewählten Champion
const signedPct = (v) => `${v >= 0 ? '+' : '−'}${dec(Math.abs(v), 1)} %`;
function laneVerdict(d) {
  const v = d.normalized ?? d.delta;
  if (v >= 2) return [t('gewinnend'), 'win'];
  if (v >= 0.75) return [t('leicht gewinnend'), 'win'];
  if (v > -0.75) return [t('ausgeglichen'), ''];
  return v > -2 ? [t('leicht verlierend'), 'loss'] : [t('verlierend'), 'loss'];
}
// Duell (Schnitt Level 1–3) mit 10 % Vorsprung zählt 1,5; First Blood gilt fürs ganze Spiel und zählt weniger:
// 55 % zählen 1 ohne Fähigkeiten im Duell, mit Fähigkeiten 0,5. Beides zusammen ergibt die Einschätzung
function earlyVerdict(d) {
  const withAbilities = !!(d.duel && d.duel[0].abilities);
  const fb = d.firstBlood != null ? (d.firstBlood - 50) / (withAbilities ? 10 : 5) : 0;
  const duel = d.duel ? (d.duel.reduce((sum, x) => sum + x.ratio, 0) / d.duel.length - 1) * 15 : 0;
  const s = fb + duel;
  return s >= 0.6 ? [t('eher du'), 'win'] : s <= -0.6 ? [t('eher der Gegner'), 'loss'] : [t('offen'), ''];
}
function matchupHtml(vs, d) {
  const name = (buildData.champions.find((c) => c.id === vs) || { name: vs }).name;
  const duel = d.duel ? `${d.duel[0].abilities ? t('Duell L1–3 mit Fähigkeiten') : t('Duell L1–3 (nur Grundwerte)')}: ${d.duel.map((x) =>
    `<span class="${x.ratio >= 1 ? 'win' : 'loss'}">${x.ratio >= 1 ? '+' : '−'}${x.hpLeft} %</span>`).join(' · ')}` : '';
  const ev = earlyVerdict(d);
  const early = `<div><label>${t('Level 1–3')}</label><b class="${ev[1]}">${ev[0]}</b>` +
    `<small>${d.firstBlood != null ? `First Blood ${dec(d.firstBlood, 1)} % · ` : ''}${duel}</small></div>`;
  const head = `<span class="champ">${champImg({ id: vs })}<b>${esc(name)}</b></span>`;
  if (d.error) return `${head}<div><label>Lane</label><b>–</b><small>${esc(d.error)}</small></div>${early}`;
  if (d.winRate == null) return `${head}<div></div>${early}`; // ohne Lane-Statistik (Quelle aus): nur Level 1–3
  const lv = laneVerdict(d);
  return `${head}<div><label>Lane</label><b class="${lv[1]}">${dec(d.winRate, 1)} % · ${lv[0]}</b>` +
    `<small>${t('{pct} ggü. Ø-Gegner', { pct: signedPct(d.delta) })}${d.normalized != null ? ` · ${t('bereinigt {pct}', { pct: signedPct(d.normalized) })}` : ''}` +
    `${d.games ? ` · ${t('{n} Spiele', { n: n(d.games) })}` : ''}</small></div>${early}`;
}
async function renderMatchup() {
  const box = $('matchupList');
  const list = [...new Set([...(matchup.manual ? [matchup.manual] : []), ...matchup.enemies])].filter((id) => id !== champId);
  if (!champId || !list.length) {
    box.innerHTML = `<p class="hint">${t('In der Champ-Auswahl stehen hier die gegnerischen Picks. Oder oben einen Gegner wählen.')}</p>`;
    return;
  }
  const forChamp = champId;
  matchupResults = {};
  box.innerHTML = list.map((id) => `<div class="mu-row" data-vs="${esc(id)}"><span class="hint">${t('Lade Matchup…')}</span></div>`).join('');
  await Promise.all(list.map(async (id) => {
    const d = await window.lol.matchup(forChamp, id, matchup.position).catch((e) => ({ error: e.message }));
    const row = box.querySelector(`[data-vs="${CSS.escape(id)}"]`);
    if (row && forChamp === champId) row.innerHTML = matchupHtml(id, d);
    if (forChamp === champId) matchupResults[id] = d && !d.error && d.winRate != null ? d : { error: true };
  }));
  renderNoteCard();
}
$('vsInput').addEventListener('change', () => {
  const c = champByName.get($('vsInput').value.trim().toLowerCase());
  if (!c) return;
  matchup.manual = c.id;
  renderMatchup();
});
window.lol.onMatchupEnemies((s) => {
  matchup.enemies = s.enemies;
  matchup.position = s.position;
  matchup.side = s.side;
  renderMatchup();
  renderJungle();
  renderBest();
});
window.lol.matchupState().then((s) => {
  if (!s) return;
  matchup.enemies = s.enemies;
  matchup.position = s.position;
  matchup.side = s.side;
  renderMatchup();
  renderJungle();
  renderBest();
});
