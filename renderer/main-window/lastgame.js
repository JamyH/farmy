// --- Letztes Spiel (End-of-Game-Screen des Clients) ---
async function renderEog() {
  const el = $('eog');
  let eog;
  try {
    eog = await window.lol.endOfGame();
    if (!eog) throw new Error('keine Daten');
  } catch {
    el.innerHTML = `<div class="msg">${t('Keine Endspiel-Daten. Die gibt es direkt nach einem Spiel, solange der Client den Endbildschirm zeigt.')}<br>${t('Unter „Verlauf“ findest du ältere Spiele.')}</div>`;
    return;
  }
  const local = eog.localPlayer || {};
  const ls = local.stats || {};
  const mins = Math.max((eog.gameLength || 0) / 60, 1);
  const cs = (ls.MINIONS_KILLED || 0) + (ls.NEUTRAL_MINIONS_KILLED || 0);
  const myTeam = (eog.teams || []).find((t) => t.isPlayerTeam);
  const won = myTeam ? myTeam.isWinningTeam : null;

  let html = await reviewHtml(eog, ls, won) + `<div class="summary">
    <div class="tile"><label>${t('Ergebnis')}</label><b class="${won ? 'win' : 'loss'}">${won ? t('Sieg') : t('Niederlage')}</b></div>
    <div class="tile"><label>${t('Dauer')}</label><b>${dur(eog.gameLength || 0)}</b></div>
    <div class="tile"><label>KDA</label><b>${ls.CHAMPIONS_KILLED || 0}/${ls.NUM_DEATHS || 0}/${ls.ASSISTS || 0}</b></div>
    <div class="tile"><label>CS/min</label><b>${dec(cs / mins, 1)}</b></div>
    <div class="tile"><label>${t('Schaden')}/min</label><b>${n(Math.round((ls.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0) / mins))}</b></div>
    <div class="tile"><label>Vision</label><b>${ls.VISION_SCORE || 0}</b></div>
  </div>`;

  for (const team of eog.teams || []) {
    const teamDmg = team.players.reduce((s, p) => s + (p.stats.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0), 0) || 1;
    html += `<div class="team-title ${team.isWinningTeam ? 'win' : 'loss'}">${team.isPlayerTeam ? t('Dein Team') : t('Gegner')} · ${team.isWinningTeam ? t('Sieg') : t('Niederlage')}</div>
    <table><tr><th>${t('Spieler')}</th><th>KDA</th><th>CS</th><th>Gold</th><th>${t('Schaden')}</th><th>${t('Anteil')}</th><th>Vision</th><th>Items</th></tr>`;
    for (const p of team.players) {
      const s = p.stats;
      const champ = await window.lol.champion(p.championId);
      const name = p.riotIdGameName || p.summonerName || '';
      const isMe = p.puuid && p.puuid === local.puuid;
      html += `<tr class="${isMe ? 'me' : ''}">
        <td><span class="champ">${champImg(champ)}${esc(champ.name)} <small>${isMe ? esc(name) : playerLink(name, p.puuid)}</small></span></td>
        <td>${s.CHAMPIONS_KILLED || 0}/${s.NUM_DEATHS || 0}/${s.ASSISTS || 0}</td>
        <td>${(s.MINIONS_KILLED || 0) + (s.NEUTRAL_MINIONS_KILLED || 0)}</td>
        <td>${n(s.GOLD_EARNED)}</td>
        <td>${n(s.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS)}</td>
        <td>${Math.round(((s.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0) / teamDmg) * 100)}%</td>
        <td>${s.VISION_SCORE || 0}</td>
        <td>${itemsHtml(p.items || [])}</td></tr>`;
    }
    html += '</table>';
  }
  el.innerHTML = html;
}

// Rückblick (wie ein Coach-Report): dieses Spiel gegen deinen Schnitt auf derselben Map, dazu Farmys Protokoll
// (CS bei 10 min gegen Perfekt-CS, Schadensarten deiner Tode, Ulti ungenutzt), eigene Rekorde und das Session-Ziel
async function reviewHtml(eog, ls, won) {
  let r;
  try {
    r = await window.lol.review(eog.gameId);
  } catch {
    return '';
  }
  // Map: aus Farmys Historie bzw. Spielprotokoll, sonst über den Modus (Swiftplay, URF … laufen auch auf der Kluft;
  // vorher kannte das nur CLASSIC, und Swiftplay-Spiele bekamen keinen Vergleich)
  const known = (r.games || []).find((g) => String(g.id) === String(eog.gameId)) || r.log;
  const map = (known && known.map) || eog.mapId || (['ARAM', 'KIWI'].includes(eog.gameMode) ? 12 : ['CHERRY'].includes(eog.gameMode) ? 30 : 11);
  const me = { cs: (ls.MINIONS_KILLED || 0) + (ls.NEUTRAL_MINIONS_KILLED || 0), k: ls.CHAMPIONS_KILLED || 0, d: ls.NUM_DEATHS || 0,
    a: ls.ASSISTS || 0, vis: ls.VISION_SCORE || 0, dmg: ls.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0, taken: ls.TOTAL_DAMAGE_TAKEN, dur: eog.gameLength || 0 };
  const base = (r.games || []).filter((g) => g.map === map && g.cs != null && String(g.id) !== String(eog.gameId));
  const lines = [];
  const chips = [];
  const skills = base.length >= 5 ? SKILLS.filter((s) => !s.set && (!s.maps || s.maps.includes(map)) && me[s.needs || 'cs'] != null).map((s) => {
    const list = base.filter((g) => !s.needs || g[s.needs] != null);
    if (list.length < 5) return null;
    const v = s.val(me), b = mean(list.map(s.val));
    const better = b ? ((v - b) / b) * (s.lower ? -1 : 1) : 0;
    // Rekord: besser als jedes bisherige Spiel (ab 10 Spielen), sonst unter deinen besten 10 %
    const vals = list.map(s.val).sort((x, y) => (s.lower ? x - y : y - x));
    const record = list.length >= 10 && (s.lower ? v < vals[0] : v > vals[0]);
    const top = !record && list.length >= 10 && (s.lower ? v <= vals[Math.floor(vals.length * 0.1)] : v >= vals[Math.floor(vals.length * 0.1)]);
    if (record) chips.push(`<span class="chip rec">${t('Rekord')}: ${t(s.label)}</span>`);
    else if (top) chips.push(`<span class="chip">${t('Top 10 %')}: ${t(s.label)}</span>`);
    return { ...s, v, b, better };
  }).filter(Boolean) : [];
  const pct = (x) => `${x > 0 ? '+' : ''}${Math.round(x * 100)} %`;
  const good = skills.filter((s) => s.better > 0.05).sort((a, b) => b.better - a.better).slice(0, 2);
  const bad = skills.filter((s) => s.better < -0.05).sort((a, b) => a.better - b.better).slice(0, 2);
  if (good.length) lines.push(['good', t('Gut'), good.map((s) => `${t(s.label)} ${dec(s.v, s.digits)} ${t(s.unit)} (${pct(s.better)})`).join(' · ')]);
  if (bad.length) lines.push(['bad', t('Hat gekostet'), bad.map((s) => `${t(s.label)} ${dec(s.v, s.digits)} ${t(s.unit)} (${pct(s.better)})`).join(' · ')]);
  if (bad.length) lines.push(['', t('Zuerst verbessern'), t(map === 12 && bad[0].tipAram ? bad[0].tipAram : bad[0].tip)]);
  const log = r.log;
  if (log && log.cs10 != null && log.perfect10) {
    lines.push(['', t('CS bei 10 min'), t('{cs} von {max} möglich ({p} %)', { cs: log.cs10, max: log.perfect10, p: Math.round((log.cs10 / log.perfect10) * 100) })]);
  }
  const read = log ? log.deaths.filter((d) => d.phys != null) : [];
  if (read.length) {
    const w = (d) => d.total || 1;
    const sum = read.reduce((a, d) => a + w(d), 0);
    const mix = (k) => Math.round(read.reduce((a, d) => a + d[k] * w(d), 0) / sum);
    const [ph, mg] = [mix('phys'), mix('magic')];
    const hint = ph >= 60 ? t('Rüstung wäre eine Option.') : mg >= 60 ? t('Magieresistenz wäre eine Option.') : t('Gemischter Schaden.');
    lines.push(['', t('Deine Tode'), `${t('{n} gelesen: {p} % physisch, {m} % magisch, {e} % echt.', { n: read.length, p: ph, m: mg, e: mix('true') })} ${hint}`]);
  }
  // Gold beim Tod, live gemessen: viel Gold beim Sterben heißt meist zu spät zum Shop
  if (log && log.died && log.died.length) {
    const golds = log.died.map((d) => d.gold);
    const rich = golds.filter((g) => g >= RICH_GOLD).length;
    const often = rich * 2 >= golds.length && rich >= 2;
    lines.push([often ? 'bad' : '', t('Gold beim Tod'), t('Ø {g} g · {r} von {n} Toden mit {min}+ g in der Tasche.', { g: n(Math.round(mean(golds))), r: rich, n: golds.length, min: n(RICH_GOLD) }) +
      (often ? ` ${t('Vor riskanten Kämpfen erst einkaufen.')}` : '')]);
  }
  // Spielverlauf aus dem Client: wann du gestorben bist und wie die Lane bei 10/15 min stand
  const tl = r.tl;
  if (tl && tl.deaths.length) lines.push(['', t('Tode bei'), tl.deaths.map(dur).join(', ')]);
  // selbst gesetzte Marken (Stream-Deck-Knopf „Moment markieren“): Stellen, die du dir nachher ansehen wolltest
  if (log && log.marks && log.marks.length) lines.push(['', t('Markiert bei'), log.marks.map(dur).join(', ')]);
  if (tl && tl.opp10) {
    const oc = await window.lol.champion(tl.oppChamp).catch(() => null);
    lines.push(['', t('Lane-Duell'), duelText(tl, oc)]);
  }
  // Build-Check: wo dein Build vom meistgespielten auf lolalytics abweicht (nur Vergleich, keine Wertung)
  const bc = r.buildCheck;
  if (bc && !bc.length) lines.push(['good', t('Build-Check'), t('Runen, Summoner und Start wie der meistgespielte Build auf lolalytics.')]);
  if (bc && bc.length) {
    const WHAT = { keystone: 'Schlüsselrune', primary: 'Hauptbaum', sub: 'Nebenbaum', spells: 'Summoner', start: 'Start' };
    lines.push(['', t('Build-Check'), bc.map((x) => t('{what}: du {mine}, meistgespielt {ref}', { what: t(WHAT[x.what]), mine: x.mine, ref: x.ref })).join(' · ')]);
  }
  if (log && log.ult && log.ult.readySec >= 60) {
    lines.push(['', t('Ulti'), t('{t} bereit und ungenutzt (längste Phase {l})', { t: dur(log.ult.readySec), l: dur(log.ult.longestSec) })]);
  }
  // Session-Ziel: nur, wenn es vor diesem Spiel gesetzt war; das Ergebnis zählt für Serie und Quote
  const g = r.goal;
  if (g && (!g.map || g.map === map) && g.since <= Date.now() - me.dur * 1000) {
    const now = { deaths: me.d, csm: me.cs / gmins(me), kda: kdaOf(me), vision: me.vis / gmins(me) }[g.key];
    const ok = g.key === 'deaths' ? now <= g.target : now >= g.target;
    window.lol.goalResult(eog.gameId, ok).catch(() => {});
    const f = (v) => (g.key === 'deaths' ? String(v) : dec(v, g.key === 'vision' ? 2 : 1));
    lines.push([ok ? 'good' : 'bad', t('Session-Ziel'), `${t(GOAL_TEXT[g.key], { n: f(g.target) })}: ${f(now)} ${ok ? '✓' : '✗'}`]);
  }
  // Tagebuch: „Was nehme ich mit?“ landet datiert in den Notizen des Champions
  const champ = await window.lol.champion((eog.localPlayer || {}).championId).catch(() => null);
  let learn = '';
  if (champ && champ.id) {
    const all = await window.lol.notes().catch(() => ({}));
    const entry = ((all[champ.id] || {}).journal || []).find((j) => String(j.gameId) === String(eog.gameId));
    learn = `<div class="learn"><label for="learnText">${t('Was nehme ich mit? ({champ})', { champ: esc(champ.name) })}</label>` +
      `<textarea id="learnText" spellcheck="false" placeholder="${esc(t('z. B. „Nach dem ersten Item früher zurück, nicht mit 1.500 Gold sterben“'))}">${esc(entry ? entry.text : '')}</textarea>` +
      `<div class="learn-row"><button id="learnSave" class="ghost" data-champ="${esc(champ.id)}" data-game="${esc(eog.gameId)}" data-win="${won ? 1 : 0}">${t('Speichern')}</button>` +
      `<span id="learnState" class="hint">${entry ? t('in deinen Notizen zu {champ}', { champ: esc(champ.name) }) : ''}</span></div></div>`;
  }
  return `<div class="card review"><div class="card-head"><h2>${t('Rückblick')}</h2>${chips.join('')}</div>` +
    lines.map(([cls, label, text]) => `<div class="rv-row"><span class="rv-label ${cls}">${label}</span><span>${esc(text)}</span></div>`).join('') +
    (base.length < 5 ? `<p class="hint">${t('Vergleich mit deinem Schnitt ab 5 Spielen auf dieser Map.')}</p>` : '') + learn + '</div>';
}
$('eog').addEventListener('click', async (e) => {
  const b = e.target.closest('#learnSave');
  if (!b) return;
  notesData = await window.lol.noteLearn(b.dataset.champ, { gameId: b.dataset.game, win: b.dataset.win === '1', text: $('learnText').value });
  $('learnState').textContent = $('learnText').value.trim() ? t('gespeichert') : t('gelöscht');
  drawNoteList();
  if (noteKey === b.dataset.champ) openNote(noteKey);
  renderNoteCard();
});
const RICH_GOLD = 1000; // ab so viel Gold in der Tasche zählt ein Tod als „mit Gold gestorben“
const sgn = (v) => `${v > 0 ? '+' : ''}${n(v)}`;
// „gegen Darius · 10 min: CS +12, Gold +450, Level +1 · 15 min: …“
function duelText(tl, oc) {
  const part = (a, b, m) => (a && b ? `${m} min: CS ${sgn(a.cs - b.cs)}, Gold ${sgn(a.gold - b.gold)}, Level ${sgn(a.lvl - b.lvl)}` : null);
  return [t('gegen {c}', { c: oc ? oc.name : '?' }), part(tl.at10, tl.opp10, 10), part(tl.at15, tl.opp15, 15)].filter(Boolean).join(' · ');
}
