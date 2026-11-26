// --- Notizen: eigene Notizen je Champion plus eine allgemeine, nur lokal; speichert beim Tippen (600 ms Pause) ---
const GENERAL = '_general';
let notesData = {};
let noteKey = GENERAL;
let noteTimer = null;
const champById = (id) => buildData && buildData.champions.find((c) => c.id === id);
const noteName = (key) => (key === GENERAL ? t('Allgemein') : (champById(key) || { name: key }).name);

async function renderNotes() {
  notesData = await window.lol.notes().catch(() => ({}));
  drawNoteList();
  openNote(noteKey);
  renderNoteCard();
}
function drawNoteList() {
  const keys = Object.keys(notesData).sort((a, b) => notesData[b].at - notesData[a].at);
  $('noteList').innerHTML = keys.length ? keys.map((k) => `<button class="note-item${k === noteKey ? ' active' : ''}" data-note="${esc(k)}">` +
    `${k === GENERAL ? '<span class="champ-ph" aria-hidden="true"></span>' : champImg(champById(k))}` +
    `<span><b>${esc(noteName(k))}</b><small>${esc((notesData[k].text || ((notesData[k].journal || []).slice(-1)[0] || {}).text || '').split('\n')[0].slice(0, 60))}</small></span></button>`).join('')
    : `<p class="hint">${t('Noch keine Notizen. Wähl oben einen Champion.')}</p>`;
}
function openNote(key) {
  flushNote();
  noteKey = key;
  const n = notesData[key];
  $('noteTitle').textContent = noteName(key);
  $('noteArea').value = n ? n.text : '';
  $('noteState').textContent = n ? t('gespeichert {when}', { when: new Date(n.at).toLocaleString(i18n.locale(), { dateStyle: 'short', timeStyle: 'short' }) }) : '';
  $('noteChamp').value = key === GENERAL ? '' : noteName(key);
  resetDelete();
  drawJournal();
  document.querySelectorAll('.note-item').forEach((b) => b.classList.toggle('active', b.dataset.note === key));
}
// Schlüssel und Text werden vor dem ersten await gelesen: ein Wechsel zum nächsten Champ kommt nicht dazwischen
async function saveNote() {
  noteTimer = null;
  const key = noteKey;
  notesData = await window.lol.noteSet(key, $('noteArea').value);
  if (key === noteKey) {
    $('noteState').textContent = notesData[key] ? t('gespeichert') : '';
    $('noteDelete').hidden = !notesData[key];
  }
  drawNoteList();
  renderNoteCard();
}
// Tagebuch des Champions: Einträge aus dem Rückblick („Was nehme ich mit?“), neueste zuerst, einzeln löschbar
function drawJournal() {
  const list = [...((notesData[noteKey] || {}).journal || [])].sort((a, b) => b.at - a.at);
  $('noteJournal').innerHTML = !list.length ? '' : `<h3>${t('Aus deinen Spielen')}</h3>` + list.map((j) =>
    `<div class="j-row"><span class="j-meta"><b class="${j.win ? 'win' : 'loss'}">${j.win ? t('Sieg') : t('Niederlage')}</b> · ` +
    `${new Date(j.at).toLocaleDateString(i18n.locale())}</span><span class="j-text">${esc(j.text)}</span>` +
    `<button class="ghost j-del" data-game="${esc(j.gameId)}" title="${esc(t('Eintrag löschen'))}" aria-label="${esc(t('Eintrag löschen'))}">×</button></div>`).join('');
}
$('noteJournal').addEventListener('click', async (e) => {
  const b = e.target.closest('.j-del');
  if (!b) return;
  notesData = await window.lol.noteLearn(noteKey, { gameId: b.dataset.game, text: '' });
  drawJournal();
  drawNoteList();
  renderNoteCard();
});
// Löschen in zwei Schritten (ohne Browser-Dialog): erster Klick fragt nach, zweiter innerhalb von 4 s löscht
let deleteArmed = null;
function resetDelete() {
  clearTimeout(deleteArmed);
  deleteArmed = null;
  $('noteDelete').textContent = t('Löschen');
  $('noteDelete').classList.remove('danger');
  $('noteDelete').hidden = !notesData[noteKey];
}
$('noteDelete').addEventListener('click', async () => {
  if (!deleteArmed) {
    $('noteDelete').textContent = t('Wirklich löschen?');
    $('noteDelete').classList.add('danger');
    deleteArmed = setTimeout(resetDelete, 4000);
    return;
  }
  clearTimeout(noteTimer);
  noteTimer = null;
  $('noteArea').value = '';
  await saveNote();
  $('noteState').textContent = t('gelöscht');
  resetDelete();
});
function flushNote() {
  if (!noteTimer) return;
  clearTimeout(noteTimer);
  saveNote();
}
$('noteArea').addEventListener('input', () => {
  $('noteState').textContent = '…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(saveNote, 600);
});
$('noteArea').addEventListener('blur', flushNote);
window.addEventListener('beforeunload', flushNote);
$('noteList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-note]');
  if (b) openNote(b.dataset.note);
});
$('noteGeneral').addEventListener('click', () => openNote(GENERAL));
$('noteChamp').addEventListener('change', () => {
  const c = champByName.get($('noteChamp').value.trim().toLowerCase());
  if (c) openNote(c.id);
});
// „Build & Runen“: Notiz zum gewählten Champion, „Bearbeiten“ springt in den Reiter „Notizen“
// „Build & Runen“ in der Champ-Auswahl: dein Plan für dieses Spiel – Notiz, letzte Learnings zum Champion,
// Session-Ziel, Fokus aus dem Fortschritt und die Lane-Einschätzung gegen die gegnerischen Picks
function renderNoteCard() {
  if (!champId) return;
  const note = notesData[champId];
  $('noteText').innerHTML = note && note.text ? esc(note.text) : `<span class="hint">${t('Noch keine Notiz zu diesem Champion.')}</span>`;
  $('noteEdit').textContent = note && note.text ? t('Bearbeiten') : t('Notiz schreiben');
  const parts = [];
  const learned = [...((note || {}).journal || [])].sort((a, b) => b.at - a.at).slice(0, 3);
  if (learned.length) parts.push([t('Zuletzt gelernt'), learned.map((j) => esc(j.text)).join('<br>')]);
  if (progGoal) {
    const f = (v) => (progGoal.key === 'deaths' ? String(v) : dec(v, progGoal.key === 'vision' ? 2 : 1));
    parts.push([t('Session-Ziel'), esc(t(GOAL_TEXT[progGoal.key], { n: f(progGoal.target) }))]);
  }
  // Fokus auf der Map des kommenden Spiels (ARAM-Bank sichtbar = ARAM)
  const map = $('benchCard').hidden ? 11 : 12;
  const games = progGames.filter((g) => g.map === map && g.cs != null);
  if (games.length >= MIN_COMPARE) {
    const { focus } = rateSkills(games, map);
    if (focus && focus.better < 0) parts.push([t('Fokus'), `${esc(t(focus.label))}: ${esc(t(focus.tip))}`]);
  }
  if (map === 11) parts.push(...ownRecord(games));
  const mu = Object.entries(matchupResults).filter(([id]) => id !== champId && matchupResults[id] && !matchupResults[id].error);
  if (mu.length) {
    parts.push([t('Lane'), mu.map(([id, d]) => {
      const [label, cls] = laneVerdict(d);
      return `${esc((champById(id) || { name: id }).name)} <span class="${cls}">${esc(label)}</span>`;
    }).join(' · ')]);
  }
  $('planMore').innerHTML = parts.map(([label, html]) => `<div class="rv-row"><span class="rv-label">${label}</span><span>${html}</span></div>`).join('');
}
// Deine eigene Bilanz (Kluft) mit dem gewählten Champion und gegen die gegnerischen Picks: als Lane-Gegner (aus den
// Spielverläufen, mit Gold-Differenz bei 15 min) oder sonst im Gegnerteam. Nur Zeilen mit genug Spielen
function ownRecord(games) {
  const keyOf = (id) => Number((champById(id) || {}).key);
  const wl = (l) => {
    const w = l.filter((g) => g.win).length;
    return `<span class="${w * 2 >= l.length ? 'win' : 'loss'}">${w}–${l.length - w}</span>`;
  };
  const rows = [];
  const mine = games.filter((g) => g.champ === keyOf(champId));
  if (mine.length) {
    const deaths = mean(mine.map((g) => g.d));
    rows.push([t('Du mit {champ}', { champ: esc((champById(champId) || { name: champId }).name) }),
      `${wl(mine)} · ${t('Ø {d} Tode', { d: dec(deaths, 1) })}` +
      (mine.length >= 3 && mine.filter((g) => g.win).length * 100 / mine.length < 45 ? ` · <span class="loss">${t('läuft bei dir bisher schlecht')}</span>` : '')]);
  }
  for (const id of [...new Set(matchup.enemies)].filter((x) => x !== champId)) {
    const key = keyOf(id);
    const name = esc((champById(id) || { name: id }).name);
    const lane = games.filter((g) => (progTimelines[g.id] || {}).oppChamp === key);
    if (lane.length >= 2) {
      const gd = lane.map((g) => progTimelines[g.id]).filter((tl) => tl.at15 && tl.opp15).map((tl) => tl.at15.gold - tl.opp15.gold);
      const lead = gd.length >= 2 ? mean(gd) : null;
      const thrown = lead != null && lead > 0 && lane.filter((g) => g.win).length * 2 < lane.length;
      rows.push([t('Gegen {champ}', { champ: name }), `${wl(lane)} ${t('als Lane-Gegner')}` +
        (lead != null ? ` · ${t('bei 15 min Ø {g} g', { g: `${lead >= 0 ? '+' : '−'}${n(Math.abs(Math.round(lead)))}` })}` : '') +
        (thrown ? ` · <span class="loss">${t('meist vorne und trotzdem verloren: Vorsprung in Türme und Druck umsetzen')}</span>` : '')]);
      continue;
    }
    const team = games.filter((g) => ((progTimelines[g.id] || {}).enemies || []).includes(key));
    if (team.length >= 3) rows.push([t('Gegen {champ}', { champ: name }), `${wl(team)} ${t('im Gegnerteam')}`]);
  }
  return rows;
}
$('noteEdit').addEventListener('click', () => {
  showTab('notes');
  openNote(champId);
  $('noteArea').focus();
});
