// --- Fortschritt, Ausbau nach Mobalytics-Vorbild (nur eigene Spiele): Skill-Profil jetzt gegen früher, Skill-Details,
// Siege gegen Niederlagen, Angstgegner, Nach Niederlagen, Champion-Profil und Vielseitigkeit, Rekorde, Ziel-Verlauf ---
const champCache = new Map(); // Champion-Key -> Data-Dragon-Champion (für Gegner, die du nie selbst gespielt hast)
const champOf = (key) => champCache.get(Number(key)) || null;
const better = (s, a, b) => (s.lower ? a < b : a > b);

// Skill-Profil wie „jetzt gegen früher“: beide Werte auf einer Skala 0–100, gemessen an deinen eigenen Fünf-Spiele-
// Schnitten (100 = so gut wie dein bester Abschnitt, 0 = wie dein schwächster). Kein Vergleich mit anderen Spielern
function profileCard(rated) {
  const score = (s, v) => {
    const r = s.rolling;
    if (!r || r.length < 3) return null;
    return Math.round((r.filter((x) => !better(s, x, v)).length / r.length) * 100);
  };
  const rows = rated.map((s) => ({ s, now: score(s, s.now), before: score(s, s.base) })).filter((x) => x.now != null && x.before != null);
  if (!rows.length) return '';
  return `<div class="card profile"><div class="card-head"><h2>${t('Skill-Profil')}</h2>` +
    `<span class="hint">${t('davor → zuletzt, 0–100 gemessen an deinen eigenen Abschnitten zu {w} Spielen', { w: progW })}</span></div>` +
    `<div class="pgrid">${rows.length >= 3 ? radarSvg(rows) : ''}<div class="pbars">` +
    rows.map(({ s, now, before }) => `<div class="wrow prow" title="${esc(t('{label}: zuletzt {now}, davor {before}', { label: t(s.label), now, before }))}"><span>${t(s.label)}</span>` +
      `<svg class="ptrack" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect y="4" width="100" height="2" rx="1" class="wbg"></rect>` +
      `<line x1="${before}" x2="${now}" y1="5" y2="5" class="${now >= before ? 'pup' : 'pdown'}" vector-effect="non-scaling-stroke"></line></svg>` +
      `<small><span class="muted">${before}</span> → <b class="${now >= before ? 'win' : 'loss'}">${now}</b></small></div>`).join('') +
    // Punkte als HTML über dem SVG wären genauer; Kreise im gestauchten SVG würden zu Ellipsen, daher nur die Strecke
    `<p class="hint">${t('Grün: besser als in den Spielen davor, Rot: schlechter.')}</p></div></div></div>`;
}

// Netzdiagramm (wie das Skill-Hexagon bei Mobalytics): je Skill eine Achse von der Mitte (0) nach außen (100).
// Fläche = zuletzt, gestrichelt = davor. Gleiche Werte wie die Balken daneben, die bleiben als genaue Ablesung
// text: Beschriftungen für einen anderen Vergleich (Spielerprofil: er gegen dich); ohne = zuletzt gegen davor
function radarSvg(rows, text = null) {
  const T = text || {
    tip: (s, now, before) => t('{label}: zuletzt {now}, davor {before}', { label: t(s.label), now, before }),
    aria: t('Skill-Profil als Netzdiagramm: zuletzt gegen davor'),
    caption: `<span class="lg now"></span>${t('letzte {n} Spiele', { n: progK })} <span class="lg before"></span>${t('die Spiele davor')}`,
    hint: t('Weiter außen = besser, gemessen an dir selbst. Fläche innerhalb der Linie: zuletzt schwächer als sonst.'),
  };
  const n = rows.length, cx = 160, cy = 150, R = 105;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [25, 50, 75, 100].map((v) => `<polygon points="${poly(rows.map(() => v))}" class="rgrid"></polygon>`).join('');
  const axes = rows.map((_, i) => {
    const [x, y] = pt(i, 100);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rgrid"></line>`;
  }).join('');
  const labels = rows.map(({ s, now }, i) => {
    const [x, y] = pt(i, 122);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" class="rlabel">${esc(t(s.label))}</text>` +
      `<text x="${x.toFixed(1)}" y="${(y + 18).toFixed(1)}" text-anchor="${anchor}" class="rvalue">${now}</text>`;
  }).join('');
  // Punkte mit Hover: Wert zuletzt und davor
  const dots = rows.map(({ s, now, before }, i) => {
    const [x, y] = pt(i, now);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="rdot"><title>${esc(T.tip(s, now, before))}</title></circle>`;
  }).join('');
  return `<figure class="radar"><svg viewBox="-20 0 360 310" role="img" aria-label="${esc(T.aria)}">` +
    `${rings}${axes}<polygon points="${poly(rows.map((r) => r.before))}" class="rbefore"></polygon>` +
    `<polygon points="${poly(rows.map((r) => r.now))}" class="rnow"></polygon>${dots}${labels}</svg>` +
    `<figcaption>${T.caption}</figcaption>` +
    `<p class="hint radar-hint">${T.hint}</p></figure>`;
}

// Skill-Details („Metric Allocation“): woraus der Wert besteht, bestes und schlechtestes Spiel, Verlauf je Spiel
function detailCard(skills, games) {
  const s = skills.find((x) => x.key === progDetail && !x.missing);
  if (!s) return '';
  const has = (g) => !s.needs || g[s.needs] != null;
  const list = games.filter(has);
  let extremes = '';
  if (!s.set) {
    const sorted = [...list].sort((a, b) => (better(s, s.val(a), s.val(b)) ? -1 : 1));
    const show = (g, label) => `<div class="rec"><label>${label}</label><b>${dec(s.val(g), s.digits)}</b> <small>${t(s.unit)}</small>` +
      `<span class="champ">${champImg(g.c)}${esc(g.c ? g.c.name : '?')}</span><small class="${g.win ? 'win' : 'loss'}">${g.win ? t('Sieg') : t('Niederlage')}</small>` +
      `<small>${new Date(g.at).toLocaleDateString(i18n.locale())}</small></div>`;
    extremes = `<div class="recs">${show(sorted[0], t('Bestes Spiel'))}${show(sorted[sorted.length - 1], t('Schwächstes Spiel'))}</div>`;
  }
  const per = s.set ? s.rolling : list.slice(-30).map(s.val);
  return `<div class="card detail"><div class="card-head"><h2>${t(s.label)}</h2><button class="ghost" data-skill="${s.key}">${t('Schließen')}</button></div>` +
    `<p>${esc(t(s.how))}</p>${extremes}` +
    spark(per, s, s.set ? 5 : Math.max(1, list.length - per.length + 1)) +
    `<p class="hint">${s.set ? t('Je Fünf-Spiele-Abschnitt, gestrichelt dein Schnitt.') : t('Je Spiel (letzte {n}), gestrichelt dein Schnitt.', { n: per.length })}</p></div>`;
}

// Siege gegen Niederlagen: welche Werte sich in deinen Siegen am stärksten von deinen Niederlagen unterscheiden
function winLossCard(games, map) {
  const W = games.filter((g) => g.win), L = games.filter((g) => !g.win);
  if (W.length < 3 || L.length < 3) return `<div class="card"><p class="hint">${t('Für den Vergleich braucht es mindestens 3 Siege und 3 Niederlagen ({w} / {l}).', { w: W.length, l: L.length })}</p></div>`;
  const extra = [
    { label: 'Gold', unit: 'Gold/min', digits: 0, needs: 'gold', val: (g) => g.gold / gmins(g) },
    { label: 'Erlittener Schaden', unit: 'Schaden/min', digits: 0, needs: 'taken', lower: true, val: (g) => g.taken / gmins(g) },
  ];
  const rows = [...SKILLS.filter((s) => !s.set && (!s.maps || s.maps.includes(map))), ...extra].map((s) => {
    const has = (g) => !s.needs || g[s.needs] != null;
    const w = W.filter(has), l = L.filter(has);
    if (w.length < 3 || l.length < 3) return null;
    const mw = mean(w.map(s.val)), ml = mean(l.map(s.val));
    return { s, mw, ml, rel: ml ? (mw - ml) / ml : 0 };
  }).filter(Boolean).sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel)).slice(0, 5);
  if (!rows.length) return '';
  const top = rows[0];
  const pct = (r) => `${Math.round(Math.abs(r.rel) * 100)} %`;
  return `<div class="card winloss"><p class="deaths-head">${t('Größter Unterschied: {label} – in Siegen {w}, in Niederlagen {l} {unit} ({p} {dir}).', {
    label: t(top.s.label), w: dec(top.mw, top.s.digits), l: dec(top.ml, top.s.digits), unit: t(top.s.unit), p: pct(top), dir: top.rel > 0 ? t('mehr') : t('weniger') })}</p>` +
    `<table class="pool"><thead><tr><th></th><th>${t('in Siegen')}</th><th>${t('in Niederlagen')}</th><th>${t('Unterschied')}</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${t(r.s.label)} <small class="muted">${t(r.s.unit)}</small></td><td>${dec(r.mw, r.s.digits)}</td><td>${dec(r.ml, r.s.digits)}</td>` +
      `<td>${r.rel > 0 ? '+' : '−'}${pct(r)}</td></tr>`).join('') +
    `</tbody></table><p class="hint">${t('Aus {w} Siegen und {l} Niederlagen. Zeigt Zusammenhänge, nicht unbedingt Ursachen: in Siegen hat oft das ganze Team mehr Gold.', { w: W.length, l: L.length })}</p></div>`;
}

// Gegen wen du verlierst: Siegquote gegen gegnerische Champions (aus den Spieldetails, ab 3 Spielen gegen ihn)
function enemyCard(games) {
  const by = new Map();
  let withData = 0;
  for (const g of games) {
    const tl = progTimelines[g.id];
    if (!tl || !tl.enemies) continue;
    withData++;
    for (const key of tl.enemies) {
      const c = by.get(key) || { key, n: 0, w: 0 };
      c.n++;
      if (g.win) c.w++;
      by.set(key, c);
    }
  }
  const list = [...by.values()].filter((c) => c.n >= 3);
  if (list.length < 2) return `<div class="card"><p class="hint">${t('Noch zu wenige Spiele gegen dieselben Champions (ab 3 Spielen je Champion, {n} Spiele mit Gegnerdaten).', { n: withData })}</p></div>`;
  const wr = (c) => c.w / c.n;
  const hard = [...list].sort((a, b) => wr(a) - wr(b) || b.n - a.n).slice(0, 5);
  const easy = [...list].filter((c) => wr(c) >= 0.5).sort((a, b) => wr(b) - wr(a) || b.n - a.n).slice(0, 3);
  const row = (c) => {
    const ch = champOf(c.key);
    return `<div class="erow"><span class="champ">${champImg(ch)}${esc(ch ? ch.name : String(c.key))}</span>` +
      `<b class="${wr(c) >= 0.5 ? 'win' : 'loss'}">${Math.round(wr(c) * 100)} %</b><small>${c.w}/${c.n}</small></div>`;
  };
  return `<div class="card enemies"><div class="ecols"><div><h2>${t('Schwer für dich')}</h2>${hard.map(row).join('')}</div>` +
    `<div><h2>${t('Liegt dir')}</h2>${easy.length ? easy.map(row).join('') : `<p class="hint">${t('Noch kein Champion mit Siegquote ab 50 %.')}</p>`}</div></div>` +
    `<p class="hint">${t('Deine Siegquote in Spielen, in denen dieser Champion im Gegnerteam war (ab 3 Spielen, aus {n} Spielen).', { n: withData })}</p></div>`;
}

// Nach Niederlagen: Siegquote im nächsten Spiel derselben Session (höchstens 2 Stunden Pause dazwischen)
function tiltCard(games) {
  const list = [...games].sort((a, b) => a.at - b.at);
  const buckets = { afterWin: [], afterLoss: [], afterTwo: [] };
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1], g = list[i];
    if (g.at - (prev.at + prev.dur * 1000) > 2 * 3600e3) continue;
    if (prev.win) buckets.afterWin.push(g);
    else {
      buckets.afterLoss.push(g);
      const prev2 = list[i - 2];
      if (prev2 && !prev2.win && prev.at - (prev2.at + prev2.dur * 1000) <= 2 * 3600e3) buckets.afterTwo.push(g);
    }
  }
  const rows = [['Nach einem Sieg', buckets.afterWin], ['Nach einer Niederlage', buckets.afterLoss], ['Nach 2 Niederlagen am Stück', buckets.afterTwo]];
  const total = rows.reduce((a, [, l]) => a + l.length, 0);
  if (total < 5) return `<div class="card"><p class="hint">${t('Noch zu wenige Spiele direkt hintereinander ({n}).', { n: total })}</p></div>`;
  const w = (l) => (l.length >= 3 ? Math.round((l.filter((g) => g.win).length / l.length) * 100) : null);
  const two = w(buckets.afterTwo), win = w(buckets.afterWin);
  const verdict = two != null && win != null && two + 15 <= win
    ? `<p class="deaths-head loss">${t('Nach 2 Niederlagen am Stück gewinnst du nur {two} % (nach einem Sieg {win} %). Eine Pause lohnt sich.', { two, win })}</p>` : '';
  return `<div class="card tilt">${verdict}` + rows.map(([label, l]) => {
    const v = w(l);
    if (v == null) return `<div class="wrow"><span>${t(label)}</span><span class="hint">${t('zu wenig')}</span><small>${l.length === 1 ? t('1 Spiel') : t('{n} Spiele', { n: l.length })}</small></div>`;
    return `<div class="wrow"><span>${t(label)}</span><svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
      `<rect width="${v}" height="8" rx="2" class="wfill"></rect><line x1="50" x2="50" y1="0" y2="8" class="wmid" vector-effect="non-scaling-stroke"></line></svg>` +
      `<small><b class="${v >= 50 ? 'win' : 'loss'}">${v} %</b> · ${l.length}</small></div>`;
  }).join('') + `<p class="hint">${t('Siegquote im nächsten Spiel derselben Session (höchstens 2 Stunden Pause).')}</p></div>`;
}

// Vielseitigkeit: auf wie vielen deiner Champions (ab 3 Spielen) du mindestens auf deinem Niveau spielst
function versatility(games) {
  const by = new Map();
  for (const g of games) by.set(g.champ, [...(by.get(g.champ) || []), g]);
  const kda = (l) => l.reduce((a, g) => a + g.k + g.a, 0) / Math.max(l.reduce((a, g) => a + g.d, 0), 1);
  const all = kda(games);
  const champs = [...by.values()].filter((l) => l.length >= 3);
  if (champs.length < 2) return '';
  const good = champs.filter((l) => kda(l) >= all * 0.9 && l.filter((g) => g.win).length / l.length >= 0.5).length;
  return `<p class="deaths-head">${t('Vielseitigkeit: auf {good} von {n} Champions (ab 3 Spielen) spielst du auf deinem Niveau (KDA und Siegquote).', { good, n: champs.length })}</p>`;
}

// Champion-Profil: Klick auf einen Champion im Pool zeigt seine Werte gegen deinen Schnitt in dieser Auswahl
// Arena: wie oft du welchen Platz holst (Balken je Platz), Ø Platz und Anteil der Top-Hälfte
function arenaPlaceCard(games) {
  const list = games.filter((g) => g.place);
  if (!list.length) return `<div class="card"><p class="hint">${t('Platzierungen merkt Farmy seit dem 29.10.; ältere Spiele werden ergänzt, soweit der Client sie noch kennt.')}</p></div>`;
  const max = Math.max(...list.map((g) => g.place), 4);
  const top = list.filter((g) => g.place <= max / 2).length;
  const bar = (n) => {
    const w = Math.round((n / list.length) * 100);
    return `<svg class="wtrack" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="2" class="wbg"></rect>` +
      `<rect width="${w}" height="8" rx="2" class="wfill"></rect></svg><small>${n} · ${w} %</small>`;
  };
  return `<div class="card wins"><h2>${t('Ø Platz {p} · {w} % obere Hälfte', { p: dec(mean(list.map((g) => g.place)), 1), w: Math.round((top / list.length) * 100) })}</h2>` +
    Array.from({ length: max }, (_, i) => `<div class="wrow"><span>${t('Platz {n}', { n: i + 1 })}</span>${bar(list.filter((g) => g.place === i + 1).length)}</div>`).join('') + '</div>';
}

// Arena: deine Augments nach Häufigkeit mit Ø Platz, wenn du sie hattest (ab 2 Spielen)
function arenaAugCard(games) {
  const by = new Map();
  for (const g of games.filter((x) => x.place && x.aug)) {
    for (const id of g.aug) {
      const e = by.get(id) || { id, places: [] };
      e.places.push(g.place);
      by.set(id, e);
    }
  }
  const rows = [...by.values()].filter((e) => e.places.length >= 2).sort((a, b) => b.places.length - a.places.length || mean(a.places) - mean(b.places)).slice(0, 12);
  if (!rows.length) return `<div class="card"><p class="hint">${t('Noch kein Augment in mindestens 2 Spielen.')}</p></div>`;
  const all = mean(games.filter((g) => g.place).map((g) => g.place));
  return `<div class="card"><table class="pool"><thead><tr><th>Augment</th><th>${t('Spiele')}</th><th>${t('Ø Platz')}</th></tr></thead><tbody>` +
    rows.map((e) => {
      const p = mean(e.places);
      return `<tr><td>${esc(progAugNames[e.id] || `#${e.id}`)}</td><td>${e.places.length}</td><td class="${p <= all ? 'win' : 'loss'}">${dec(p, 1)}</td></tr>`;
    }).join('') + `</tbody></table><p class="hint">${t('Grün: besser als dein Schnitt ({p}).', { p: dec(all, 1) })}</p></div>`;
}

function champProfile(games, map) {
  if (progChamp == null) return '';
  const mine = games.filter((g) => String(g.champ) === String(progChamp));
  if (mine.length < 3) return '';
  const c = mine[0].c;
  const rows = SKILLS.filter((s) => !s.set && (!s.maps || s.maps.includes(map))).map((s) => {
    const has = (g) => !s.needs || g[s.needs] != null;
    const a = mine.filter(has), b = games.filter(has);
    if (a.length < 3) return null;
    const va = mean(a.map(s.val)), vb = mean(b.map(s.val));
    const rel = vb ? ((va - vb) / vb) * (s.lower ? -1 : 1) : 0;
    return `<tr><td>${t(s.label)}</td><td>${dec(va, s.digits)}</td><td>${dec(vb, s.digits)}</td>` +
      `<td class="${Math.abs(rel) < 0.03 ? '' : rel > 0 ? 'win' : 'loss'}">${Math.abs(rel) < 0.03 ? t('wie immer') : rel > 0 ? t('{n} % besser', { n: Math.round(rel * 100) }) : t('{n} % schlechter', { n: Math.round(-rel * 100) })}</td></tr>`;
  }).filter(Boolean);
  return `<div class="card cprofile"><div class="card-head"><h2>${champImg(c)} ${esc(c ? c.name : '?')}</h2><button class="ghost" data-prof="">${t('Schließen')}</button></div>` +
    `<table class="pool"><thead><tr><th></th><th>${esc(c ? c.name : '')} (${mine.length})</th><th>${t('dein Schnitt')}</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

// Rekorde: dein bestes Spiel je Wert in dieser Auswahl (Tode erst ab 15 Minuten Spieldauer), längste Siegesserie
function recordsCard(games, map) {
  const tiles = SKILLS.filter((s) => !s.set && (!s.maps || s.maps.includes(map))).map((s) => {
    const list = games.filter((g) => (!s.needs || g[s.needs] != null) && (s.key !== 'survive' || g.dur >= 900));
    if (!list.length) return '';
    const g = list.reduce((a, x) => (better(s, s.val(x), s.val(a)) ? x : a));
    return `<div class="rec"><label>${t(s.label)}</label><b>${dec(s.val(g), s.digits)}</b> <small>${t(s.unit)}</small>` +
      `<span class="champ">${champImg(g.c)}${esc(g.c ? g.c.name : '?')}</span>` +
      `<small><span class="${g.win ? 'win' : 'loss'}">${g.win ? t('Sieg') : t('Niederlage')}</span> · ${new Date(g.at).toLocaleDateString(i18n.locale())}</small></div>`;
  });
  let best = 0, run = 0;
  for (const g of [...games].sort((a, b) => a.at - b.at)) {
    run = g.win ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return `<div class="card"><div class="recs grid">${tiles.join('')}` +
    `<div class="rec"><label>${t('Längste Siegesserie')}</label><b>${best}</b> <small>${t('Siege am Stück')}</small></div></div></div>`;
}

// Ziel-Verlauf: frühere Session-Ziele mit Zeitraum und Quote
function goalHistoryHtml() {
  const list = [...progGoalHistory].reverse().slice(0, 6);
  if (!list.length) return '';
  const f = (g) => (g.key === 'deaths' ? String(g.target) : dec(g.target, g.key === 'vision' ? 2 : 1));
  const day = (ms) => new Date(ms).toLocaleDateString(i18n.locale());
  return `<div class="ghist"><h3>${t('Frühere Ziele')}</h3>` + list.map((g) => {
    const ok = g.results.filter((r) => r.ok).length;
    return `<div class="rv-row"><span class="rv-label">${day(g.since)} – ${day(g.until)}</span><span>${esc(t(GOAL_TEXT[g.key], { n: f(g) }))}` +
      `${g.map ? ` · ${t(PMODES[g.map] || '')}` : ''}: <b class="${ok * 2 >= g.results.length ? 'win' : 'loss'}">${t('{ok} von {n} geschafft', { ok, n: g.results.length })}</b></span></div>`;
  }).join('') + '</div>';
}
