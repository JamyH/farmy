// --- Jungle (nur Spiele mit Smite; alles nach dem Spiel aus dem Spielverlauf, wie ein Replay-Review). Gegnerischer
// Jungler = der Gegner mit Smite. Karten: Jungler-Duell, Konter-Jungling, Präsenz, Ganks (auch nach Lane-Stand),
// Objective-Entscheidungen und umkämpfte Objectives, Startseite und Pfad, tote Zeit, frühe Wirkung, Jungle-Tode ---
const jgOf = (g) => {
  const tl = progTimelines[g.id];
  return tl && tl.v >= 5 && tl.jungle ? { g, tl, j: tl.jungle } : null;
};
const LANES = ['top', 'mid', 'bot'];
const GANK_LANES = { top: 'Top', mid: 'Mid', bot: 'Bot' };
const signedN = (v, d = 0) => `${v >= 0 ? '+' : '−'}${dec(Math.abs(v), d)}`;
const wrOf = (l) => (l.length ? Math.round((l.filter((x) => x.g.win).length / l.length) * 100) : null);

function jungleSection(games) {
  const list = games.map(jgOf).filter(Boolean);
  if (!list.length) return '';
  const head = `<p class="hint jg-head">${t('Aus {n} Spielen mit Smite. Gegnerischer Jungler = Gegner mit Smite. Alles nach dem Spiel, wie ein Replay-Review.', { n: list.length })}</p>`;
  const sec = (title, html) => `<h3 class="sec-title">${t(title)}</h3>${html}`;
  return `<h2 class="jg-title">${t('Jungle')}</h2>${head}` +
    sec('Jungler-Duell', jgDuelCard(list)) + sec('Konter-Jungling', counterCard(list)) +
    sec('Präsenz auf der Karte', presenceCard(list)) + sec('Ganks', gankCard(list)) +
    sec('Objective-Entscheidungen', objDecisionCard(list)) + sec('Startseite und Pfad', startCard(list)) +
    sec('Tote Zeit', idleCard(list)) + sec('Frühe Wirkung', earlyCard(list)) + sec('Jungle-Tode', jgDeathCard(list));
}
const few = (list, need) => (list.length < need ? `<p class="hint">${t('Erst {n} passende Spiele, Werte noch wackelig.', { n: list.length })}</p>` : '');

// J1: Differenz zum gegnerischen Jungler bei 5, 10, 15 Minuten
function jgDuelCard(list) {
  const rows = [5, 10, 15].map((m) => {
    const l = list.filter((x) => x.j[`me${m}`] && x.j[`ej${m}`]);
    if (!l.length) return null;
    const d = (k) => mean(l.map((x) => x.j[`me${m}`][k] - x.j[`ej${m}`][k]));
    return `<tr><td>${m} min</td><td class="${d('cs') >= 0 ? 'win' : 'loss'}">${signedN(d('cs'), 1)}</td><td class="${d('lvl') >= 0 ? 'win' : 'loss'}">${signedN(d('lvl'), 1)}</td>` +
      `<td class="${d('xp') >= 0 ? 'win' : 'loss'}">${signedN(d('xp'))}</td><td class="${d('gold') >= 0 ? 'win' : 'loss'}">${signedN(d('gold'))}</td><td>${l.length}</td></tr>`;
  }).filter(Boolean);
  if (!rows.length) return `<div class="card"><p class="hint">${t('Kein gegnerischer Jungler mit Smite gefunden.')}</p></div>`;
  const l10 = list.filter((x) => x.j.me10 && x.j.ej10);
  const ahead = l10.filter((x) => x.j.me10.gold > x.j.ej10.gold);
  return `<div class="card"><p class="deaths-head">${t('Bei 10 Minuten vor dem gegnerischen Jungler (Gold): {a} von {n} Spielen. Siegquote dann {w} %, sonst {l} %.', {
    a: ahead.length, n: l10.length, w: wrOf(ahead) ?? '–', l: wrOf(l10.filter((x) => !ahead.includes(x))) ?? '–' })}</p>` +
    `<table class="pool"><thead><tr><th>${t('Ø Differenz')}</th><th>CS</th><th>Level</th><th>XP</th><th>Gold</th><th>${t('Spiele')}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` +
    (l10.length >= 2 ? spark(l10.map((x) => x.j.me10.gold - x.j.ej10.gold), { label: t('Gold-Differenz zum Jungler bei 10 min'), unit: 'g', digits: 0 }, 1) : '') +
    `<p class="hint">${t('Weniger CS, aber mehr Gold heißt meist: Kills statt Farm. Weniger von beidem: zu viel Zeit ohne Ertrag.')}</p>${few(list, 5)}</div>`;
}

// J2: Monster im gegnerischen Dschungel (du) gegen Monster in deinem Dschungel (er)
function counterCard(list) {
  const l = list.filter((x) => x.j.ejInvade != null);
  if (!l.length) return `<div class="card"><p class="hint">${t('Kein gegnerischer Jungler mit Smite gefunden.')}</p></div>`;
  const mine = mean(l.map((x) => x.j.invade)), his = mean(l.map((x) => x.j.ejInvade));
  const more = l.filter((x) => x.j.invade > x.j.ejInvade), less = l.filter((x) => x.j.invade < x.j.ejInvade);
  return `<div class="card"><div class="rv-row"><span class="rv-label">${t('Du beim Gegner')}</span><span><b>${dec(mine, 1)}</b> ${t('Monster je Spiel')}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Er bei dir')}</span><span><b>${dec(his, 1)}</b> ${t('Monster je Spiel')}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Siegquote')}</span><span>${t('mehr geklaut als er: {a} · weniger: {b}', {
      a: more.length ? `${wrOf(more)} % (${more.length})` : '–', b: less.length ? `${wrOf(less)} % (${less.length})` : '–' })}</span></div>` +
    `<p class="hint">${t('Geschätzt bis Minute 20: Monster, die du bekommst, während du im gegnerischen Dschungel stehst (der Client zählt das nicht mehr selbst). Viel geklaut bekommen heißt: er weiß, wo du bist, und du verlierst Farm.')}</p>${few(l, 5)}</div>`;
}

// J3: wo du die Minuten 2–14 verbringst (Position je Minute), Siege gegen Niederlagen
function presenceCard(list) {
  const zonesOf = (x) => x.j.path.slice(1).filter(Boolean).map((p) => zoneOf(p.x, p.y, x.tl.team)).filter(Boolean);
  const share = (l) => {
    const all = l.flatMap(zonesOf);
    const c = {};
    for (const z of all) c[z] = (c[z] || 0) + 1;
    return { c, n: all.length };
  };
  const a = share(list);
  if (a.n < 10) return `<div class="card"><p class="hint">${t('Noch zu wenige Positionen.')}</p></div>`;
  const w = share(list.filter((x) => x.g.win)), lo = share(list.filter((x) => !x.g.win));
  const order = ['jungle', 'enemyJungle', 'river', 'top', 'mid', 'bot', 'base'];
  const pct = (s, z) => (s.n ? Math.round(((s.c[z] || 0) / s.n) * 100) : null);
  return `<div class="card"><table class="pool"><thead><tr><th>${t('Minuten 2–14')}</th><th>${t('gesamt')}</th><th>${t('in Siegen')}</th><th>${t('in Niederlagen')}</th></tr></thead><tbody>` +
    order.filter((z) => a.c[z]).map((z) => `<tr><td>${t(ZONES[z])}</td><td><b>${pct(a, z)} %</b></td><td>${pct(w, z) ?? '–'}${pct(w, z) != null ? ' %' : ''}</td><td>${pct(lo, z) ?? '–'}${pct(lo, z) != null ? ' %' : ''}</td></tr>`).join('') +
    `</tbody></table><p class="hint">${t('Anteil deiner Minuten je Zone (eine Position pro Minute). Viel eigener Dschungel = viel farmen, Lanes = Ganks, gegnerischer Dschungel = Invades.')}</p>${few(list, 5)}</div>`;
}

// J5 + J11: Ganks je Lane (Beteiligung = Erfolg, eigener Tod = Fehlschlag), und nach Lane-Stand (nur mit Rollen)
function gankCard(list) {
  const all = list.flatMap((x) => x.j.ganks.map((g) => ({ ...g, zone: zoneOf(g.x, g.y, x.tl.team) }))).filter((g) => LANES.includes(g.zone));
  if (!all.length) return `<div class="card"><p class="hint">${t('Noch keine Kills, Assists oder Tode auf Lanes vor Minute 14.')}</p></div>`;
  const rows = LANES.map((z) => {
    const l = all.filter((g) => g.zone === z);
    const ok = l.filter((g) => g.ok).length, bad = l.length - ok;
    return `<tr><td>${t(GANK_LANES[z])}</td><td>${ok}</td><td>${bad}</td><td>${l.length ? `<b class="${ok >= bad ? 'win' : 'loss'}">${Math.round((ok / l.length) * 100)} %</b>` : '–'}</td></tr>`;
  });
  const firsts = list.map((x) => x.j.ganks.filter((g) => g.ok && LANES.includes(zoneOf(g.x, g.y, x.tl.team))).map((g) => g.t).sort((a, b) => a - b)[0]).filter((v) => v != null);
  // nach Lane-Stand (Gold der gegankten Lane in dieser Minute)
  const withState = all.filter((g) => g.lanes && g.lanes[g.zone] != null);
  let state = `<p class="hint">${t('Ob du gewinnende oder verlierende Lanes gankst, zeigt Farmy für Spiele ab jetzt (Rollen aus dem Spiel).')}</p>`;
  if (withState.length) {
    const cls = (v) => (v > 300 ? 'winning' : v < -300 ? 'losing' : 'even');
    const NAMES = { winning: 'gewinnende Lane', even: 'ausgeglichene Lane', losing: 'verlierende Lane' };
    state = `<table class="pool"><thead><tr><th>${t('Lane-Stand beim Gank')}</th><th>${t('Erfolg')}</th><th>${t('Fehlschlag')}</th><th>${t('Quote')}</th></tr></thead><tbody>` +
      ['winning', 'even', 'losing'].map((c) => {
        const l = withState.filter((g) => cls(g.lanes[g.zone]) === c);
        const ok = l.filter((g) => g.ok).length;
        return `<tr><td>${t(NAMES[c])}</td><td>${ok}</td><td>${l.length - ok}</td><td>${l.length ? `${Math.round((ok / l.length) * 100)} %` : '–'}</td></tr>`;
      }).join('') + `</tbody></table><p class="hint">${t('Lane-Stand = Gold deiner Lane minus Gegner-Lane in der Minute (Bot mit Support), ab ±300 Gold.')}</p>`;
  }
  return `<div class="card">${firsts.length ? `<p class="deaths-head">${t('Erster erfolgreicher Gank im Schnitt bei {m}.', { m: dur(Math.round(mean(firsts))) })}</p>` : ''}` +
    `<table class="pool"><thead><tr><th>${t('Lane (bis Minute 14)')}</th><th>${t('Kills/Assists')}</th><th>${t('eigene Tode')}</th><th>${t('Quote')}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` +
    `${state}<p class="hint">${t('Gezählt werden Kills und Assists (Erfolg) sowie deine Tode (Fehlschlag) auf den Lanes; Ganks ganz ohne Kill sieht der Spielverlauf nicht.')}</p></div>`;
}

// J4 + J9: verlorene Objectives (wo du warst) und umkämpfte (gegnerischer Jungler in der Nähe)
function objDecisionCard(list) {
  const NAMES = { DRAGON: 'Drache', BARON_NASHOR: 'Baron', RIFTHERALD: 'Herold', HORDE: 'Larven', ATAKHAN: 'Atakhan' };
  const objs = list.flatMap((x) => x.j.objs.filter((o) => NAMES[o.type]).map((o) => ({ ...o, mineTeam: x.tl.team, g: x.g })));
  const lost = objs.filter((o) => o.team && o.team !== o.mineTeam);
  const won = objs.filter((o) => o.team === o.mineTeam);
  if (!objs.length) return `<div class="card"><p class="hint">${t('Noch keine Objectives mit bekanntem Team.')}</p></div>`;
  const dead = lost.filter((o) => o.dead).length, far = lost.filter((o) => !o.dead && o.dist > 5000).length;
  const near = lost.filter((o) => !o.dead && o.dist != null && o.dist <= 5000).length, trade = lost.filter((o) => o.trade).length;
  const contested = objs.filter((o) => o.ejNear && o.meNear);
  const cWon = contested.filter((o) => o.team === o.mineTeam).length;
  const recent = lost.slice(-6).reverse().map((o) => `<div class="rv-row"><span class="rv-label">${dur(o.t)} · ${t(NAMES[o.type])}</span><span>${
    o.dead ? t('du warst tot') : o.dist > 5000 ? t('du warst weit weg ({d} Einheiten)', { d: n(o.dist) }) : t('du warst in der Nähe')}${o.trade ? ` · ${t('dein Team hat dafür etwas anderes geholt')}` : ''}</span></div>`).join('');
  return `<div class="card"><p class="deaths-head">${t('Dein Team: {w} Objectives geholt, {l} an den Gegner verloren.', { w: won.length, l: lost.length })}</p>` +
    (lost.length ? `<div class="rv-row"><span class="rv-label">${t('Bei verlorenen')}</span><span>${t('{a}× warst du tot, {b}× weit weg, {c}× in der Nähe · {d}× Trade', { a: dead, b: far, c: near, d: trade })}</span></div>` : '') +
    (contested.length ? `<div class="rv-row"><span class="rv-label">${t('Umkämpft')}</span><span>${t('{w} von {n} gewonnen, als ihr beide Jungler in der Nähe wart', { w: cWon, n: contested.length })}</span></div>` : '') +
    (recent ? `<h3 class="sub">${t('Zuletzt verloren')}</h3>${recent}` : '') +
    `<p class="hint">${t('Lage aus deiner Position in der Minute des Objectives. Tot = höchstens 45 s vorher gestorben. Trade = dein Team holt binnen 60 s Turm oder Monster.')}</p></div>`;
}

// J6: Startseite (Position in Minute 2) und Pfad der ersten 14 Minuten als Punkte
function startCard(list) {
  const side = (x) => {
    const p = x.j.path[1];
    return p ? (p.y > p.x ? 'top' : 'bot') : null;
  };
  const top = list.filter((x) => side(x) === 'top'), bot = list.filter((x) => side(x) === 'bot');
  const dots = list.flatMap((x) => x.j.path.map((p, i) => (p ? { ...p, m: i + 1 } : null)).filter(Boolean)).map((p) => {
    const M = MAPS[11];
    return `<circle cx="${((p.x / M.w) * 100).toFixed(1)}" cy="${(100 - (p.y / M.h) * 100).toFixed(1)}" r="1.1" class="pd" opacity="${(0.35 + (0.65 * (15 - p.m)) / 14).toFixed(2)}"><title>${t('Minute {m}', { m: p.m })}</title></circle>`;
  }).join('');
  return `<div class="card"><div class="dmap-grid"><figure class="minimap"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(t('Dein Pfad in den ersten 14 Minuten'))}">${schematicMap(11)}${dots}</svg>` +
    `<figcaption>${t('Position je Minute 1–14, früh kräftiger')}</figcaption></figure><div>` +
    `<div class="rv-row"><span class="rv-label">${t('Start Top Side')}</span><span>${top.length ? t('{n} Spiele · {w} % Siege', { n: top.length, w: wrOf(top) }) : '–'}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Start Bot Side')}</span><span>${bot.length ? t('{n} Spiele · {w} % Siege', { n: bot.length, w: wrOf(bot) }) : '–'}</span></div>` +
    `<p class="hint">${t('Startseite = deine Kartenhälfte in Minute 2.')}</p>${few(list, 6)}</div></div></div>`;
}

// J7: Minuten 2–14, in denen du lebst, aber weder CS noch Kill/Assist noch ein Objective bekommst
function idleCard(list) {
  const l = list.filter((x) => x.j.idleOf);
  if (!l.length) return `<div class="card"><p class="hint">${t('Noch keine Daten.')}</p></div>`;
  const avg = (s) => (s.length ? mean(s.map((x) => x.j.idle)) : null);
  const w = avg(l.filter((x) => x.g.win)), lo = avg(l.filter((x) => !x.g.win));
  return `<div class="card"><p class="deaths-head">${t('Im Schnitt {n} von {of} frühen Minuten ohne Ertrag.', { n: dec(avg(l), 1), of: dec(mean(l.map((x) => x.j.idleOf)), 0) })}</p>` +
    `<div class="rv-row"><span class="rv-label">${t('in Siegen')}</span><span>${w != null ? dec(w, 1) : '–'}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('in Niederlagen')}</span><span>${lo != null ? dec(lo, 1) : '–'}</span></div>` +
    `<p class="hint">${t('Minute ohne neue CS, ohne Kill/Assist und ohne eigenes Objective, obwohl du lebst. Typisch: auf einen Gank warten, der nicht kommt, oder planlos laufen.')}</p></div>`;
}

// J8: First-Blood-Beteiligung und Kill-Beteiligung vor Minute 15, gegen den gegnerischen Jungler
function earlyCard(list) {
  const fb = list.filter((x) => x.j.fb).length;
  const kp = list.filter((x) => x.j.teamKills15).map((x) => x.j.kp15 / x.j.teamKills15);
  const mine = mean(list.map((x) => x.j.kp15)), his = list.filter((x) => x.j.ejKp15 != null);
  return `<div class="card"><div class="rv-row"><span class="rv-label">${t('First Blood')}</span><span>${t('in {a} von {n} Spielen beteiligt', { a: fb, n: list.length })}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Kills/Assists vor 15 min')}</span><span><b>${dec(mine, 1)}</b>${his.length ? ` · ${t('gegnerischer Jungler {v}', { v: dec(mean(his.map((x) => x.j.ejKp15)), 1) })}` : ''}</span></div>` +
    (kp.length ? `<div class="rv-row"><span class="rv-label">${t('Kill-Beteiligung vor 15 min')}</span><span><b>${Math.round(mean(kp) * 100)} %</b></span></div>` : '') + '</div>';
}

// J10: wo Jungler-Tode vor Minute 14 passieren: im gegnerischen Dschungel (Invade/erwischt) oder auf Lanes gegen 2+
function jgDeathCard(list) {
  const d = list.flatMap((x) => x.tl.deathsAt.filter((y) => y.t < 840).map((y) => ({ ...y, zone: zoneOf(y.x, y.y, x.tl.team) })));
  if (!d.length) return `<div class="card"><p class="hint">${t('Keine Tode vor Minute 14.')}</p></div>`;
  const inv = d.filter((y) => y.zone === 'enemyJungle').length, own = d.filter((y) => y.zone === 'jungle').length;
  const gank = d.filter((y) => LANES.includes(y.zone) && y.n >= 2).length;
  return `<div class="card"><p class="deaths-head">${t('{n} Tode vor Minute 14 in {g} Spielen.', { n: d.length, g: list.length })}</p>` +
    `<div class="rv-row"><span class="rv-label">${t('im gegnerischen Dschungel')}</span><span><b>${inv}</b> · ${t('Invade oder beim Klauen erwischt')}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('im eigenen Dschungel')}</span><span><b>${own}</b> · ${t('selbst invadet worden')}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('auf Lanes gegen 2+')}</span><span><b>${gank}</b> · ${t('Gank schiefgegangen oder Konter-Gank')}</span></div></div>`;
}
