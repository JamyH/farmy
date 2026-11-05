// --- Verlauf (Match-History des Clients) ---
async function renderHistory() {
  const el = $('history');
  let data;
  try {
    data = await window.lol.history();
  } catch {
    el.innerHTML = `<div class="msg">${t('League-Client läuft nicht.')}</div>`;
    return;
  }
  // Practice-Tool-Runden zählen nicht: kein echtes Ergebnis, verfälschen Winrate und Trends
  const games = ((data.games && data.games.games) || []).filter((g) => g.gameMode !== 'PRACTICETOOL');
  if (!games.length) {
    el.innerHTML = `<div class="msg">${t('Keine Spiele gefunden.')}</div>`;
    return;
  }
  for (const g of games) g.champ = await window.lol.champion(g.participants[0].championId);
  histGames = games;
  // Start mit dem Modus des letzten Spiels; eine eigene Wahl bleibt, solange es den Modus noch gibt
  if (!histMode || (histMode !== 'all' && !games.some((g) => g.gameMode === histMode))) histMode = games[0].gameMode;
  drawHistory();
}

// Modi getrennt: CS, KDA und Vision sind auf der Kluft und im ARAM nicht vergleichbar
const MODES = { CLASSIC: 'Kluft', ARAM: 'ARAM', KIWI: 'ARAM Mayhem', CHERRY: 'Arena', URF: 'URF', ONEFORALL: 'Einer für alle', SWIFTPLAY: 'Swiftplay' };
const modeName = (m) => (MODES[m] ? t(MODES[m]) : m);
let histGames = [];
let histMode = null;
$('history').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  histMode = b.dataset.mode;
  drawHistory();
});

function drawHistory() {
  const el = $('history');
  const modes = [...new Set(histGames.map((g) => g.gameMode))];
  const games = histMode === 'all' ? histGames : histGames.filter((g) => g.gameMode === histMode);
  const seg = modes.length > 1
    ? `<div class="seg" role="group" aria-label="${t('Spielmodus')}">${['all', ...modes].map((m) =>
      `<button data-mode="${esc(m)}" aria-pressed="${m === histMode}">${m === 'all' ? t('Alle') : esc(modeName(m))}</button>`).join('')}</div>`
    : '';
  const label = t('Letzte {n}', { n: games.length }) + (histMode === 'all' ? '' : ` · ${esc(modeName(histMode))}`);
  el.innerHTML = seg + summaryHtml(games, label) + trendsHtml(games) + games.map(gameRowHtml).join('');
}

// Eine Spielzeile (Verlauf und Spielersuche): participants[0] ist der abgefragte Spieler, g.champ sein Champion
function gameRowHtml(g) {
  const s = g.participants[0].stats;
  const champ = g.champ;
  const mins = Math.max(g.gameDuration / 60, 1);
  const cs = s.totalMinionsKilled + s.neutralMinionsKilled;
  const when = new Date(g.gameCreation).toLocaleString(i18n.locale(), { dateStyle: 'short', timeStyle: 'short' });
  return `<div class="game ${s.win ? 'w' : 'l'}" data-game="${g.gameId}" data-pid="${g.participants[0].participantId}" title="${esc(t('Klicken für alle Spieler'))}">
      <div class="bar"></div>
      <div class="champ">${champImg(champ)}<div>${esc(champ.name)}<small>${esc(QUEUES[g.queueId] || modeName(g.gameMode))} · ${when}</small></div></div>
      <div><b>${s.kills}/${s.deaths}/${s.assists}</b><small>${dec((s.kills + s.assists) / Math.max(s.deaths, 1), 2)} KDA</small></div>
      <div><b>${cs}</b><small>${dec(cs / mins, 1)} CS/min</small></div>
      <div><b>${n(s.totalDamageDealtToChampions)}</b><small>${t('Schaden')}</small></div>
      <div><b>${dur(g.gameDuration)}</b><small>${t('Dauer')}</small></div>
      <div>${itemsHtml([s.item0, s.item1, s.item2, s.item3, s.item4, s.item5, s.item6])}</div>
    </div>`;
}

// Kacheln über einer Spielliste: Siege/Niederlagen, Siegquote, Ø KDA, Ø CS/min
function summaryHtml(games, label) {
  const stats = games.map((g) => [g.participants[0].stats, Math.max(g.gameDuration / 60, 1)]);
  const wins = stats.filter(([s]) => s.win).length;
  const avg = (f, digits) => dec(stats.reduce((sum, [s, mins]) => sum + f(s, mins), 0) / games.length, digits);
  return `<div class="summary">
    <div class="tile"><label>${label}</label><b><span class="win">${t('{n}S', { n: wins })}</span> <span class="loss">${t('{n}N', { n: games.length - wins })}</span></b></div>
    <div class="tile"><label>${t('Siegquote')}</label><b>${Math.round((wins / games.length) * 100)} %</b></div>
    <div class="tile"><label>Ø KDA</label><b>${avg((s) => (s.kills + s.assists) / Math.max(s.deaths, 1), 2)}</b></div>
    <div class="tile"><label>Ø CS/min</label><b>${avg((s, mins) => (s.totalMinionsKilled + s.neutralMinionsKilled) / mins, 1)}</b></div></div>`;
}

// --- Trends: CS/min, KDA, Vision über die letzten Spiele (links alt, rechts neu) ---
function trendsHtml(games) {
  const chrono = [...games].reverse();
  const series = [
    { label: 'CS/min', color: '#f2c14e', digits: 1,
      values: chrono.map((g) => { const s = g.participants[0].stats; return (s.totalMinionsKilled + s.neutralMinionsKilled) / Math.max(g.gameDuration / 60, 1); }) },
    { label: 'KDA', color: '#5eead4', digits: 2,
      values: chrono.map((g) => { const s = g.participants[0].stats; return (s.kills + s.assists) / Math.max(s.deaths, 1); }) },
    { label: 'Vision/min', color: '#8ab4f8', digits: 2,
      values: chrono.map((g) => (g.participants[0].stats.visionScore || 0) / Math.max(g.gameDuration / 60, 1)) },
  ];
  return `<div class="trends">${series.map(trendCard).join('')}</div>`;
}

function trendCard({ label, color, digits, values }) {
  if (values.length < 2) return '';
  const W = 200, H = 70, pad = 6;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (values.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const last = values[values.length - 1];
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<div class="trend">
    <div class="trend-head"><label>${label}</label><span><b>${dec(last, digits)}</b><small>Ø ${dec(avg, digits)}</small></span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('{label} der letzten {n} Spiele, zuletzt {last}, Durchschnitt {avg}', { label, n: values.length, last: dec(last, digits), avg: dec(avg, digits) })}">
      <line x1="${pad}" x2="${W - pad}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
      <circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="${color}"></circle>
    </svg>
  </div>`;
}
