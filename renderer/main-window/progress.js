// --- Fortschritt: deine letzten Spiele gegen deinen eigenen Schnitt, wie ein Coach, aber nur mit eigenen Daten
// (Farmys gemerkte Spiele, nicht nur die 20 des Clients). Kein Vergleich mit anderen Spielern: Riot erlaubt
// Nach-dem-Spiel-Analyse, und für „besser werden“ zählt ohnehin der Abstand zu dir selbst ---
const RECENT = 10; // „zuletzt“ = die letzten 10 Spiele, verglichen mit allen davor
const gmins = (g) => Math.max(g.dur / 60, 1);
const SKILLS = [
  // Farmen und Sicht nur auf der Kluft: im ARAM gibt es kaum CS-Druck und fast nichts zu warden
  { key: 'farm', label: 'Farmen', unit: 'CS/min', digits: 1, maps: [11], val: (g) => g.cs / gmins(g),
    tip: 'Im Practice Tool 10 Minuten nur Last-Hits üben und beim Recall auf eine volle Welle achten.' },
  { key: 'fight', label: 'Kämpfen', unit: 'KDA', digits: 2, val: (g) => (g.k + g.a) / Math.max(g.d, 1),
    tip: 'Nur in Kämpfe gehen, wenn Summoner und Ulti bereit sind; Kills zählen mit, Assists auch.' },
  { key: 'survive', label: 'Überleben', unit: 'Tode/10 min', digits: 1, lower: true, val: (g) => (g.d / gmins(g)) * 10,
    tip: 'Vor jedem Schritt über die Flussmitte auf die Minimap schauen; ohne Sicht auf den Gegner-Jungler zurückhalten.',
    tipAram: 'Nicht als Erster vorne stehen, solange deine Tanks noch nicht drin sind, und Gesundheitspakete erst nehmen, wenn du sie brauchst.' },
  { key: 'vision', label: 'Sicht', unit: 'Sicht/min', digits: 2, needs: 'vis', maps: [11], val: (g) => g.vis / gmins(g),
    tip: 'Trinket nie voll liegen lassen und bei jedem Recall eine Kontrollwarde kaufen.' },
  { key: 'damage', label: 'Schaden', unit: 'Schaden/min', digits: 0, needs: 'dmg', val: (g) => g.dmg / gmins(g),
    tip: 'In Kämpfen dranbleiben und alle Fähigkeiten loswerden, statt früh rauszulaufen.' },
  // „Good Death“: lohnt sich dein Sterben? KDA bestraft jeden Tod gleich, das hier nicht
  { key: 'dpd', label: 'Schaden pro Tod', unit: 'Schaden/Tod', digits: 0, needs: 'dmg', val: (g) => g.dmg / Math.max(g.d, 1),
    tip: 'Wenn du stirbst, dann nicht umsonst: vorher alle Fähigkeiten in die Gegner bringen oder einen Kill oder ein Objective dafür mitnehmen.' },
  // Wie „Schaden pro Tod“, aber mit dem Leben, das du dafür hergegeben hast: zählt auch Trades ohne Tod
  { key: 'dph', label: 'Schaden pro Leben', unit: 'Schaden/Leben', digits: 2, needs: 'taken', val: (g) => g.dmg / Math.max(g.taken, 1),
    tip: 'Nur Schaden nehmen, wenn du dafür mehr austeilst: aus der Reichweite gehen, sobald deine Fähigkeiten auf Abklingzeit sind, und Trades bei eigenem Vorteil nehmen.' },
  { key: 'obj', label: 'Objectives', unit: 'Obj.-Schaden/min', digits: 0, needs: 'obj', maps: [11], val: (g) => g.obj / gmins(g),
    tip: 'Nach einem gewonnenen Kampf oder Kill direkt Turm, Drache oder Herold nehmen statt zurück in die Lane.' },
  // Konstanz: wie stark deine KDA von Spiel zu Spiel schwankt (Variationskoeffizient), weniger ist besser
  { key: 'steady', label: 'Konstanz', unit: '% Schwankung', digits: 0, lower: true, set: (list) => cv(list.map(kdaOf)) * 100,
    tip: 'Vor jedem Spiel denselben Plan: sicher farmen bis zum ersten Item-Spike, erst dann auf Kämpfe gehen.' },
];
const kdaOf = (g) => (g.k + g.a) / Math.max(g.d, 1);
// Aggression (wie bei Mobalytics): wie viel du an Kills beteiligt bist, unabhängig von deinen Toden
SKILLS.splice(2, 0, { key: 'aggr', label: 'Aggression', unit: 'Kills+Assists/10 min', digits: 1, val: (g) => ((g.k + g.a) / gmins(g)) * 10,
  tip: 'Mehr an Kämpfen deines Teams teilnehmen: nach dem Push zur nächsten Gruppe statt allein weiterfarmen.',
  tipAram: 'Bei jedem Kampf von Anfang an dabei sein, nicht hinten warten, bis er entschieden ist.' });
// Teamplay: Kill-Beteiligung (deine Kills + Assists an allen Kills deines Teams), aus den Spielverläufen
SKILLS.splice(3, 0, { key: 'team', label: 'Teamplay', unit: '% Kill-Beteiligung', digits: 0, needs: 'kp', val: (g) => g.kp * 100,
  tip: 'Näher bei deinem Team bleiben und Kämpfe gemeinsam nehmen; nach deinem Push zum nächsten Kampf statt weiterfarmen.',
  tipAram: 'Mit dem Team zusammen reingehen statt allein vorne zu stehen oder hinten zu warten.' });
// Arena: Platzierung des eigenen Teams, nur dort
SKILLS.unshift({ key: 'place', label: 'Platzierung', unit: 'Ø Platz', digits: 1, lower: true, needs: 'place', maps: [30], val: (g) => g.place,
  tip: 'Augments nach deinem Champ und deinem Duo wählen statt nach Seltenheit, und in den ersten Runden Leben sparen.' });
// Woraus jeder Wert besteht (Skill-Details, wie „Metric Allocation“)
const HOW = {
  place: 'Platz deines Teams am Ende der Arena (1 = Sieg), weniger ist besser.',
  farm: 'Vasallen und Monster pro Spielminute.',
  fight: 'Kills plus Assists geteilt durch Tode, je Spiel.',
  aggr: 'Kills plus Assists pro 10 Spielminuten, unabhängig von deinen Toden.',
  survive: 'Tode pro 10 Spielminuten, weniger ist besser.',
  vision: 'Sichtwert (Wards gesetzt, zerstört, Sicht verweigert) pro Spielminute.',
  damage: 'Schaden an Champions pro Spielminute.',
  dpd: 'Schaden an Champions geteilt durch deine Tode, je Spiel: ob sich dein Sterben gelohnt hat.',
  dph: 'Schaden an Champions geteilt durch deinen erlittenen Schaden, je Spiel: wie viel du für jedes verlorene Leben austeilst (1,00 = gleich viel). Erlittener Schaden zählt auch Vasallen, Monster und Türme mit.',
  obj: 'Schaden an Türmen, Inhibitoren, Drachen, Baron und Herold pro Spielminute.',
  team: 'Deine Kills plus Assists geteilt durch alle Kills deines Teams (Kill-Beteiligung), aus dem Spielverlauf des Clients.',
  steady: 'Wie stark deine KDA von Spiel zu Spiel schwankt (Standardabweichung durch Mittelwert), weniger ist besser.',
};
for (const sk of SKILLS) sk.how = HOW[sk.key];
const cv = (a) => {
  const m = mean(a);
  return m ? Math.sqrt(mean(a.map((v) => (v - m) ** 2))) / m : 0;
};
// Skill → Session-Ziel (Schaden, Objectives, Konstanz zeigt die Live-API im Spiel nicht)
const GOALS = {
  survive: { key: 'deaths', text: 'Höchstens {n} Tode', make: (r) => Math.max(1, Math.floor(mean(r.map((g) => g.d)) * 0.85)) },
  farm: { key: 'csm', text: '{n} CS/min', make: (r) => Math.round(mean(r.map((g) => g.cs / gmins(g))) * 1.08 * 10) / 10 },
  fight: { key: 'kda', text: 'KDA {n}', make: (r) => Math.round(mean(r.map(kdaOf)) * 1.15 * 10) / 10 },
  vision: { key: 'vision', text: '{n} Sicht/min', make: (r) => Math.round(mean(r.map((g) => g.vis / gmins(g))) * 1.1 * 100) / 100 },
};
const GOAL_TEXT = Object.fromEntries(Object.values(GOALS).map((x) => [x.key, x.text]));
const PMODES = { 11: 'Kluft', 12: 'ARAM', 30: 'Arena' };
// Modus-Gruppen nach Queue-ID des Clients; „Kluft (alle)“ fasst alle Queues auf Summoner's Rift zusammen.
// Swiftplay hatte 27.10. die Queue 880 (früher 480)
const PQUEUES = [
  ['rift', 'Kluft (alle)', 11, null],
  ['solo', 'Solo/Duo', 11, [420]],
  ['flex', 'Flex', 11, [440]],
  ['normal', 'Normal', 11, [400, 430, 490]],
  ['swift', 'Swiftplay', 11, [480, 880]],
  ['aram', 'ARAM', 12, [450]],
  ['mayhem', 'ARAM Mayhem', 12, [2400]],
  ['arena', 'Arena', 30, null], // alle Arena-Varianten (2v2v2v2, 3x6 …)
];
const ROLES = [['top', 'Top'], ['jungle', 'Jungle'], ['middle', 'Mid'], ['bottom', 'ADC'], ['utility', 'Support']];
const inQueue = (g, q) => g.map === q[2] && (!q[3] || q[3].includes(g.queue));
// Rolle: aus Farmys Spielprotokoll (Live-API, zuverlässig), sonst die Lane-Angabe des Clients
const roleOf = (g) => (progLogs.find((l) => String(l.gameId) === String(g.id)) || {}).position || g.lane || '';
let progQueue = null;
let progRole = 'all';
let progRange = 'all';
let progK = RECENT; // Größe von „zuletzt“ in der aktuellen Auswahl (10, bei wenigen Spielen die Hälfte)
let progW = 5; // Abschnittslänge der Verläufe (5, bei wenigen Spielen 3) // 'all' | 50 | 20: nur die letzten N Spiele der Auswahl
let progDetail = null; // aufgeklappte Skill-Details (Skill-Key)
let progChamp = null; // Champion-Profil (Champion-Key)
let progGoalHistory = [];
let progPlan = null; // Trainingsplan aus der Config
let progCur = { games: [], rated: [] }; // aktuelle Auswahl (für „Plan erstellen“)
let progGames = [];
let progLp = [];
let progTimelines = {}; // gameId -> Spielverlauf aus dem Client (src/timelines.js)
let progLogs = []; // Farmys Spielprotokolle (Gold beim Tod, Death Recap)
let progGoal = null;
let progMap = 11;
let progAugNames = {}; // Arena-Augment-ID -> Name (aus dem Client)
// Skill-Karten sind per Tastatur bedienbar (Enter/Leertaste wie ein Klick)
$('progress').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-skill]')) {
    e.preventDefault();
    e.target.click();
  }
});
$('progress').addEventListener('click', async (e) => {
  const g = e.target.closest('[data-goal]');
  if (g) {
    progGoal = await window.lol.goalSet(g.dataset.goal === 'none' ? null : { key: g.dataset.goal, target: Number(g.dataset.target), map: progMap });
    drawProgress();
    return;
  }
  const q = e.target.closest('[data-queue]');
  const r = e.target.closest('[data-role]');
  const rg = e.target.closest('[data-range]');
  const sk = e.target.closest('[data-skill]');
  const pr = e.target.closest('[data-prof]');
  const pl = e.target.closest('[data-plan]');
  if (pl) {
    progPlan = await window.lol.planSet(pl.dataset.plan === 'new' ? makePlan(progCur.games, progMap, progCur.rated) : null);
    drawProgress();
    return;
  }
  if (q) {
    progQueue = q.dataset.queue;
    progRole = 'all';
    progChamp = null;
  } else if (r) progRole = r.dataset.role;
  else if (rg) progRange = rg.dataset.range === 'all' ? 'all' : Number(rg.dataset.range);
  else if (sk) progDetail = progDetail === sk.dataset.skill ? null : sk.dataset.skill;
  else if (pr) progChamp = pr.dataset.prof === '' || String(progChamp) === pr.dataset.prof ? null : pr.dataset.prof;
  else return;
  drawProgress();
});

async function renderProgress() {
  let list;
  try {
    const r = await window.lol.progress();
    [list, progLp, progGoal, progTimelines, progLogs] = [r.games, r.lp || [], r.goal, r.timelines || {}, r.logs || []];
    progGoalHistory = r.goalHistory || [];
    progPlan = r.plan || null;
    progAugNames = r.augNames || {};
  } catch {
    list = [];
  }
  // eigene Champions und alle Gegner aus den Spieldetails (für „Schwer für dich“)
  const keys = new Set([...list.map((g) => g.champ), ...Object.values(progTimelines).flatMap((tl) => tl.enemies || [])]);
  for (const id of keys) {
    if (!champCache.has(Number(id))) champCache.set(Number(id), await window.lol.champion(id).catch(() => null));
  }
  list.forEach((g) => {
    g.c = champCache.get(Number(g.champ));
    const tl = progTimelines[g.id];
    g.kp = tl && tl.v >= 3 && tl.teamKills ? (g.k + g.a) / tl.teamKills : null;
  });
  progGames = list;
  // Start: Modus des letzten Spiels, wenn es dort genug Spiele für Skill-Verläufe und Fokus gibt; sonst der Modus mit
  // den meisten Spielen (vorher startete es z. B. in Swiftplay mit 2 Spielen, und alle Graphen fehlten).
  // Eine eigene Wahl bleibt, solange es Spiele dafür gibt
  const complete = list.filter((g) => g.cs != null);
  const last = complete[complete.length - 1];
  if (last && !(progQueue && complete.some((g) => inQueue(g, PQUEUES.find((x) => x[0] === progQueue))))) {
    const count = (q) => complete.filter((g) => inQueue(g, q)).length;
    const own = PQUEUES.slice(1).find((q) => inQueue(last, q));
    const biggest = PQUEUES.reduce((a, q) => (count(q) > count(a) ? q : a), PQUEUES[0]);
    progQueue = (own && count(own) >= RECENT + 5 ? own : biggest)[0];
  }
  drawProgress();
  renderNoteCard(); // Plan-Karte braucht Fokus und Session-Ziel
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const MIN_COMPARE = 6; // ab so vielen Spielen gibt es den Skill-Vergleich (dann Hälfte gegen Hälfte)
const splitOf = (n) => (n >= RECENT + 5 ? RECENT : Math.floor(n / 2));
// Skill-Bereiche: letzte 10 Spiele gegen alle davor; focus = der Bereich, der zuletzt am meisten nachgelassen hat
function rateSkills(games, map) {
  // ab 15 Spielen die letzten 10 gegen den Rest; darunter (ab 6) die neuere Hälfte gegen die ältere, Abschnitte zu 3
  const k = splitOf(games.length);
  const w = k === RECENT ? 5 : 3;
  const recent = games.slice(-k), before = games.slice(0, -k);
  const skills = SKILLS.filter((s) => !s.maps || s.maps.includes(map)).map((s) => {
    const has = (g) => !s.needs || g[s.needs] != null;
    const r = recent.filter(has), b = before.filter(has);
    if (r.length < 3 || b.length < 3) return { ...s, missing: true };
    const agg = s.set || ((list) => mean(list.map(s.val)));
    const now = agg(r), base = agg(b);
    const delta = base ? (now - base) / base : 0;
    const better = s.lower ? -delta : delta; // > 0 = besser als dein Schnitt
    // gleitender Schnitt über 5 Spiele: zeigt die Richtung, nicht jedes Ausreißer-Spiel
    const all = games.filter(has);
    const rolling = all.map((_, i) => agg(all.slice(Math.max(0, i - w + 1), i + 1))).slice(w - 1);
    return { ...s, now, base, better, rolling, tip: map === 12 && s.tipAram ? s.tipAram : s.tip };
  });
  const rated = skills.filter((s) => !s.missing);
  const focus = rated.reduce((a, s) => (!a || s.better < a.better ? s : a), null);
  return { recent, before, skills, rated, focus, k, w };
}

function drawProgress() {
  const el = $('progress');
  // Einträge vor dem 27.10. haben teils nur Items (keine K/D/A, CS): die zählen hier nicht
  const complete = progGames.filter((g) => g.cs != null);
  const groups = PQUEUES.filter((q) => complete.some((g) => inQueue(g, q)));
  const queue = groups.find((q) => q[0] === progQueue) || groups[0] || PQUEUES[0];
  progMap = queue[2];
  const inMode = complete.filter((g) => inQueue(g, queue));
  const roles = progMap === 11 ? ROLES.filter(([r]) => inMode.some((g) => roleOf(g) === r)) : [];
  if (!roles.some(([r]) => r === progRole)) progRole = 'all';
  const byRole = progRole === 'all' ? inMode : inMode.filter((g) => roleOf(g) === progRole);
  const games = progRange === 'all' ? byRole : byRole.slice(-progRange);
  // alle Modi zeigen, auch ohne Spiele (ausgegraut): sonst fragt man sich, wo z. B. Solo/Duo geblieben ist
  const seg = `<div class="seg" role="group" aria-label="${t('Spielmodus')}">${PQUEUES.map((q) => {
    const count = complete.filter((g) => inQueue(g, q)).length;
    return `<button data-queue="${q[0]}" aria-pressed="${q === queue}"${count ? '' : ` disabled title="${esc(t('Noch keine Spiele, seit Farmy mitschreibt'))}"`}>${t(q[1])} <small>${count}</small></button>`;
  }).join('')}</div>` +
    (roles.length ? `<div class="seg roles" role="group" aria-label="${t('Rolle')}">${[['all', 'Alle Rollen'], ...roles].map(([r, label]) =>
      `<button data-role="${r}" aria-pressed="${r === progRole}">${t(label)} <small>${r === 'all' ? inMode.length : inMode.filter((g) => roleOf(g) === r).length}</small></button>`).join('')}</div>` +
      `<p class="hint role-hint">${t('Rolle ab jetzt aus dem Spiel; bei älteren Spielen laut Client, bei Blind und Swiftplay nicht immer genau.')}</p>` : '') +
    `<div class="seg roles" role="group" aria-label="${t('Zeitraum')}">${[[20, 'Letzte 20'], [50, 'Letzte 50'], ['all', 'Alle Spiele']].map(([v, label]) =>
      `<button data-range="${v}" aria-pressed="${v === progRange}"${v !== 'all' && byRole.length <= v ? ' disabled' : ''}>${t(label)}</button>`).join('')}</div>`;
  // Ohne Spiele in dieser Auswahl nichts; unter 15 Spielen fehlen nur Skill-Vergleich, Fokus und Ziel-Vorschläge
  if (!games.length) {
    el.innerHTML = seg + `<div class="msg">${t('Keine Spiele gefunden.')}</div>`;
    return;
  }
  const sec = (title, html) => `<h3 class="sec-title">${t(title)}</h3>${html}`;
  // Arena: keine Lanes, Objectives, Todes-Karte oder Spielverläufe; dafür Platzierungen und Augments
  const rest = progMap === 30 ? sec('Platzierungen', arenaPlaceCard(games)) + sec('Augments', arenaAugCard(games)) +
    sec('Nach Niederlagen', tiltCard(games)) + sec('Ermüdung', fatigueCard(games)) +
    sec('Champion-Pool', champPool(games) + champProfile(games, progMap)) + sec('Rekorde', recordsCard(games, progMap))
    : (progMap === 11 ? jungleSection(games) : '') + sec('Siege gegen Niederlagen', winLossCard(games, progMap)) +
    sec('Wann du stirbst', deathCard(games)) +
    sec('Wo du stirbst', deathMapCard(games, progMap)) +
    sec('Wer dich tötet', killersCard(games)) +
    (progMap === 11 ? sec('Lane-Duell', duelCard(games)) + sec('Level 6', lvl6Card(games)) : '') +
    sec('Anteile im Team', shareCard(games)) +
    sec('Vorsprung und Comeback', leadCard(games, progMap)) +
    sec('Objectives', objCard(games)) +
    sec('Gegen wen du verlierst', enemyCard(games)) +
    sec('Nach Niederlagen', tiltCard(games)) +
    sec('Ermüdung', fatigueCard(games)) +
    sec('Lernkurve', learnCard(games)) +
    `<h3 class="sec-title">${t('Wann du gewinnst')}</h3><div class="wins-grid">${winBlocks(games).join('')}</div>` +
    sec('Champion-Pool', champPool(games) + champProfile(games, progMap)) +
    sec('Monatsvergleich', monthCard(games, progMap)) +
    sec('Rekorde', recordsCard(games, progMap));
  if (games.length < MIN_COMPARE) {
    el.innerHTML = seg + weekCard(games) + lpCard() +
      `<div class="msg">${t('Noch zu wenige Spiele für einen Vergleich ({n} von {need}). Farmy merkt sich jedes Spiel, schau nach ein paar Runden wieder rein.', { n: games.length, need: MIN_COMPARE })}</div>` + rest;
    return;
  }
  const { recent, before, skills, rated, focus, k, w } = rateSkills(games, progMap);
  progK = k;
  progW = w;
  progCur = { games, rated };
  // wenige Spiele: Vergleich gilt, ist aber noch wackelig – das steht dann dabei
  const few = k < RECENT ? `<p class="hint few">${t('Erst {n} Spiele in dieser Auswahl: Vergleich der letzten {k} mit den {m} davor, noch ungenau. Ab 15 Spielen: letzte 10 gegen den Rest.', { n: games.length, k, m: games.length - k })}</p>` : '';
  const wr = (list) => Math.round((list.filter((g) => g.win).length / list.length) * 100);

  const tiles = `<div class="summary">
    <div class="tile"><label>${t('Spiele gemerkt')}</label><b>${games.length}</b></div>
    <div class="tile"><label>${t('Siegquote zuletzt')}</label><b>${wr(recent)} %</b><small class="tile-sub">${t('sonst {n} %', { n: wr(before) })}</small></div>
    <div class="tile"><label>${t('Stärke zuletzt')}</label><b>${t(rated.reduce((a, s) => (s.better > a.better ? s : a)).label)}</b></div>
    <div class="tile"><label>${t('Fokus')}</label><b class="loss">${t(focus.label)}</b></div>
  </div>`;

  const focusCard = focus && focus.better < 0 ? `<div class="card focus-card">
    <h2>${t('Dein Fokus: {skill}', { skill: t(focus.label) })}</h2>
    <p>${t('Zuletzt {now} {unit}, sonst {base}.', { now: dec(focus.now, focus.digits), unit: t(focus.unit), base: dec(focus.base, focus.digits) })}
    ${esc(t(focus.tip))}</p></div>` : '';

  el.innerHTML = seg + tiles + weekCard(games) + focusCard + goalCard(recent, rated) + planCard(games, progMap, rated) + lpCard() +
    `<h3 class="sec-title">${t('Skill-Bereiche · letzte {n} Spiele gegen deinen Schnitt davor', { n: k })}</h3>${few}` +
    `<div class="skills">${skills.map(skillCard).join('')}</div>` + detailCard(skills, games) +
    `<h3 class="sec-title">${t('Skill-Profil')}</h3>${profileCard(rated)}` + rest;
}

// Session-Ziel (wie eine Challenge): eins zur Zeit, im Spiel als Zeile im Panel, nach dem Spiel ✓/✗.
// Vorschläge aus deinen schwächsten Bereichen, jeweils etwas besser als dein Schnitt zuletzt
function goalCard(recent, rated) {
  const fmtT = (key, v) => (key === 'deaths' ? String(v) : dec(v, key === 'vision' ? 2 : 1));
  const g = progGoal;
  let head = `<p class="hint">${t('Ein Ziel für die nächsten Spiele: Farmy zeigt es im Panel und hakt es nach jedem Spiel ab.')}</p>`;
  if (g) {
    const res = g.results || [];
    let streak = 0;
    for (const r of res) streak = r.ok ? streak + 1 : 0;
    const last = res.slice(-5);
    head = `<p><b>${t(GOAL_TEXT[g.key], { n: fmtT(g.key, g.target) })}</b>${g.map ? ` · ${t(PMODES[g.map] || '')}` : ''}</p>` +
      `<p class="hint">${res.length ? t('{ok} von {n} der letzten Spiele geschafft · Serie {s}', { ok: last.filter((r) => r.ok).length, n: last.length, s: streak })
        : t('Noch kein Spiel mit diesem Ziel.')} ${last.map((r) => (r.ok ? '✓' : '✗')).join(' ')}</p>`;
  }
  // Vorschläge für ein neues Ziel; das gerade aktive Ziel wird nicht nochmal vorgeschlagen
  const options = rated.filter((s) => GOALS[s.key] && (progMap === 11 || !['farm', 'vision'].includes(s.key))).sort((a, b) => a.better - b.better).slice(0, 3)
    .map((s) => ({ G: GOALS[s.key], target: GOALS[s.key].make(recent) }))
    .filter(({ G, target }) => !(g && g.key === G.key && g.target === target && (!g.map || g.map === progMap)))
    .map(({ G, target }) => `<button class="ghost" data-goal="${G.key}" data-target="${target}">${t(G.text, { n: fmtT(G.key, target) })}</button>`);
  const remove = g ? `<button class="ghost danger-text" data-goal="none">${t('Ziel entfernen')}</button>` : '';
  return `<div class="card goal-card"><div class="card-head"><h2>${t('Session-Ziel')}</h2>${remove}</div>${head}` +
    (options.length ? `<p class="goal-new">${g ? t('Neues Ziel wählen:') : t('Ziel wählen:')}</p><div class="goal-opts">${options.join('')}</div>` : '') +
    `${goalHistoryHtml()}</div>`;
}

// LP-Verlauf (Solo/Duo, sonst Flex): Rang als Zahl, gemerkt bei jeder Änderung
const TIER_NAMES = ['Eisen', 'Bronze', 'Silber', 'Gold', 'Platin', 'Smaragd', 'Diamant', 'Meister', 'Großmeister', 'Challenger'];
const rankName = (v) => {
  const tier = Math.min(9, Math.floor(v / 400));
  if (tier >= 7) return `${t(TIER_NAMES[tier])} ${v - 2800} LP`;
  return `${t(TIER_NAMES[tier])} ${['IV', 'III', 'II', 'I'][Math.floor((v % 400) / 100)]} · ${v % 100} LP`;
};
function lpCard() {
  for (const [q, label] of [['solo', 'Solo/Duo'], ['flex', 'Flex']]) {
    const pts = progLp.filter((p) => p[q] != null);
    if (pts.length < 2) continue;
    const vals = pts.map((p) => p[q]);
    const diff = vals[vals.length - 1] - vals[0];
    const W = 400, H = 70, pad = 6, min = Math.min(...vals), span = Math.max(...vals) - min || 1;
    const x = (i) => pad + (i * (W - 2 * pad)) / (vals.length - 1);
    const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
    const hits = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[q]).toFixed(1)}" r="6" fill="transparent"><title>${new Date(p.at).toLocaleDateString(i18n.locale())}: ${rankName(p[q])}</title></circle>`).join('');
    return `<div class="card lp-card"><div class="card-head"><h2>${t('LP-Verlauf')} · ${label}</h2>` +
      `<span><b>${rankName(vals[vals.length - 1])}</b> <small class="${diff >= 0 ? 'win' : 'loss'}">${diff >= 0 ? '+' : ''}${diff} LP</small></span></div>` +
      `<svg class="spark lp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('LP-Verlauf')}">` +
      `<polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>${hits}</svg></div>`;
  }
  return '';
}

// Wochenbericht: diese Woche (ab Montag) gegen letzte Woche, auf der gewählten Map; LP über alle Queues
function weekCard(games) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  const lastMonday = monday - 7 * 864e5;
  const thisW = games.filter((g) => g.at >= monday), lastW = games.filter((g) => g.at >= lastMonday && g.at < monday);
  if (!thisW.length && !lastW.length) return '';
  const st = (list) => (!list.length ? null : {
    n: list.length, wr: Math.round((list.filter((g) => g.win).length / list.length) * 100),
    kda: list.reduce((a, g) => a + g.k + g.a, 0) / Math.max(list.reduce((a, g) => a + g.d, 0), 1),
    csm: list.reduce((a, g) => a + g.cs, 0) / list.reduce((a, g) => a + gmins(g), 0),
    dpm: (list.reduce((a, g) => a + g.d, 0) / list.reduce((a, g) => a + gmins(g), 0)) * 10,
  });
  const a = st(thisW), b = st(lastW);
  const rows = [['Spiele', 'n', 0], ['Siegquote', 'wr', 0, ' %'], ['KDA', 'kda', 2], ['CS/min', 'csm', 1], ['Tode/10 min', 'dpm', 1, '', true]];
  const cell = (x, k, d, suf = '') => (x ? `${dec(x[k], d)}${suf}` : '–');
  const arrow = (k, lower) => {
    if (!a || !b || k === 'n' || !b[k]) return '';
    const better = ((a[k] - b[k]) / b[k]) * (lower ? -1 : 1);
    return Math.abs(better) < 0.03 ? '' : better > 0 ? ' <span class="win">↑</span>' : ' <span class="loss">↓</span>';
  };
  // bester Champ der Woche: meiste Siege, dann meiste Spiele
  const by = new Map();
  for (const g of thisW) {
    const c = by.get(g.champ) || { c: g.c, n: 0, w: 0 };
    c.n++;
    if (g.win) c.w++;
    by.set(g.champ, c);
  }
  const best = [...by.values()].sort((x, y) => y.w - x.w || y.n - x.n)[0];
  // LP seit Montag (Solo/Duo, sonst Flex): letzter Stand vor Montag gegen jetzt
  let lp = '';
  for (const [q, label] of [['solo', 'Solo/Duo'], ['flex', 'Flex']]) {
    const pts = progLp.filter((x) => x[q] != null);
    const start = [...pts].reverse().find((x) => x.at < monday) || pts.find((x) => x.at >= monday);
    const end = pts[pts.length - 1];
    if (start && end && end.at >= monday && start !== end) {
      const d = end[q] - start[q];
      lp = `<span class="${d >= 0 ? 'win' : 'loss'}">${d >= 0 ? '+' : ''}${d} LP</span> ${label}`;
      break;
    }
  }
  return `<div class="card week"><div class="card-head"><h2>${t('Wochenbericht')}</h2><span class="hint">${t('seit Montag gegen letzte Woche')}</span></div>` +
    `<table class="pool"><thead><tr><th></th><th>${t('Diese Woche')}</th><th>${t('Letzte Woche')}</th></tr></thead><tbody>` +
    rows.map(([label, k, d, suf, lower]) => `<tr><td>${t(label)}</td><td>${cell(a, k, d, suf)}${arrow(k, lower)}</td><td>${cell(b, k, d, suf)}</td></tr>`).join('') +
    '</tbody></table>' +
    `<p class="week-foot">${best && best.c ? `${t('Champ der Woche')}: <b>${esc(best.c.name)}</b> (${best.w}/${best.n})` : ''}${best && lp ? ' · ' : ''}${lp}</p></div>`;
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
