// --- Spieler: Suche nach Riot-ID über den Client (nur eigene Region, kein Riot-API-Key nötig) ---
// Zuletzt gesuchte Spieler: nur eine Bequemlichkeit, daher im Fenster-Speicher statt in config.json
const RECENT_KEY = 'farmy.playerSearches';
const recentSearches = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};
function rememberSearch(id) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentSearches().filter((x) => x.toLowerCase() !== id.toLowerCase())].slice(0, 8)));
  } catch {
    // Speicher gesperrt: dann eben ohne Liste
  }
}
function drawRecent() {
  const list = recentSearches();
  $('playerRecent').innerHTML = list.length
    ? `<span class="hint">${t('Zuletzt gesucht')}</span>` + list.map((id) => `<button class="chip" data-player="${esc(id)}">${esc(id)}</button>`).join('')
    : '';
}

const SHOWN_GAMES = 20; // mehr Spiele (aus dem Archiv) erst auf Klick
let playerReq = 0; // neue Suche, während die alte noch lädt: die alte nicht mehr anzeigen
let lastPlayer = null;
// riotId „Name#Tag“ aus dem Suchfeld; puuid, wenn der Spieler aus einem Spiel angeklickt wurde
async function searchPlayer(riotId, puuid) {
  riotId = String(riotId || '').trim();
  if (!riotId && !puuid) return;
  $('playerInput').value = riotId;
  const out = $('playerOut');
  const req = ++playerReq;
  out.innerHTML = `<div class="msg">${t('Suche…')}</div>`;
  let p;
  try {
    p = puuid ? await window.lol.playerByPuuid(puuid) : await window.lol.findPlayer(riotId);
  } catch (e) {
    if (req === playerReq) out.innerHTML = `<div class="msg">${esc(errText(e))}</div>`;
    return;
  }
  if (req !== playerReq) return;
  if (!p) {
    out.innerHTML = `<div class="msg">${t('Kein Spieler „{id}“ gefunden. Der Client findet nur Spieler deiner Region.', { id: esc(riotId) })}</div>`;
    return;
  }
  lastPlayer = `${p.gameName}#${p.tagLine}`;
  $('playerInput').value = lastPlayer;
  rememberSearch(lastPlayer);
  drawRecent();
  const games = p.games.filter((g) => g.gameMode !== 'PRACTICETOOL');
  for (const g of games) g.champ = await window.lol.champion(g.participants[0].championId);
  const mastery = await Promise.all(p.mastery.map(async (m) => ({ ...m, champ: await window.lol.champion(m.championId) })));
  if (req !== playerReq) return;
  const rank = (r) => rankHtml({ rank: r || { unranked: true } });
  out.innerHTML = `<div class="card player-head">
      <img class="player-icon" src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${p.icon}.png" alt="">
      <div class="player-name"><h2>${esc(p.gameName)}<span class="tag">#${esc(p.tagLine)}</span></h2><span class="hint">${t('Level {n}', { n: p.level })}${p.fromArchive ? ` · ${t('{n} ältere Spiele aus Farmys Archiv', { n: p.fromArchive })}` : ''}</span></div>
      <div class="player-ranks"><div><label>Solo/Duo</label>${rank(p.solo)}</div><div><label>Flex</label>${rank(p.flex)}</div></div>
    </div>` +
    (mastery.length ? `<div class="card"><h2>${t('Meistgespielte Champions')}</h2><div class="mastery">${mastery.map((m) =>
      `<div class="champ">${champImg(m.champ)}<div>${esc(m.champ.name)}<small>${t('Stufe {n}', { n: m.level })} · ${n(m.points)} ${t('Punkte')}</small></div></div>`).join('')}</div></div>` : '') +
    (games.length >= 3 ? `<div class="card" id="playerSkill"><h2>${t('Skill-Einschätzung')}</h2><span class="hint">${t('Lädt…')}</span></div>` : '') +
    (games.length ? summaryHtml(games, t('Letzte {n}', { n: games.length })) + games.slice(0, SHOWN_GAMES).map(gameRowHtml).join('') +
      (games.length > SHOWN_GAMES ? `<button id="playerMore" class="more">${t('Alle {n} Spiele zeigen', { n: games.length })}</button>` : '')
      : `<div class="msg">${t('Keine Spiele gefunden.')}</div>`);
  const more = $('playerMore');
  if (more) more.addEventListener('click', () => more.outerHTML = games.slice(SHOWN_GAMES).map(gameRowHtml).join(''));
  loadSkill(p, games, req);
}
// Skill-Einschätzung im Profil (src/lobbyskill.js): je Wert, wie viel Prozent der anderen Spieler in seinen Spielen er
// im Schnitt übertrifft. 50 = Lobby-Schnitt (gestrichelt), lädt nach dem Profil, weil es alle Spieldetails braucht
async function loadSkill(p, games, req) {
  const box = $('playerSkill');
  const ids = games.filter((g) => g.gameType === 'MATCHED_GAME').map((g) => g.gameId);
  if (!box || ids.length < 3) return box && box.remove();
  let r;
  try {
    r = await window.lol.playerSkill(p.puuid, ids);
  } catch (e) {
    if (req === playerReq) box.innerHTML = `<h2>${t('Skill-Einschätzung')}</h2><p class="hint">${esc(errText(e))}</p>`;
    return;
  }
  if (req !== playerReq) return;
  const rows = SKILLS.filter((s) => r.metrics[s.key]).map((s) => ({ s, now: r.metrics[s.key].score, before: 50, value: r.metrics[s.key].value }));
  if (rows.length < 3) {
    box.innerHTML = `<h2>${t('Skill-Einschätzung')}</h2><p class="hint">${t('Zu wenige Spiele ohne Bots für eine Einschätzung.')}</p>`;
    return;
  }
  const text = {
    tip: (s, now) => t('{label}: besser als {n} % seiner Mitspieler und Gegner', { label: t(s.label), n: now }),
    aria: t('Skill-Einschätzung als Netzdiagramm'),
    caption: `<span class="lg now"></span>${esc(p.gameName)} <span class="lg before"></span>${t('Lobby-Schnitt')}`,
    hint: t('Weiter außen = besser als die anderen Spieler in seinen Spielen.'),
  };
  const overall = Math.round(mean(rows.map((x) => x.now)));
  box.className = 'card profile';
  box.innerHTML = `<div class="card-head"><h2>${t('Skill-Einschätzung')} <b class="${overall >= 50 ? 'win' : 'loss'}">${overall}</b></h2>` +
    `<span class="hint">${t('{map} · {n} Spiele, verglichen mit den anderen 9 Spielern je Spiel', { map: t(PMODES[r.map]), n: r.games })}</span></div>` +
    `<div class="pgrid">${radarSvg(rows, text)}<div class="pbars">` +
    rows.map(({ s, now, value }) => `<div class="wrow prow" title="${esc(text.tip(s, now))}"><span>${t(s.label)}</span>` +
      `<svg class="ptrack" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect y="4" width="100" height="2" rx="1" class="wbg"></rect>` +
      `<line x1="50" x2="${now}" y1="5" y2="5" class="${now >= 50 ? 'pup' : 'pdown'}" vector-effect="non-scaling-stroke"></line></svg>` +
      `<small><b class="${now >= 50 ? 'win' : 'loss'}">${now}</b> <span class="muted">· ${dec(value, s.digits)} ${esc(t(s.unit))}</span></small></div>`).join('') +
    `<p class="hint">${t('50 = so gut wie der Schnitt seiner Lobbys, 100 = in jedem Spiel der Beste.')}</p></div></div>`;
}

const openPlayer = (riotId, puuid) => {
  showTab('player');
  document.querySelector('.content').scrollTop = 0;
  searchPlayer(riotId, puuid);
};
// Bots haben eine PUUID aus Nullen: dort gibt es kein Profil
const realPuuid = (id) => !!id && !/^0{8}-/.test(id);
const playerLink = (name, puuid) => (realPuuid(puuid) && name
  ? `<button class="link" data-player="${esc(name)}" data-puuid="${esc(puuid)}" title="${esc(t('Spieler ansehen'))}">${esc(name)}</button>`
  : esc(name));

// Spiel aufklappen: beide Teams mit allen Spielern, Namen führen zum Profil. Details je Spiel nur einmal laden
const gameCache = new Map();
async function toggleGame(row) {
  const next = row.nextElementSibling;
  if (next && next.classList.contains('game-detail')) {
    next.remove();
    row.classList.remove('open');
    return;
  }
  row.classList.add('open');
  const box = document.createElement('div');
  box.className = 'game-detail';
  box.innerHTML = `<span class="hint">${t('Lädt…')}</span>`;
  row.after(box);
  const id = row.dataset.game;
  try {
    if (!gameCache.has(id)) gameCache.set(id, window.lol.gameDetail(id));
    box.innerHTML = await gameDetailHtml(await gameCache.get(id), Number(row.dataset.pid));
  } catch (e) {
    gameCache.delete(id);
    box.innerHTML = `<span class="hint">${esc(errText(e))}</span>`;
  }
}
async function gameDetailHtml(g, pid) {
  const who = new Map((g.participantIdentities || []).map((x) => [x.participantId, x.player || {}]));
  let html = '';
  for (const team of [...new Set(g.participants.map((p) => p.teamId))]) {
    const list = g.participants.filter((p) => p.teamId === team);
    const won = list.some((p) => p.stats.win);
    html += `<div class="team-title ${won ? 'win' : 'loss'}">${won ? t('Sieg') : t('Niederlage')}</div>
      <table><tr><th>${t('Spieler')}</th><th>KDA</th><th>CS</th><th>Gold</th><th>${t('Schaden')}</th><th>Vision</th><th>Items</th></tr>`;
    for (const p of list) {
      const s = p.stats;
      const pl = who.get(p.participantId) || {};
      const champ = await window.lol.champion(p.championId);
      const name = pl.gameName ? `${pl.gameName}#${pl.tagLine}` : pl.summonerName || '';
      html += `<tr class="${p.participantId === pid ? 'me' : ''}">
        <td><span class="champ">${champImg(champ)}${esc(champ.name)} <small>${p.participantId === pid ? esc(name) : playerLink(name, pl.puuid)}</small></span></td>
        <td>${s.kills}/${s.deaths}/${s.assists}</td><td>${s.totalMinionsKilled + s.neutralMinionsKilled}</td>
        <td>${n(s.goldEarned)}</td><td>${n(s.totalDamageDealtToChampions)}</td><td>${s.visionScore || 0}</td>
        <td>${itemsHtml([s.item0, s.item1, s.item2, s.item3, s.item4, s.item5, s.item6])}</td></tr>`;
    }
    html += '</table>';
  }
  return html;
}

$('playerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  searchPlayer($('playerInput').value);
});
// Klick auf einen Spieler (Letztes Spiel, Verlauf, Live-Spiel, Zuletzt gesucht) öffnet sein Profil; Klick auf ein
// Spiel im Verlauf oder im Profil klappt es auf
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-player], [data-puuid]');
  if (link) {
    openPlayer(link.dataset.player, link.dataset.puuid);
    return;
  }
  const row = e.target.closest('.game[data-game]');
  if (row) toggleGame(row);
});
drawRecent();
