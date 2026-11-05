// --- Live-Spiel: alle 10 Spieler, aktualisiert alle 2 s solange der Tab offen ist ---
const TIERS = { IRON: 'Eisen', BRONZE: 'Bronze', SILVER: 'Silber', GOLD: 'Gold', PLATINUM: 'Platin', EMERALD: 'Smaragd',
  DIAMOND: 'Diamant', MASTER: 'Meister', GRANDMASTER: 'Großmeister', CHALLENGER: 'Challenger' };

function rankHtml(p) {
  if (p.isBot) return '<span class="sub">Bot</span>';
  const r = p.rank;
  if (!r) return '<span class="sub">…</span>';
  if (r.unranked) return `<span class="sub">${t('ungewertet')}</span>`;
  const games = r.wins + r.losses;
  const wr = games ? Math.round((r.wins / games) * 100) : 0;
  const tier = TIERS[r.tier] ? t(TIERS[r.tier]) : r.tier;
  const div = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier) ? '' : ` ${r.division}`;
  // bei anderen Spielern meldet der Client immer 0 Niederlagen: dann nur die Siege, keine falschen 100 %
  const sub = r.losses === 0 && r.wins > 0 ? t('{n} Siege', { n: r.wins })
    : `<span class="${wr >= 50 ? 'wr-good' : 'wr-bad'}">${wr}%</span> ${t('aus {n} Spielen', { n: games })}`;
  return `<span class="rank"><span class="tier">${esc(tier)}${div}</span> · ${r.lp} LP<span class="sub">${sub}</span></span>`;
}

// Hinweise unter dem Namen (src/scout.js): Premade-Gruppe (gleiche Farbe = zusammen in der Gruppe), Serie, OTP,
// neu auf dem Champ, Smurf-Verdacht. names: Champion-ID -> Name, für „Premade mit …“
function liveTags(p, names) {
  const s = p.scout;
  if (!s) return '';
  const chips = [];
  if (s.group) {
    const title = t('Premade mit {who}', { who: s.with.map((w) => t('{champ} ({n} gemeinsame Spiele)', { champ: names.get(w.id) || w.id, n: w.n })).join(', ') });
    chips.push(`<span class="ptag premade g${(s.group - 1) % 4}" title="${esc(title)}">${s.with.length > 1 ? t('Gruppe') : 'Duo'}</span>`);
  }
  for (const tag of s.tags) chips.push(`<span class="ptag ${tag.kind}"${tag.title ? ` title="${esc(tag.title)}"` : ''}>${esc(tag.text)}</span>`);
  return chips.length ? `<span class="ptags">${chips.join('')}</span>` : '';
}

async function renderLive() {
  const el = $('liveList');
  const d = await window.lol.liveData();
  if (!d) {
    el.innerHTML = `<div class="msg">${t('Gerade läuft kein Spiel. Sobald du im Spiel bist, stehen hier alle 10 Spieler mit Rang, Items und Werten.')}</div>`;
    return false;
  }
  const mins = Math.floor(d.gameTime / 60), secs = String(Math.floor(d.gameTime % 60)).padStart(2, '0');
  const mine = d.teams.find((t) => t.id === d.myTeam), theirs = d.teams.find((t) => t.id !== d.myTeam);
  const diff = mine.value - theirs.value;
  let html = `<div class="live-head"><span>${esc(d.gameMode)} · <b>${mins}:${secs}</b></span>` +
    `<span>${t('Team-Itemwert')} <b class="${diff >= 0 ? 'win' : 'loss'}">${diff >= 0 ? '+' : ''}${n(diff)} g</b></span></div>`;
  const names = new Map(d.teams.flatMap((x) => x.players).map((p) => [p.championId, p.champion]));
  for (const team of [mine, theirs]) {
    html += `<div class="team-card"><h2 class="${team === mine ? 'mine' : 'enemy'}">${team === mine ? t('Dein Team') : t('Gegner')}<span>${t('Itemwert {gold} g', { gold: n(team.value) })}</span></h2>
      <table><tr><th>${t('Spieler')}</th><th>${t('Rang')}</th><th>Lvl</th><th>KDA</th><th>CS</th><th>Vision</th><th>${t('Itemwert')}</th><th>Items</th></tr>`;
    for (const p of team.players) {
      const champ = { id: p.championId, name: p.champion };
      const name = p.champion || (d.gameMode === 'PRACTICETOOL' ? t('Übungspuppe') : 'Bot');
      html += `<tr class="${p.isMe ? 'me' : ''} ${p.isDead ? 'dead' : ''}">
        <td><span class="champ">${champImg(champ)}<span>${esc(name)}<span class="sub">${p.isBot ? '' : p.riotId ? `<button class="link" data-player="${esc(p.riotId)}" title="${esc(t('Spieler ansehen'))}">${esc(p.name)}</button>` : esc(p.name)}${p.isDead ? `${p.isBot ? '' : ' · '}${t('tot {s}s', { s: p.respawn })}` : ''}</span>${liveTags(p, names)}</span></span></td>
        <td>${rankHtml(p)}</td><td>${p.level}</td><td>${p.kda}</td><td>${p.cs}</td><td>${p.vision}</td>
        <td>${n(p.itemValue)}</td><td>${itemsHtml(p.items)}</td></tr>`;
    }
    html += '</table></div>';
  }
  el.innerHTML = html;
  return true;
}
// minimiert oder verdeckt (document.hidden) nicht neu zeichnen: die Abfrage holt sonst alle 2 s Daten für niemanden
setInterval(() => { if (!$('live').hidden && !document.hidden && !window.__docs) renderLive(); }, 2000);

$('calibBtn').addEventListener('click', async () => {
  const out = $('calibOut');
  out.innerHTML = `<span class="hint">${t('Prüfe…')}</span>`;
  try {
    const c = await window.lol.calibCheck();
    out.innerHTML = c.items.map((it) =>
      `<div class="calib-item"><label>${esc(it.label)}</label><img src="${it.img}" alt="${esc(t('Bereich {name}', { name: it.label }))}"><b>${esc(it.value)}</b></div>`).join('') +
      `<div class="calib-meta">${t('Bildschirm {screen} · HUD-Skalierung {hud} · Faktoren Auflösung {res}, untere Leiste {bar}', {
        screen: esc(c.screen), hud: c.hudScale == null ? t('unbekannt') : Math.round(c.hudScale * 100), res: c.factors.res, bar: c.factors.hud })}</div>`;
  } catch (e) {
    out.innerHTML = `<span class="hint">${esc(errText(e))}</span>`;
  }
});
