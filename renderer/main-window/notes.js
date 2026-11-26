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
