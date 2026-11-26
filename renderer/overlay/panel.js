// Das Panel im Spiel: jede Sekunde ein neuer Spielstand vom Hauptprozess (src/main/game.js)

// Icons für die Warn-Pillen (Richtung B: Icon links neben dem Text)
const ICON_SKILL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
const ICON_RECALL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
const ICON_BUY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';

// Kompakt-Modus: Cooldowns als Ringe. Riot liefert nur die Restzeit, daher gilt die längste Restzeit seit
// Beginn des Cooldowns als volle Länge
const RING = 100.5; // Umfang bei r = 16
const ICON_CHECK = '<svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
const cdMax = {};
function cdShare(s) {
  if (s.ready) {
    delete cdMax[s.key];
    return 0;
  }
  if (s.cd == null) return 1;
  cdMax[s.key] = Math.max(cdMax[s.key] || 0, s.cd);
  return cdMax[s.key] ? s.cd / cdMax[s.key] : 0;
}
function ringHtml(s) {
  const share = cdShare(s);
  const arc = s.ready ? '' : `<circle class="arc" cx="19" cy="19" r="16" stroke-dasharray="${(share * RING).toFixed(1)} ${RING}"/>`;
  const inner = s.ready ? ICON_CHECK : `<span>${s.cd == null ? '…' : fmtTime(s.cd)}</span>`;
  return `<div class="ring ${s.ready ? 'ready' : ''}"><div class="dial">` +
    `<svg class="bg" viewBox="0 0 38 38" aria-hidden="true"><circle class="trk" cx="19" cy="19" r="16"/>${arc}</svg>${inner}</div>` +
    `<label>${s.key}</label></div>`;
}
function tileHtml(s) {
  const value = s.ready ? t('bereit') : s.cd == null ? '…' : fmtTime(s.cd);
  const b = `<b class="${s.ready ? 'good' : ''}">${value}</b>`;
  // Icon und Taste, keine Namen (passen nicht in die Kachel); ohne Bild nur die Taste
  const img = s.icon ? `<img src="${esc(s.icon)}" alt="">` : '';
  return `<div class="spell item ${s.ready ? '' : 'cd'}">${img}<div><label>${s.key}</label>${b}</div></div>`;
}
const footHtml = (label, n, fmt) => `<span>${esc(label)} <b class="${cls(n)}">${fmt(n)}</b></span>`;

window.lol.onGame((g) => {
  lastGame = g;
  if (sbState.open) renderScoreboard();
  renderAugments(g.augments);
  renderGame(g);
});

function renderGame(g) {
  renderJungleRoute(g.jungleRoute);
  const small = isCompact();
  setText($('champ'), g.champion);
  setText($('lvl'), g.level);
  setText($('time'), fmtTime(g.gameTime));
  setText($('kda'), g.kda);
  setText($('kdaRatio'), g.kdaRatio);
  // ohne OCR liefert Riot CS nur in 10er-Schritten
  setText($('cs'), g.csExact ? g.cs : `${g.cs}+`);
  // CS-Ziel: Schnitt gegen Ziel pro Minute (eigener Schnitt auf dem Champ oder Vorgabe)
  // (kompakt ist die Kachel zu schmal für „Ziel“: dort nur „6,1 / 7,4“)
  const ct = g.csTarget;
  const pm = num(Number(g.csPerMin), 1);
  // Dev „Perfekt-CS“: noch eine Zeile „max 107 · 84 %“ (nur im normalen Panel)
  const max = g.csMax != null && !small ? `\nmax ${g.csMax} · ${g.csMax ? Math.round((g.cs / g.csMax) * 100) : 0} %` : '';
  setText($('csm'), (!ct ? `${pm}/min` : small ? `${pm} / ${num(ct.perMin, 1)}` : `${pm}/min\n${t('Ziel')} ${num(ct.perMin, 1)}`) + max);
  $('csm').className = ct || max ? 'target' + (ct && g.gameTime > 300 ? (Number(g.csPerMin) >= ct.perMin ? ' good' : ' bad') : '') : '';

  // Spar-Ziel aus dem Build; RECALL, sobald das Gold reicht. Im ARAM gibt es kein Recall:
  // dort KAUFEN, solange du tot bist (nur dann kommst du an den Shop)
  const b = g.build && !g.build.done ? g.build : null;
  $('build').hidden = !b;
  $('recall').hidden = !(b && b.affordable && (!g.aram || g.isDead));
  if (b) {
    $('build').classList.toggle('ready', b.affordable);
    setText($('buildLabel'), b.name);
    setText($('buildMissing'), b.affordable ? t('bezahlbar') : small ? `−${num(b.missing)} g` : t('noch {gold} g', { gold: num(b.missing) }));
    $('buildFill').style.width = `${b.progress}%`;
    setHtml($('recall'), (g.aram ? ICON_BUY : ICON_RECALL) + (g.aram ? t('KAUFEN') : t('RECALL')));
  }

  // Skillpunkt offen: welche Fähigkeit laut Lolalytics dran ist, dahinter die Max-Reihenfolge
  const sk = g.skill && g.skill.next ? g.skill : null;
  $('skill').hidden = !sk;
  if (sk) {
    setHtml($('skill'), `${ICON_SKILL}SKILL <b>${esc(sk.next)}</b>${sk.open > 1 ? ` <small>+${sk.open - 1}</small>` : ''}` +
      (sk.priority ? ` <small class="prio">${esc(sk.priority.join(' › '))}</small>` : ''));
  }

  const m = g.mana;
  $('mana').hidden = !m;
  $('noMana').hidden = !(m && m.low);
  if (m) {
    $('mana').classList.toggle('low', m.low);
    setText($('manaVal'), m.combo ? `${m.value} / ${m.max} · Combo ${m.combo}` : `${m.value} / ${m.max}`);
    $('manaFill').style.width = `${m.percent}%`;
    $('manaCombo').hidden = !m.combo;
    if (m.combo) $('manaCombo').style.left = `${Math.min(100, (m.combo / m.max) * 100)}%`;
  }

  // Summoner D/F, danach Item-Cooldowns (Taste 1–7 wie im Spiel)
  // Ward (Trinket, Taste 4) dahinter, nur auf Summoner's Rift
  const spellsNew = setHtml($('spells'), [...(moduleOn('spells') ? g.spells || [] : []), ...(moduleOn('items') ? g.itemCds || [] : []),
    ...(g.ward ? [g.ward] : [])]
    .map(small ? ringHtml : tileHtml)
    .join(''));
  // Bild fehlt bei Data Dragon (z. B. Sonder-Summoner)? Dann nur die Taste
  if (spellsNew) $('spells').querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.remove()));

  const xp = g.xp;
  $('xp').hidden = !xp;
  if (xp) {
    setText($('xpLabel'), small ? `Lvl ${g.level + 1} ·` : `Lvl ${g.level} → ${g.level + 1}`);
    setText($('xpPct'), `${xp.percent} %`);
    $('xpFill').style.width = `${xp.percent}%`;
    // Vasallen-XP gelten nur auf Summoner's Rift; im ARAM nur den Prozentwert zeigen
    $('xpMinions').hidden = !!g.aram;
    setText($('xpMinions'), small
      ? `${xp.melee} Melee / ${xp.caster} Caster`
      : t('noch {xp} XP ≈ {melee} Melee / {caster} Caster · {waves} Wellen', { ...xp, xp: xp.missing, waves: num(Number(xp.waves), 1) }));

  }
  setText($('gold'), num(g.gold));
  setText($('ward'), g.wardScore);

  // Kompakt: Lane-Gegner, CS-Diff und Team in einer Fußzeile
  const o = g.laneOpponent;
  const foot = [];
  if (small && o && moduleOn('lane')) {
    foot.push(footHtml(o.champion, g.myItemValue - o.itemValue, compact), footHtml('CS', g.cs - o.cs, signed));
  }
  if (small && moduleOn('team')) foot.push(footHtml('Team', g.teamItemDiff, compact));
  setHtml($('foot'), foot.join(''));

  if (o && !small) {
    const diff = g.myItemValue - o.itemValue;
    setHtml($('lane'),
      `<div class="row"><label>vs ${esc(o.champion)}${o.isDead ? ` (${t('tot')})` : ''}</label>` +
      `<b class="${cls(diff)}">${signed(diff)} g</b></div>` +
      `<div class="row"><label>${t('CS-Diff')}</label><b class="${cls(g.cs - o.cs)}">${signed(g.cs - o.cs)}</b></div>`);
  } else {
    setHtml($('lane'), '');
  }

  // Erste Runde im Jungle: gemessene Zeit (eine Weile nach dem Ende), bestes bisheriges zum Vergleich
  $('clear').hidden = !g.clear;
  if (g.clear) setText($('clearVal'), `${fmtTime(g.clear.time)} · ${g.clear.cs} CS` + (g.clear.best != null ? ` · ${t('Bestzeit')} ${fmtTime(g.clear.best)}` : ''));

  // Gank-Priorität (nur Jungler): Lane-Stand je Lane wie im Tab-Scoreboard, ohne Empfehlung
  $('gank').hidden = !g.lanes;
  if (g.lanes) {
    setHtml($('gank'), `<label>${t('Lane-Stand')}</label>` + g.lanes.map((l) =>
      `<span><i>${l.lane}</i><b class="${cls(l.gold)}">${signed(l.gold)} g</b><small>${l.kills[0]}:${l.kills[1]}${l.level ? ` · Lvl ${l.level > 0 ? '+' : ''}${num(l.level, 1)}` : ''}</small></span>`).join(''));
  }

  // wogegen eine Option hilft (Grund aus threat.js)
  const WHY = { mr: 'gegen Magie', armor: 'gegen körperlich', cc: 'gegen CC', heal: 'gegen Heilung' };
  // Gegner-Team: Schadensart, viel CC, Heilung und Item-Optionen dagegen (nur Optionen, Farmy kauft nichts)
  $('threat').hidden = !g.threat;
  if (g.threat) {
    const T = g.threat;
    const kind = T.magic >= 60 ? t('{n} % magisch', { n: T.magic }) : T.magic <= 40 ? t('{n} % körperlich', { n: 100 - T.magic })
      : t('gemischt ({n} % magisch)', { n: T.magic });
    const extra = [T.cc && t('viel CC'), T.heal.length && t('Heilung: {names}', { names: T.heal.join(', ') })].filter(Boolean);
    setHtml($('threat'), `<div class="row"><label>${t('Gegner')}</label><b>${esc(kind)}</b></div>` +
      (extra.length ? `<small>${esc(extra.join(' · '))}</small>` : '') +
      (T.options.length ? `<div class="opts">${T.options.map((o) => `<span title="${esc(o.name)}"><img src="${esc(o.icon)}" alt="">${esc(o.name)}<i>${esc(t(WHY[o.why]))}</i></span>`).join('')}</div>` : ''));
  }

  // Hinweise aus deinen eigenen Spielen (src/game/tips.js): Serie am selben Gegner, Kontrollwarde, Jungler-Phase
  const tips = g.tips || [];
  $('tips').hidden = !tips.length;
  setHtml($('tips'), tips.map((x) => `<div class="tip ${esc(x.kind)}">${esc(x.text)}</div>`).join(''));

  // Session-Ziel (im Hauptfenster unter „Fortschritt“ gesetzt): Stand gegen das Ziel, „✓“/„✗“ steht im Text
  $('goal').hidden = !g.goal;
  if (g.goal) {
    const G = g.goal;
    const fmt = (v) => (G.key === 'deaths' ? String(v) : num(v, G.key === 'vision' ? 2 : 1));
    setText($('goalLabel'), t({ deaths: 'Ziel: höchstens {n} Tode', csm: 'Ziel: {n} CS/min', kda: 'Ziel: KDA {n}',
      vision: 'Ziel: {n} Sicht/min' }[G.key], { n: fmt(G.target) }));
    setText($('goalVal'), `${fmt(G.now)} ${G.early ? '' : G.ok ? '✓' : '✗'}`.trim());
    $('goalVal').className = G.early ? 'early' : G.ok ? '' : 'bad';
  }

  // Rollen-Quest (Ring-Fortschritt vom HUD, nur Summoner's Rift): schmale Zeile unter dem Namen
  $('quest').hidden = g.quest == null;
  if (g.quest != null) {
    setText($('questPct'), g.quest >= 0.99 ? t('fertig') : `${Math.round(g.quest * 100)} %`);
    $('questFill').style.width = `${Math.round(g.quest * 100)}%`;
  }
  $('quest').classList.toggle('done', g.quest != null && g.quest >= 0.99);

  const team = $('teamDiff');
  setText(team, `${signed(g.teamItemDiff)} g`);
  team.className = cls(g.teamItemDiff);
}
