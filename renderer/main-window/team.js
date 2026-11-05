// --- Dein Team: Mitspieler in der Champ-Auswahl (src/scout.js). Erst Rang/Form/Champs, die Skill-Einschätzung lädt
// danach (20 Spieldetails je Spieler). Verborgene Namen (Ranked) bleiben verborgen ---
let team = null; // { allies } aus dem Hauptprozess
const scouted = new Map(); // puuid -> { player, skill, error }; der Hauptprozess merkt sich die Daten ebenfalls
// Champion zum Key über den gemeinsamen champCache (oben), fehlt er, aus Data Dragon nachladen
const loadChamp = async (key) => {
  if (!champOf(key)) champCache.set(Number(key), await window.lol.champion(key));
  return champOf(key);
};
function scoutAlly(puuid) {
  if (scouted.has(puuid)) return;
  const entry = {};
  scouted.set(puuid, entry);
  window.lol.lobbyPlayer(puuid).then(async (p) => {
    for (const c of p.champs) c.champ = await loadChamp(c.key);
    entry.player = p;
    renderTeam();
    entry.skill = await window.lol.lobbySkill(puuid).catch(() => null);
    entry.skillDone = true;
    renderTeam();
  }, (e) => {
    entry.error = errText(e); // bleibt bis zur nächsten Champ-Auswahl stehen, kein Dauer-Neuladen
    renderTeam();
  });
}
function allyHtml(a, entry) {
  const lane = LANE_NAME[a.position] ? `<label>${t(LANE_NAME[a.position])}</label>` : '';
  const head = (who) => `<div class="champ">${champImg(a.champId ? { id: a.champId } : null)}<div class="who">${lane}${who}</div></div>`;
  if (!a.puuid) return `<div class="team-row hidden-name">${head(`<span class="muted">${a.bot ? 'Bot' : t('Name verborgen')}</span>`)}</div>`;
  const name = esc(a.riotId.split('#')[0]);
  const link = `<button class="link" data-player="${esc(a.riotId)}" data-puuid="${esc(a.puuid)}" title="${esc(t('Spieler ansehen'))}">${name}</button>`;
  const p = entry && entry.player;
  if (!p) return `<div class="team-row">${head(link)}<span class="hint">${esc((entry && entry.error) || t('Lädt…'))}</span></div>`;
  // Form: Siege/Niederlagen der letzten Spiele, Serie ab 3
  const wr = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  const form = p.games
    ? `<b><span class="win">${t('{n}S', { n: p.wins })}</span> <span class="loss">${t('{n}N', { n: p.games - p.wins })}</span></b>` +
      `<small><span class="${wr >= 50 ? 'win' : 'loss'}">${wr} %</span>${p.streak.n >= 3 ? ` · <span class="${p.streak.win ? 'win' : 'loss'}">${t(p.streak.win ? '{n} Siege am Stück' : '{n} Niederlagen am Stück', { n: p.streak.n })}</span>` : ''}</small>`
    : `<small>${t('Keine Spiele gefunden.')}</small>`;
  // Rolle: Hauptrolle auf der Kluft; zugeteilte Rolle selten gespielt -> wohl Autofill
  // Anteile nur aus Spielen mit erkannter Lane (Swiftplay u. a. liefern oft keine)
  const main = p.roles[0];
  const known = p.roles.reduce((sum, r) => sum + r.games, 0);
  const share = (r) => Math.round((r.games / known) * 100);
  const assigned = p.roles.find((r) => r.key === a.position);
  const off = LANE_NAME[a.position] && known >= 5 && (!assigned || assigned.games / known < 0.15);
  const role = known >= 3
    ? `<b>${t('meist {lane}', { lane: t(LANE_NAME[main.key]) })} <span class="muted">${share(main)} %</span></b>` +
      (off ? `<small class="warn">${t('spielt selten {lane}', { lane: t(LANE_NAME[a.position]) })}</small>` : '')
    : `<small>${t('zu wenige Spiele auf der Kluft')}</small>`;
  // auf dem gewählten Champ: Spiele in den letzten 20 und Meisterschaft
  const on = p.champs.find((c) => String(c.key) === String(a.championKey));
  const m = p.mastery.find((x) => String(x.championId) === String(a.championKey));
  const onChamp = a.championKey
    ? `<small>${on ? t('auf dem Pick: {n} Spiele, {w} %', { n: on.games, w: Math.round((on.wins / on.games) * 100) })
      : m ? t('auf dem Pick: Meisterschaft {n}', { n: m.level }) : t('auf dem Pick: kaum gespielt')}</small>` : '';
  const pool = `<div class="pool">${p.champs.map((c) =>
    `<span title="${esc(t('{champ}: {n} Spiele, {w} % Siege', { champ: c.champ.name, n: c.games, w: Math.round((c.wins / c.games) * 100) }))}">${champImg(c.champ)}${c.games}</span>`).join('')}</div>${onChamp}`;
  const sk = entry.skill;
  const skill = !entry.skillDone ? '<span class="hint">…</span>'
    : sk ? `<label>Skill</label><b class="${sk.overall >= 50 ? 'win' : 'loss'}" title="${esc(t('{map} · {n} Spiele, verglichen mit den anderen 9 Spielern je Spiel', { map: t(PMODES[sk.map]), n: sk.games }))}">${sk.overall}</b><small>${t(PMODES[sk.map])}</small>`
      : '<label>Skill</label><span class="muted">–</span>';
  return `<div class="team-row">${head(`${link}<small>${rankHtml({ rank: p.solo || { unranked: true } })}</small>`)}` +
    `<div>${form}</div><div>${role}</div><div>${pool}</div><div class="sk">${skill}</div></div>`;
}
function renderTeam() {
  const card = $('teamCard');
  if (!team || !team.allies.length) return (card.hidden = true);
  card.hidden = false;
  for (const a of team.allies) if (a.puuid) scoutAlly(a.puuid);
  $('teamList').innerHTML = team.allies.map((a) => allyHtml(a, scouted.get(a.puuid))).join('');
}
window.lol.onTeam((s) => {
  if (!s) scouted.clear(); // Champ-Auswahl vorbei: Fehler und Stand verwerfen (der Hauptprozess merkt sich die Daten)
  team = s;
  renderTeam();
});
window.lol.teamState().then((s) => {
  team = s;
  renderTeam();
});

// Deine besten Champs für die zugeteilte Rolle (nur in der Champ-Auswahl mit Rollen)
const LANE_NAME = { top: 'Top', jungle: 'Jungle', middle: 'Mid', bottom: 'Bot', utility: 'Support' };
async function renderBest() {
  const card = $('bestCard');
  const lane = matchup.position;
  if (!LANE_NAME[lane]) return (card.hidden = true);
  const list = await window.lol.bestChamps(lane).catch(() => []);
  card.hidden = false;
  $('bestLane').textContent = LANE_NAME[lane];
  $('bestList').innerHTML = list.length ? list.map((c) =>
    `<div class="best-row"><span class="champ">${champImg({ id: c.id })}<b>${esc(c.name)}</b></span>` +
    `<span>${t('{n} Spiele', { n: c.games })}</span><b class="${c.wins / c.games >= 0.5 ? 'win' : 'loss'}">${dec((c.wins / c.games) * 100, 0)} %</b>` +
    `<span>KDA ${dec(c.kda, 2)}</span></div>`).join('')
    : `<p class="hint">${t('Noch zu wenige eigene Spiele in dieser Rolle.')}</p>`;
}
