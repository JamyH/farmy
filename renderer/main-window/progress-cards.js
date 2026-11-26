// --- Fortschritt: Grundkarten für alle Modi – Skill-Kacheln mit Verlauf (Sparkline), Wann du gewinnst (Spiel am
// Tag, Tageszeit, Uhrzeit, Spiellänge), Champion-Pool, Wann du stirbst und Lane-Duell. Die Seite baut progress.js
// zusammen; weitere Karten in progress-profile.js, progress-deep.js und (nur Jungle) jungle-review.js ---

function skillCard(s) {
  if (s.missing) {
    return `<div class="skill"><label>${t(s.label)}</label><p class="hint">${t('Noch zu wenige Spiele mit diesem Wert')}</p></div>`;
  }
  const pct = Math.round(Math.abs(s.better) * 100);
  const word = pct < 3 ? t('wie immer') : s.better > 0 ? t('{n} % besser', { n: pct }) : t('{n} % schlechter', { n: pct });
  const cls = pct < 3 ? '' : s.better > 0 ? 'good' : 'bad';
  const arrow = pct < 3 ? '→' : s.better > 0 ? '↑' : '↓';
  return `<div class="skill click${progDetail === s.key ? ' open' : ''}" data-skill="${s.key}" role="button" tabindex="0" title="${esc(t('Details zu {label}', { label: t(s.label) }))}">
    <div class="trend-head"><label>${t(s.label)}</label><span class="delta ${cls}">${arrow} ${word}</span></div>
    <div class="skill-val"><b>${dec(s.now, s.digits)}</b><small>${t(s.unit)} · Ø ${dec(s.base, s.digits)}</small></div>
    ${spark(s.rolling, s, progW)}
  </div>`;
}

// Gleitender Schnitt als Linie, gestrichelt dein Gesamtschnitt; Hover zeigt den Wert je Spiel
function spark(values, s, first = 5) {
  if (values.length < 2) return '';
  const W = 200, H = 56, pad = 5;
  const avg = mean(values);
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (values.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const hits = values.map((v, i) => `<rect x="${(x(i) - (W - 2 * pad) / values.length / 2).toFixed(1)}" y="0" width="${((W - 2 * pad) / values.length).toFixed(1)}" height="${H}" fill="transparent"><title>${t('Spiel {i}: Ø {v} {unit}', { i: i + first, v: dec(v, s.digits), unit: t(s.unit) })}</title></rect>`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('{label}: gleitender Schnitt über 5 Spiele', { label: t(s.label) })}">
    <line x1="${pad}" x2="${W - pad}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line>
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
    <circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="3" fill="var(--accent)"></circle>${hits}
  </svg>`;
}

// Siegquote nach Spiel-Nr. am Tag (Tilt?), Tageszeit und Spiellänge. Ein „Tag“ geht bis 5 Uhr morgens
function winBlocks(games) {
  const dayOf = (g) => new Date(g.at - 5 * 3600e3).toDateString();
  const nth = new Map();
  const count = {};
  for (const g of games) {
    const d = dayOf(g);
    count[d] = (count[d] || 0) + 1;
    nth.set(g, count[d]);
  }
  const blocks = [
    [t('Spiel am Tag'), [['1.', (g) => nth.get(g) === 1], ['2.', (g) => nth.get(g) === 2], ['3.', (g) => nth.get(g) === 3], ['4+', (g) => nth.get(g) >= 4]]],
    [t('Tageszeit'), [[t('Morgens'), (g) => hour(g) >= 6 && hour(g) < 12], [t('Nachmittags'), (g) => hour(g) >= 12 && hour(g) < 18],
      [t('Abends'), (g) => hour(g) >= 18], [t('Nachts'), (g) => hour(g) < 6]]],
    // genaue Uhrzeit (Spielstart), nur Stunden mit Spielen, ab 6 Uhr morgens sortiert: zeigt einzelne schwache Stunden
    [t('Uhrzeit'), [...new Set(games.map(hour))].sort((a, b) => ((a + 18) % 24) - ((b + 18) % 24))
      .map((h) => [t('{h} Uhr', { h }), (g) => hour(g) === h])],
    [t('Spiellänge'), [['< 25 min', (g) => g.dur < 1500], ['25–35 min', (g) => g.dur >= 1500 && g.dur < 2100], ['> 35 min', (g) => g.dur >= 2100]]],
  ];
  return blocks.map(([title, rows]) => `<div class="card wins"><h2>${title}</h2>${rows.map(([label, test]) => {
    const list = games.filter(test);
    if (!list.length) return ''; // keine Spiele in dieser Zeile: weglassen statt „zu wenig · 0 Spiele“
    if (list.length < 3) return `<div class="wrow"><span>${label}</span><span class="hint">${t('zu wenig')}</span><small>${list.length === 1 ? t('1 Spiel') : t('{n} Spiele', { n: list.length })}</small></div>`;
    const w = Math.round((list.filter((g) => g.win).length / list.length) * 100);
    return `<div class="wrow" title="${t('{w} % Siege aus {n} Spielen', { w, n: list.length })}"><span>${label}</span>` +
      // SVG statt style="width": die CSP des Fensters blockt style-Attribute in innerHTML; Strich = 50 %
      `<svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
      `<rect width="${w}" height="8" rx="2" class="wfill"></rect><line x1="50" x2="50" y1="0" y2="8" class="wmid" vector-effect="non-scaling-stroke"></line></svg><small><b class="${w >= 50 ? 'win' : 'loss'}">${w} %</b> · ${list.length}</small></div>`;
  }).join('')}</div>`);
}
const hour = (g) => new Date(g.at).getHours();

function champPool(games) {
  const by = new Map();
  for (const g of games) {
    const c = by.get(g.champ) || { c: g.c, games: [], };
    c.games.push(g);
    by.set(g.champ, c);
  }
  const rows = [...by.values()].sort((a, b) => b.games.length - a.games.length).slice(0, 8);
  return `<div class="card">${versatility(games)}<table class="pool"><thead><tr><th>${t('Champion')}</th><th>${t('Spiele')}</th><th>${t('Siegquote')}</th><th>KDA</th>${progMap === 11 ? '<th>CS/min</th>' : ''}</tr></thead><tbody>` +
    rows.map(({ c, games: list }) => {
      const w = Math.round((list.filter((g) => g.win).length / list.length) * 100);
      const kda = list.reduce((a, g) => a + g.k + g.a, 0) / Math.max(list.reduce((a, g) => a + g.d, 0), 1);
      const csm = list.reduce((a, g) => a + g.cs, 0) / list.reduce((a, g) => a + gmins(g), 0);
      return `<tr class="click${String(progChamp) === String(list[0].champ) ? ' open' : ''}"${list.length >= 3 ? ` data-prof="${list[0].champ}"` : ''}><td><span class="pool-champ">${c ? champImg(c) + esc(c.name) : '?'}</span></td><td>${list.length}</td>` +
        `<td class="${w >= 50 ? 'win' : 'loss'}">${w} %</td><td>${dec(kda, 2)}</td>${progMap === 11 ? `<td>${dec(csm, 1)}</td>` : ''}</tr>`; // CS/min nur auf der Kluft
    }).join('') + '</tbody></table></div>';
}

// Wann du stirbst: Tode je 10 Minuten Spielzeit in jeder Phase (aus den Spielverläufen des Clients, also auch
// rückwirkend), dazu Gold beim Tod und Schadensart je Phase aus Farmys Spielprotokoll, soweit vorhanden
const PHASES = [[0, 600, '0–10 min'], [600, 1200, '10–20 min'], [1200, 1800, '20–30 min'], [1800, Infinity, '30+ min']];
function deathCard(games) {
  const tls = games.map((g) => progTimelines[g.id]).filter(Boolean);
  if (tls.length < 3) return `<div class="card"><p class="hint">${t('Noch zu wenige Spielverläufe ({n} von 3). Farmy lädt sie aus dem Client, sobald er läuft.', { n: tls.length })}</p></div>`;
  const ph = PHASES.map(([lo, hi, label]) => {
    let mins = 0, deaths = 0;
    for (const tl of tls) {
      mins += Math.max(0, Math.min(tl.dur, hi) - lo) / 60;
      deaths += tl.deaths.filter((s) => s >= lo && s < hi).length;
    }
    return { lo, hi, label, mins, deaths, rate: mins >= 20 ? (deaths / mins) * 10 : null };
  });
  const shown = ph.filter((x) => x.rate != null);
  const max = Math.max(...shown.map((x) => x.rate), 0.1);
  const worst = shown.reduce((a, x) => (!a || x.rate > a.rate ? x : a), null);
  // Schadensart je Phase aus dem Death Recap (nur Spiele mit Farmy-Protokoll)
  const ids = new Set(games.map((g) => String(g.id)));
  const logs = progLogs.filter((l) => ids.has(String(l.gameId)));
  const recap = logs.flatMap((l) => (l.deaths || []).filter((d) => d.phys != null && d.gameTime != null));
  const mixOf = (x) => {
    const list = recap.filter((d) => d.gameTime >= x.lo && d.gameTime < x.hi);
    if (list.length < 3) return '';
    const m = (k) => Math.round(mean(list.map((d) => d[k])));
    const [p, g] = [m('phys'), m('magic')];
    return p >= 60 ? t('meist physisch ({p} %)', { p }) : g >= 60 ? t('meist magisch ({p} %)', { p: g }) : t('gemischt');
  };
  const rows = shown.map((x) => `<div class="wrow phase"><span>${x.label}</span>` +
    `<svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
    `<rect width="${Math.round((x.rate / max) * 100)}" height="8" rx="2" class="${x === worst ? 'wbad' : 'wfill'}"></rect></svg>` +
    `<small><b>${dec(x.rate, 1)}</b> · ${t('{n} Tode', { n: x.deaths })}${mixOf(x) ? ` · ${mixOf(x)}` : ''}</small></div>`).join('');
  // Gold beim Tod über alle protokollierten Spiele
  const golds = logs.flatMap((l) => (l.died || []).map((d) => d.gold));
  const gold = golds.length >= 3 ? `<p class="hint">${t('Gold beim Tod: Ø {g} g, {p} % deiner Tode mit {min}+ g in der Tasche ({n} Tode).', { g: n(Math.round(mean(golds))), p: Math.round((golds.filter((x) => x >= RICH_GOLD).length / golds.length) * 100), min: n(RICH_GOLD), n: golds.length })}</p>`
    : `<p class="hint">${t('Gold beim Tod misst Farmy ab jetzt in jedem Spiel live.')}</p>`;
  return `<div class="card deaths"><p class="deaths-head">${worst ? t('Am häufigsten stirbst du in Minute {p}: {r} Tode je 10 Minuten.', { p: worst.label.replace(' min', ''), r: dec(worst.rate, 1) }) : ''}</p>` +
    rows + `<p class="hint">${t('Tode je 10 Minuten Spielzeit in der Phase, aus {n} Spielverläufen.', { n: tls.length })}</p>${gold}</div>`;
}

// Lane-Duell (Kluft): CS-, Gold- und Level-Differenz zu deinem Lane-Gegner bei 10 und 15 Minuten. Nur Spiele, in
// denen der Gegner eindeutig ist (siehe src/timelines.js)
function duelCard(games) {
  const list = games.map((g) => progTimelines[g.id]).filter((tl) => tl && tl.opp10 && tl.at10);
  if (list.length < 3) return `<div class="card"><p class="hint">${t('Noch zu wenige Spiele mit eindeutigem Lane-Gegner ({n} von 3). Ab jetzt merkt sich Farmy deinen Gegner im Spiel.', { n: list.length })}</p></div>`;
  const avg = (key, m) => {
    const xs = list.filter((tl) => tl[`at${m}`] && tl[`opp${m}`]).map((tl) => tl[`at${m}`][key] - tl[`opp${m}`][key]);
    return xs.length ? { v: mean(xs), n: xs.length } : null;
  };
  const cell = (x, d) => (x ? `<span class="${x.v >= 0 ? 'win' : 'loss'}">${x.v >= 0 ? '+' : ''}${dec(x.v, d)}</span>` : '–');
  const row = (m) => `<tr><td>${m} min</td><td>${cell(avg('cs', m), 1)}</td><td>${cell(avg('gold', m), 0)}</td><td>${cell(avg('lvl', m), 1)}</td></tr>`;
  const golds = list.map((tl) => tl.at10.gold - tl.opp10.gold);
  const ahead = golds.filter((x) => x > 0).length;
  return `<div class="card duel"><p>${t('In {a} von {n} Spielen warst du bei 10 Minuten im Gold vorne.', { a: ahead, n: list.length })}</p>` +
    `<table class="pool"><thead><tr><th>${t('Ø Differenz')}</th><th>CS</th><th>Gold</th><th>Level</th></tr></thead><tbody>${row(10)}${row(15)}</tbody></table>` +
    spark(golds, { label: t('Gold-Differenz bei 10 min'), unit: 'g', digits: 0 }, 1) +
    `<p class="hint">${t('Gold-Differenz bei 10 Minuten je Spiel, gestrichelt dein Schnitt. {n} Spiele mit eindeutigem Gegner.', { n: list.length })}</p></div>`;
}
