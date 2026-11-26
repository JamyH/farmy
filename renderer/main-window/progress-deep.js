// --- Fortschritt Runde 3: Todes-Karte, wer dich tötet, frühe Tode (bis Minute 15), Sicht (Kontrollwarden, zerstörte
// Wards), Anteile im Team, Vorsprung/Comeback, Lernkurve, Ermüdung, Level 6, Solo-Duelle, Objectives, Trainingsplan,
// Monatsvergleich. Fast alles aus deinen Spielverläufen (Client) ---

// Kartenzonen auf der Kluft (Koordinaten 0–~14800, blaue Basis unten links). Grob: Basen, Lanes an den Rändern und
// der Diagonale, Fluss entlang der Gegendiagonale, Rest Dschungel (eigener oder gegnerischer je nach Seite)
const MAPS = { 11: { w: 14820, h: 14881 }, 12: { w: 12988, h: 12988 } };
function zoneOf(x, y, myTeam) {
  if (x == null || y == null) return null;
  const blueSide = x + y < 14800;
  const own = (myTeam === 100) === blueSide;
  if ((x < 3200 && y < 3200) || (x > 11600 && y > 11600)) return own ? 'base' : 'enemyBase';
  if (x < 1900 || y > 12900) return 'top';
  if (y < 1900 || x > 12900) return 'bot';
  if (Math.abs(x - y) < 1300) return 'mid';
  if (Math.abs(x + y - 14800) < 1500) return 'river';
  return own ? 'jungle' : 'enemyJungle';
}
const ZONES = { base: 'eigene Basis', enemyBase: 'gegnerische Basis', top: 'Top-Lane', mid: 'Mid-Lane', bot: 'Bot-Lane',
  river: 'Fluss', jungle: 'eigener Dschungel', enemyJungle: 'gegnerischer Dschungel' };
const tlOf = (g) => {
  const tl = progTimelines[g.id];
  return tl && tl.v >= 3 ? tl : null;
};

// Schematische Karte statt Minimap-Bild (das Data-Dragon-Bild war unscharf und passte nicht zu den Koordinaten):
// Lanes, Fluss und Basen genau so, wie zoneOf die Zonen zählt. Oben links ist die gegnerische Seite der blauen Basis
function schematicMap(map) {
  if (map === 12) {
    return '<rect width="100" height="100" class="m-bg"></rect><path d="M8 92 L92 8" class="m-lane aram"></path>' +
      '<circle cx="8" cy="92" r="8" class="m-base blue"></circle><circle cx="92" cy="8" r="8" class="m-base red"></circle>';
  }
  return '<rect width="100" height="100" class="m-bg"></rect><path d="M0 0 L100 100" class="m-river"></path>' +
    '<path d="M7 93 L7 7 L93 7" class="m-lane"></path><path d="M7 93 L93 93 L93 7" class="m-lane"></path><path d="M9 91 L91 9" class="m-lane"></path>' +
    '<circle cx="9" cy="91" r="10" class="m-base blue"></circle><circle cx="91" cy="9" r="10" class="m-base red"></circle>';
}

// 1. Todes-Karte: jeder Tod als Punkt auf der Minimap (Farbe nach Spielphase), dazu die Zonen mit den meisten Toden
function deathMapCard(games, map) {
  const list = games.map((g) => ({ g, tl: tlOf(g) })).filter((x) => x.tl);
  const pts = list.flatMap(({ g, tl }) => tl.deathsAt.filter((d) => d.x != null).map((d) => ({ ...d, team: tl.team, win: g.win })));
  if (pts.length < 5) return `<div class="card"><p class="hint">${t('Noch zu wenige Tode mit Ort ({n} von 5).', { n: pts.length })}</p></div>`;
  const M = MAPS[map] || MAPS[11];
  const dots = pts.map((d) => {
    const cx = (d.x / M.w) * 100, cy = 100 - (d.y / M.h) * 100;
    const ph = d.t < 840 ? 'early' : d.t < 1500 ? 'mid' : 'late';
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4" class="dd ${ph}"><title>${dur(d.t)} · ${esc(t(ZONES[zoneOf(d.x, d.y, d.team)] || ''))}</title></circle>`;
  }).join('');
  let zones = '';
  if (map === 11) {
    // kaum Kontrollwarden: feste Gewohnheit statt Skill-Wert (bei jedem Recall eine)
    const cwl = recent.filter((g) => g.cw != null);
    const cwAvg = cwl.length >= 3 ? mean(cwl.map((g) => g.cw)) : null;
    if (cwAvg != null && cwAvg < 1.5) {
      const target = Math.min(3, Math.floor(cwAvg) + 1);
      tasks.push({ kind: 'cw', key: '', target, text: t('Mindestens {n} Kontrollwarden je Spiel kaufen', { n: target }) });
    }
    const count = {};
    for (const d of pts) {
      const z = zoneOf(d.x, d.y, d.team);
      if (z) count[z] = (count[z] || 0) + 1;
    }
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4);
    zones = `<div class="zones"><p class="deaths-head">${t('Am häufigsten: {zone} ({p} % deiner Tode).', { zone: t(ZONES[top[0][0]]), p: Math.round((top[0][1] / pts.length) * 100) })}</p>` +
      top.map(([z, n]) => `<div class="wrow"><span>${t(ZONES[z])}</span><svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
        `<rect width="${Math.round((n / top[0][1]) * 100)}" height="8" rx="2" class="wfill"></rect></svg><small>${Math.round((n / pts.length) * 100)} % · ${n}</small></div>`).join('') +
      `<p class="hint">${t('Zonen grob nach Kartenkoordinaten (Lanes an den Rändern und der Mitte, Fluss, Dschungel je Seite).')}</p></div>`;
  }
  return `<div class="card dmap"><div class="dmap-grid"><figure class="minimap"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(t('Deine Tode auf der Karte'))}">` +
    `${schematicMap(map)}${dots}</svg>` +
    `<figcaption><span class="lgd early"></span>${t('bis 14 min')} <span class="lgd mid"></span>${t('14–25 min')} <span class="lgd late"></span>${t('ab 25 min')}</figcaption></figure>` +
    `${zones}</div><p class="hint">${t('{n} Tode aus {g} Spielen. Ort laut Spielverlauf des Clients.', { n: pts.length, g: list.length })}</p></div>`;
}

// 2. + 9. Wer dich tötet und Solo-Duelle: häufigste Killer, wie oft mehrere Gegner beteiligt waren, Solo-Kills gegen Solo-Tode
function killersCard(games) {
  const list = games.map(tlOf).filter(Boolean);
  const deaths = list.flatMap((tl) => tl.deathsAt);
  if (deaths.length < 5) return `<div class="card"><p class="hint">${t('Noch zu wenige Tode mit Killer-Daten ({n} von 5).', { n: deaths.length })}</p></div>`;
  const by = new Map();
  for (const d of deaths.filter((x) => x.killer)) by.set(d.killer, (by.get(d.killer) || 0) + 1);
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const gang = deaths.filter((d) => d.n >= 2).length;
  const noChamp = deaths.filter((d) => !d.killer).length;
  const soloK = list.reduce((a, tl) => a + tl.kills.filter((k) => k.solo).length, 0);
  const soloD = deaths.filter((d) => d.killer && d.n === 1).length;
  return `<div class="card killers"><div class="ecols"><div><h2>${t('Wer dich am häufigsten tötet')}</h2>` +
    top.map(([key, n]) => {
      const ch = champOf(key);
      return `<div class="erow"><span class="champ">${champImg(ch)}${esc(ch ? ch.name : String(key))}</span><b>${n}×</b><small>${Math.round((n / deaths.length) * 100)} %</small></div>`;
    }).join('') + `</div><div><h2>${t('Wie du stirbst')}</h2>` +
    `<div class="rv-row"><span class="rv-label">${t('gegen 2+ Gegner')}</span><span><b>${Math.round((gang / deaths.length) * 100)} %</b> ${t('deiner Tode')}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Turm/Vasallen')}</span><span><b>${Math.round((noChamp / deaths.length) * 100)} %</b></span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('Solo-Kills')}</span><span><b>${soloK}</b> · ${t('Solo-Tode')} <b>${soloD}</b>` +
    `${soloK + soloD ? ` · <span class="${soloK >= soloD ? 'win' : 'loss'}">${t('{p} % deiner 1-gegen-1 gewonnen', { p: Math.round((soloK / (soloK + soloD)) * 100) })}</span>` : ''}</span></div>` +
    `<p class="hint">${t('Viele Tode gegen 2+ Gegner heißt meist: falsch stehen, wenn der Gegner-Jungler oder Roamer kommt. Viele Solo-Tode: Duelle überschätzt.')}</p></div></div></div>`;
}

// 3b. Frühe Tode (Kluft, bis Minute 15): wer dich tötet – Lane-Gegner, gegnerischer Jungler (Gegner mit Smite) oder
// andere –, Tode auf Level 1–2 (vor 2:30), wann der Jungler dich erwischt und Serien gegen denselben Gegner
const EARLY = 900;
const JG_BUCKETS = [[0, 180, '0–3'], [180, 360, '3–6'], [360, 540, '6–9'], [540, 720, '9–12'], [720, 900, '12–15']];
const KILLER_LABELS = { lane: 'Lane-Gegner', jungle: 'Gegnerischer Jungler', other: 'Andere (Roams, Mid …)', tower: 'Turm/Vasallen' };
const killerKind = (d, tl) => (!d.killer ? 'tower' : tl.oppChamp && d.killer === tl.oppChamp ? 'lane'
  : tl.ejChamp && d.killer === tl.ejChamp ? 'jungle' : 'other');
const barRow = (label, v, max, bad, small) => `<div class="wrow phase"><span>${label}</span>` +
  `<svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
  `<rect width="${Math.round((v / Math.max(max, 1)) * 100)}" height="8" rx="2" class="${bad ? 'wbad' : 'wfill'}"></rect></svg><small>${small}</small></div>`;
function earlyDeathCard(games) {
  const list = games.map(tlOf).filter((tl) => tl && tl.lane && tl.lane !== 'jungle');
  const deaths = list.flatMap((tl) => tl.deathsAt.filter((d) => d.t < EARLY).map((d) => ({ ...d, kind: killerKind(d, tl) })));
  if (deaths.length < 5) return `<div class="card"><p class="hint">${t('Noch zu wenige frühe Tode auf einer Lane ({n} von 5).', { n: deaths.length })}</p></div>`;
  const count = { lane: 0, jungle: 0, other: 0, tower: 0 };
  for (const d of deaths) count[d.kind]++;
  const pct = (x) => Math.round((x / deaths.length) * 100);
  const max = Math.max(...Object.values(count));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const rows = Object.entries(count).filter(([, v]) => v)
    .map(([k, v]) => barRow(t(KILLER_LABELS[k]), v, max, k === top[0], `<b>${pct(v)} %</b> · ${v}`)).join('');
  // Jungler-Tode nach Spielminute: wann die Ganks kommen
  const jg = deaths.filter((d) => d.kind === 'jungle');
  let gank = `<p class="hint">${t('Noch zu wenige Tode durch den gegnerischen Jungler für eine Zeitverteilung.')}</p>`;
  if (jg.length >= 3) {
    const b = JG_BUCKETS.map(([lo, hi, label]) => ({ label, n: jg.filter((d) => d.t >= lo && d.t < hi).length }));
    const worst = b.reduce((a, x) => (x.n > a.n ? x : a));
    gank = `<h2>${t('Wann dich der Jungler erwischt')}</h2>` +
      b.map((x) => barRow(t('Minute {m}', { m: x.label }), x.n, worst.n, x === worst, x.n)).join('') +
      `<p class="hint">${t('Die meisten Jungler-Tode fallen in Minute {m}. Dann den Fluss-Busch warden und ohne Sicht auf den Jungler nicht weit vorpushen.', { m: worst.label })}</p>`;
  }
  // Level 1–2 und Serien: zweimal oder öfter früh am selben Gegner gestorben
  const lvl1 = deaths.filter((d) => d.t < 150).length;
  const streaky = list.filter((tl) => {
    const by = {};
    for (const d of tl.deathsAt.filter((x) => x.t < EARLY && x.killer)) by[d.killer] = (by[d.killer] || 0) + 1;
    return Object.values(by).some((v) => v >= 2);
  }).length;
  const verdict = top[0] === 'lane' ? t('{p} % deiner frühen Tode gehen auf deinen Lane-Gegner: Trades und Wellenstand sind die größte Baustelle.', { p: pct(top[1]) })
    : top[0] === 'jungle' ? t('{p} % deiner frühen Tode gehen auf den gegnerischen Jungler: Sicht im Fluss und Wellenstand prüfen.', { p: pct(top[1]) }) : '';
  return `<div class="card early-deaths">${verdict ? `<p class="deaths-head">${verdict}</p>` : ''}<div class="ecols"><div><h2>${t('Wer dich bis Minute 15 tötet')}</h2>${rows}` +
    `<div class="rv-row"><span class="rv-label">${t('vor 2:30 (Level 1–2)')}</span><span><b class="${lvl1 ? 'loss' : 'win'}">${lvl1}</b> ${t('Tode in {n} Spielen', { n: list.length })}</span></div>` +
    `<div class="rv-row"><span class="rv-label">${t('2+ Mal am selben Gegner')}</span><span><b class="${streaky * 3 > list.length ? 'loss' : ''}">${t('in {a} von {b} Spielen', { a: streaky, b: list.length })}</b></span></div>` +
    `</div><div>${gank}</div></div>` +
    `<p class="hint">${t('{n} Tode bis Minute 15 auf einer Lane. Jungler = Gegner mit Smite, Lane-Gegner wie im Lane-Duell.', { n: deaths.length })}</p></div>`;
}

// 3c. Sicht (Kluft): gekaufte Kontrollwarden, gesetzte und zerstörte Wards je Spiel, Siege gegen Niederlagen
function sightCard(games) {
  const list = games.filter((g) => g.cw != null);
  if (list.length < 3) return `<div class="card"><p class="hint">${t('Kontrollwarden und zerstörte Wards merkt sich Farmy seit dieser Version ({n} von 3 Spielen). Ältere Spiele ergänzt es aus dem Client, soweit er sie noch kennt.', { n: list.length })}</p></div>`;
  const avg = (l, k) => mean(l.map((g) => g[k] || 0));
  const none = (k) => Math.round((list.filter((g) => !g[k]).length / list.length) * 100);
  const [cw, wk, wp] = [avg(list, 'cw'), avg(list, 'wk'), avg(list, 'wp')];
  const win = list.filter((g) => g.win), loss = list.filter((g) => !g.win);
  const row = (label, v, extra, bad) => `<div class="rv-row"><span class="rv-label">${label}</span><span><b class="${bad ? 'loss' : 'win'}">${dec(v, 1)}</b> ${extra}</span></div>`;
  const verdict = cw < 1 ? t('Du kaufst kaum Kontrollwarden (Ø {v} je Spiel). Eine bei jedem Recall ist die einfachste Sicht-Gewohnheit.', { v: dec(cw, 1) }) : '';
  const vs = win.length >= 2 && loss.length >= 2
    ? `<p class="hint">${t('Kontrollwarden in Siegen Ø {a}, in Niederlagen Ø {b}.', { a: dec(avg(win, 'cw'), 1), b: dec(avg(loss, 'cw'), 1) })}</p>` : '';
  return `<div class="card sight">${verdict ? `<p class="deaths-head">${verdict}</p>` : ''}` +
    row(t('Kontrollwarden gekauft'), cw, t('je Spiel · in {p} % der Spiele keine', { p: none('cw') }), cw < 1) +
    row(t('Gegnerische Wards zerstört'), wk, t('je Spiel · in {p} % der Spiele keine', { p: none('wk') }), wk < 1.5) +
    row(t('Wards gesetzt'), wp, t('je Spiel'), false) +
    `${vs}<p class="hint">${t('Aus {n} Spielen. Gegnerische Wards findest du am leichtesten mit der roten Linse (Oracle Lens), sobald die Lane-Phase vorbei ist.', { n: list.length })}</p></div>`;
}

// 4. Anteile im Team: dein Anteil an Schaden, Gold und Toden deines Teams
function shareCard(games) {
  const list = games.map(tlOf).filter((tl) => tl && tl.share && tl.share.dmg != null);
  if (list.length < 3) return `<div class="card"><p class="hint">${t('Noch zu wenige Spiele mit Teamdaten ({n} von 3).', { n: list.length })}</p></div>`;
  const avg = (k) => Math.round(mean(list.map((tl) => tl.share[k] || 0)) * 100);
  const [dmg, gold, deaths] = [avg('dmg'), avg('gold'), avg('deaths')];
  const verdict = deaths > dmg + 3 ? t('Du hast mehr Anteil an den Toden ({d} %) als am Schaden ({s} %) deines Teams.', { d: deaths, s: dmg })
    : dmg > gold + 3 ? t('Du machst mehr Schaden ({s} %), als du Gold bekommst ({g} %): effizient.', { s: dmg, g: gold }) : '';
  const bar = (label, v, cls) => `<div class="wrow"><span>${label}</span><svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect width="100" height="8" rx="2" class="wbg"></rect><rect width="${Math.min(100, v * 2)}" height="8" rx="2" class="${cls}"></rect>` +
    `<line x1="40" x2="40" y1="0" y2="8" class="wmid" vector-effect="non-scaling-stroke"></line></svg><small><b>${v} %</b></small></div>`;
  return `<div class="card">${verdict ? `<p class="deaths-head">${verdict}</p>` : ''}${bar(t('Schaden'), dmg, 'wfill')}${bar(t('Gold'), gold, 'wfill')}${bar(t('Tode'), deaths, 'wbad')}` +
    `<p class="hint">${t('Dein Schnitt-Anteil am Team aus {n} Spielen; bei 5 Spielern wären 20 % genau ein Fünftel (Strich bei 20 %).', { n: list.length })}</p></div>`;
}

// 5. Vorsprung verspielt / Comeback: Team-Gold-Differenz bei 15 Minuten (ARAM 10) gegen das Ergebnis
function leadCard(games, map) {
  const m = map === 11 ? 15 : 10, lim = map === 11 ? 2000 : 1500;
  const list = games.map((g) => ({ g, tl: tlOf(g) })).filter((x) => x.tl && x.tl.goldDiff && x.tl.goldDiff.length > m);
  if (list.length < 5) return `<div class="card"><p class="hint">${t('Noch zu wenige Spielverläufe ({n} von 5).', { n: list.length })}</p></div>`;
  const ahead = list.filter((x) => x.tl.goldDiff[m] >= lim), behind = list.filter((x) => x.tl.goldDiff[m] <= -lim);
  const row = (label, l, good) => {
    if (!l.length) return `<div class="rv-row"><span class="rv-label">${label}</span><span class="hint">${t('kein Spiel')}</span></div>`;
    const w = l.filter((x) => x.g.win).length;
    return `<div class="rv-row"><span class="rv-label">${label}</span><span><b class="${good(w / l.length) ? 'win' : 'loss'}">${t('{w} von {n} gewonnen', { w, n: l.length })}</b></span></div>`;
  };
  const throws = ahead.filter((x) => !x.g.win).length, comebacks = behind.filter((x) => x.g.win).length;
  return `<div class="card lead">${row(t('{n}+ Gold vorne bei {m} min', { n: n(lim), m }), ahead, (q) => q >= 0.7)}` +
    `${row(t('{n}+ Gold hinten bei {m} min', { n: n(lim), m }), behind, (q) => q >= 0.3)}` +
    `<p class="deaths-head">${t('Trotz Vorsprung verloren: {a} · trotz Rückstand gewonnen: {b}', { a: throws, b: comebacks })}</p>` +
    `<p class="hint">${t('Team-Gold-Differenz bei {m} Minuten aus {n} Spielverläufen.', { m, n: list.length })}</p></div>`;
}

// 6. Lernkurve: dein Schnitt im 1., 2., 3., 4.–5. und ab dem 6. Spiel auf einem Champion (über alle Champions)
function learnCard(games) {
  const nth = new Map(), count = {};
  for (const g of [...games].sort((a, b) => a.at - b.at)) {
    count[g.champ] = (count[g.champ] || 0) + 1;
    nth.set(g, count[g.champ]);
  }
  const rows = [['1.', (k) => k === 1], ['2.', (k) => k === 2], ['3.', (k) => k === 3], ['4.–5.', (k) => k >= 4 && k <= 5], ['6.+', (k) => k >= 6]];
  const stat = (l) => ({ n: l.length, wr: Math.round((l.filter((g) => g.win).length / l.length) * 100), kda: mean(l.map(kdaOf)) });
  const data = rows.map(([label, test]) => [label, games.filter((g) => test(nth.get(g)))]).filter(([, l]) => l.length >= 3);
  if (data.length < 2) return `<div class="card"><p class="hint">${t('Noch zu wenige Spiele auf denselben Champions.')}</p></div>`;
  return `<div class="card"><table class="pool"><thead><tr><th>${t('Spiel auf dem Champion')}</th><th>${t('Spiele')}</th><th>${t('Siegquote')}</th><th>KDA</th></tr></thead><tbody>` +
    data.map(([label, l]) => {
      const s = stat(l);
      return `<tr><td>${label}</td><td>${s.n}</td><td class="${s.wr >= 50 ? 'win' : 'loss'}">${s.wr} %</td><td>${dec(s.kda, 2)}</td></tr>`;
    }).join('') + `</tbody></table><p class="hint">${t('Wie gut du in deinem n-ten Spiel auf einem Champion bist, über alle Champions zusammen. Zeigt, wie schnell du einen Champ lernst.')}</p></div>`;
}

// 7. Ermüdung: KDA und Tode nach Spiel-Nr. in der Session (Spiele mit höchstens 2 Stunden Pause dazwischen)
function fatigueCard(games) {
  const list = [...games].sort((a, b) => a.at - b.at);
  const idx = new Map();
  list.forEach((g, i) => {
    const prev = list[i - 1];
    idx.set(g, prev && g.at - (prev.at + prev.dur * 1000) <= 2 * 3600e3 ? idx.get(prev) + 1 : 1);
  });
  const rows = [['1.', (k) => k === 1], ['2.', (k) => k === 2], ['3.', (k) => k === 3], ['4+', (k) => k >= 4]]
    .map(([label, test]) => [label, list.filter((g) => test(idx.get(g)))]).filter(([, l]) => l.length >= 3);
  if (rows.length < 2) return `<div class="card"><p class="hint">${t('Noch zu wenige Sessions mit mehreren Spielen.')}</p></div>`;
  const dpm = (l) => (l.reduce((a, g) => a + g.d, 0) / l.reduce((a, g) => a + gmins(g), 0)) * 10;
  const first = dpm(rows[0][1]), last = dpm(rows[rows.length - 1][1]);
  const verdict = last > first * 1.15 ? `<p class="deaths-head loss">${t('Ab dem {k}. Spiel einer Session stirbst du {p} % öfter als im ersten.', { k: rows[rows.length - 1][0].replace(/\D/g, ''), p: Math.round((last / first - 1) * 100) })}</p>` : '';
  return `<div class="card">${verdict}<table class="pool"><thead><tr><th>${t('Spiel in der Session')}</th><th>${t('Spiele')}</th><th>KDA</th><th>${t('Tode/10 min')}</th><th>${t('Siegquote')}</th></tr></thead><tbody>` +
    rows.map(([label, l]) => `<tr><td>${label}</td><td>${l.length}</td><td>${dec(mean(l.map(kdaOf)), 2)}</td><td>${dec(dpm(l), 1)}</td>` +
      `<td>${Math.round((l.filter((g) => g.win).length / l.length) * 100)} %</td></tr>`).join('') + '</tbody></table></div>';
}

// 8. Level 6: Minute deines Level-6-Spikes gegen deinen Lane-Gegner (nur Kluft)
function lvl6Card(games) {
  const list = games.map(tlOf).filter((tl) => tl && tl.lvl6 != null);
  if (list.length < 3) return `<div class="card"><p class="hint">${t('Noch zu wenige Kluft-Spiele mit Spielverlauf ({n} von 3).', { n: list.length })}</p></div>`;
  const vs = list.filter((tl) => tl.oppLvl6 != null);
  const first = vs.filter((tl) => tl.lvl6 < tl.oppLvl6).length, later = vs.filter((tl) => tl.lvl6 > tl.oppLvl6).length;
  return `<div class="card"><p class="deaths-head">${t('Level 6 im Schnitt in Minute {m}.', { m: dec(mean(list.map((tl) => tl.lvl6)), 1) })}</p>` +
    (vs.length ? `<p>${t('Gegen deinen Lane-Gegner: {a}× zuerst, {b}× später, {c}× gleich ({n} Spiele mit eindeutigem Gegner).', { a: first, b: later, c: vs.length - first - later, n: vs.length })}</p>`
      : `<p class="hint">${t('Vergleich mit dem Lane-Gegner, sobald Farmy ihn im Spiel erkannt hat.')}</p>`) +
    `<p class="hint">${t('Minutengenau aus dem Spielverlauf (der Client speichert einen Stand pro Minute).')}</p></div>`;
}

// 10. Objectives: bei wie vielen Drachen, Baronen, Herolden, Larven und Türmen deines Teams du beteiligt warst
function objCard(games) {
  const list = games.map(tlOf).filter(Boolean);
  const NAMES = { DRAGON: 'Drachen', BARON_NASHOR: 'Baron', RIFTHERALD: 'Herold', HORDE: 'Larven', TOWER: 'Türme', ATAKHAN: 'Atakhan' };
  const rows = Object.keys(NAMES).map((type) => {
    const ours = list.flatMap((tl) => tl.objectives.filter((o) => o.type === type && o.team === tl.team));
    return ours.length >= 3 ? [type, ours.length, ours.filter((o) => o.mine).length] : null;
  }).filter(Boolean);
  if (!rows.length) return `<div class="card"><p class="hint">${t('Noch zu wenige Objectives deines Teams mit bekanntem Killer.')}</p></div>`;
  return `<div class="card">` + rows.map(([type, all, mine]) => `<div class="wrow"><span>${t(NAMES[type])}</span>` +
    `<svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
    `<rect width="${Math.round((mine / all) * 100)}" height="8" rx="2" class="wfill"></rect></svg><small><b>${Math.round((mine / all) * 100)} %</b> · ${mine}/${all}</small></div>`).join('') +
    `<p class="hint">${t('Anteil der Objectives deines Teams, bei denen du Killer oder Helfer warst. Objectives ohne bekannten Killer zählen nicht.')}</p></div>`;
}

// 12. Monatsvergleich: je Skill dein bester Monat (ab 5 Spielen) gegen den aktuellen
function monthCard(games, map) {
  const key = (g) => {
    const d = new Date(g.at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const months = [...new Set(games.map(key))].sort();
  const valid = months.filter((m) => games.filter((g) => key(g) === m).length >= 5);
  if (valid.length < 2) return `<div class="card"><p class="hint">${t('Der Monatsvergleich braucht mindestens 2 Monate mit je 5 Spielen ({n} bisher).', { n: valid.length })}</p></div>`;
  const now = valid[valid.length - 1];
  const label = (m) => new Date(`${m}-15`).toLocaleDateString(i18n.locale(), { month: 'long', year: 'numeric' });
  const rows = SKILLS.filter((s) => !s.set && (!s.maps || s.maps.includes(map))).map((s) => {
    const v = (m) => {
      const l = games.filter((g) => key(g) === m && (!s.needs || g[s.needs] != null));
      return l.length >= 5 ? mean(l.map(s.val)) : null;
    };
    const vals = valid.map((m) => [m, v(m)]).filter(([, x]) => x != null);
    if (vals.length < 2) return null;
    const best = vals.reduce((a, b) => (better(s, b[1], a[1]) ? b : a));
    const cur = vals.find(([m]) => m === now);
    if (!cur) return null;
    const isBest = best[0] === now;
    return `<tr><td>${t(s.label)}</td><td>${dec(cur[1], s.digits)}</td><td>${isBest ? `<span class="win">${t('jetzt am besten')}</span>` : `${dec(best[1], s.digits)} <small class="muted">${label(best[0])}</small>`}</td></tr>`;
  }).filter(Boolean);
  return `<div class="card"><table class="pool"><thead><tr><th></th><th>${label(now)}</th><th>${t('dein bester Monat')}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

// 11. Trainingsplan: 2–3 Aufgaben aus deinen Schwächen, die Farmy nach jedem Spiel selbst auswertet (keine Haken von Hand)
const PLAN_KINDS = {
  // Skill-Wert je Spiel mindestens/höchstens target
  skill: (task, g) => {
    const s = SKILLS.find((x) => x.key === task.key);
    if (!s || (s.needs && g[s.needs] == null)) return null;
    return s.lower ? s.val(g) <= task.target : s.val(g) >= task.target;
  },
  // höchstens target Tode in einer Zone
  zone: (task, g) => {
    const tl = tlOf(g);
    if (!tl) return null;
    return tl.deathsAt.filter((d) => zoneOf(d.x, d.y, tl.team) === task.key).length <= task.target;
  },
  // mindestens target gekaufte Kontrollwarden
  cw: (task, g) => (g.cw == null ? null : g.cw >= task.target),
  // höchstens target Tode gegen 2+ Gegner
  gank: (task, g) => {
    const tl = tlOf(g);
    if (!tl) return null;
    return tl.deathsAt.filter((d) => d.n >= 2).length <= task.target;
  },
};
function makePlan(games, map, rated) {
  const tasks = [];
  const recent = games.slice(-10);
  const weak = [...rated].filter((s) => !s.set && s.better < 0).sort((a, b) => a.better - b.better)[0];
  if (weak) {
    const target = Math.round(mean(recent.filter((g) => !weak.needs || g[weak.needs] != null).map(weak.val)) * (weak.lower ? 0.9 : 1.1) * 10) / 10;
    tasks.push({ kind: 'skill', key: weak.key, target, text: t('{label}: {op} {v} {unit} je Spiel', { label: t(weak.label), op: weak.lower ? t('höchstens') : t('mindestens'), v: dec(target, weak.digits), unit: t(weak.unit) }) });
  }
  if (map === 11) {
    const count = {};
    for (const g of recent) {
      const tl = tlOf(g);
      if (tl) for (const d of tl.deathsAt) {
        const z = zoneOf(d.x, d.y, tl.team);
        if (z && z !== 'base') count[z] = (count[z] || 0) + 1;
      }
    }
    const z = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (z && z[1] >= 5) tasks.push({ kind: 'zone', key: z[0], target: 1, text: t('Höchstens 1 Tod im Bereich {zone} je Spiel', { zone: t(ZONES[z[0]]) }) });
  }
  const tls = recent.map(tlOf).filter(Boolean);
  if (tls.length >= 3) {
    const gangs = mean(tls.map((tl) => tl.deathsAt.filter((d) => d.n >= 2).length));
    if (gangs >= 1.5) tasks.push({ kind: 'gank', key: '', target: Math.max(1, Math.floor(gangs * 0.7)), text: t('Höchstens {n} Tode gegen 2+ Gegner je Spiel', { n: Math.max(1, Math.floor(gangs * 0.7)) }) });
  }
  return { created: Date.now(), map, queue: progQueue, tasks: tasks.slice(0, 3) };
}
function planCard(games, map, rated) {
  const p = progPlan;
  if (!p || !p.tasks || !p.tasks.length) {
    return `<div class="card plan-card"><div class="card-head"><h2>${t('Trainingsplan')}</h2><button class="ghost" data-plan="new">${t('Plan erstellen')}</button></div>` +
      `<p class="hint">${t('Farmy stellt 2–3 Aufgaben aus deinen Schwächen zusammen und wertet sie nach jedem Spiel selbst aus.')}</p></div>`;
  }
  const after = progGames.filter((g) => g.cs != null && g.at >= p.created && g.map === p.map);
  const rows = p.tasks.map((task) => {
    const res = after.map((g) => PLAN_KINDS[task.kind](task, g)).filter((x) => x != null);
    const ok = res.filter(Boolean).length;
    return `<div class="rv-row"><span class="rv-label">${res.length ? `<b class="${ok * 2 >= res.length ? 'win' : 'loss'}">${ok}/${res.length}</b>` : '–'}</span>` +
      `<span>${esc(task.text)} <small class="muted">${res.slice(-5).map((x) => (x ? '✓' : '✗')).join(' ')}</small></span></div>`;
  });
  return `<div class="card plan-card"><div class="card-head"><h2>${t('Trainingsplan')}</h2><span>` +
    `<button class="ghost" data-plan="new">${t('Neuer Plan')}</button> <button class="ghost danger-text" data-plan="end">${t('Plan beenden')}</button></span></div>` +
    rows.join('') + `<p class="hint">${t('Seit {d}, {n} Spiele ausgewertet ({mode}). Geschafft wird aus deinen echten Werten berechnet.', {
      d: new Date(p.created).toLocaleDateString(i18n.locale()), n: after.length, mode: t(PMODES[p.map] || '') })}</p></div>`;
}
