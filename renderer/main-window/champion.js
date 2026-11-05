// --- Build & Runen ---
let buildData = null;
let champId = null;
const champByName = new Map();
const itemByName = new Map();

async function loadBuild() {
  buildData = await window.lol.buildData();
  $('champList').innerHTML = buildData.champions.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  buildData.champions.forEach((c) => champByName.set(c.name.toLowerCase(), c));
  $('itemOptions').innerHTML = buildData.items
    .map((i) => `<option value="${esc(i.name)}">${i.gold} g${i.completed ? '' : ` · ${t('Teil')}`}</option>`).join('');
  buildData.items.forEach((i) => itemByName.set(i.name.toLowerCase(), i));
  $('runesAuto').checked = buildData.runesAuto;
  $('spellsAuto').checked = buildData.spellsAuto;
  $('suggestionsOn').checked = buildData.suggestions;
  $('suggestionsOn').closest('label').hidden = !window.lol.sources.lolalytics; // Quelle aus: kein Schalter
  $('openInChampSelect').checked = buildData.openInChampSelect;
  $('autoAccept').checked = buildData.autoAccept;
  $('itemSetAuto').checked = buildData.itemSetAuto;
  selectChampion(champId || buildData.current);
  renderNotes(); // braucht die Champion-Liste aus buildData
}

function selectChampion(id) {
  const champ = buildData && buildData.champions.find((c) => c.id === id);
  if (!champ) return;
  champId = champ.id;
  $('champInput').value = champ.name;
  renderBuild();
  renderRunes();
  renderSuggestion();
  renderOwnItems();
  renderMatchup();
  renderJungle();
  renderNoteCard();
}
