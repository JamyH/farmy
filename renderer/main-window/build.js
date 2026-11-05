// Eigene meistgebaute Items aus den gemerkten Spielen, mit Anzahl und Siegquote
async function renderOwnItems() {
  const el = $('ownItems');
  const forChamp = champId;
  const d = forChamp ? await window.lol.ownItems(forChamp).catch(() => null) : null;
  if (forChamp !== champId) return;
  if (!d || !d.items.length) {
    el.innerHTML = '';
    return;
  }
  const mode = d.mode === 'aram' ? 'ARAM' : "Summoner's Rift";
  el.innerHTML = `<p class="hint">${t(d.games === 1 ? 'Deine meistgebauten Items ({n} Spiel, {mode})' : 'Deine meistgebauten Items ({n} Spiele, {mode})', { n: d.games, mode })}</p>
    <div class="icons">${d.items.map((i) => `<span class="own-item" title="${esc(i.name)}: ${t('{n}× gebaut, {pct} % Siege', { n: i.count, pct: Math.round((i.wins / i.count) * 100) })}">
      <img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${i.id}.png" alt="${esc(i.name)}"><small>${i.count}×</small></span>`).join('')}</div>
    <div class="btn-row"><button data-own="1">${t('Als meinen Build übernehmen')}</button></div>`;
}
window.lol.onOwnItems(() => champId && renderOwnItems());

function renderBuild() {
  const list = $('buildList');
  const ids = (buildData.builds[champId] || []);
  if (!ids.length) {
    list.innerHTML = `<li class="hint">${t('Noch kein Build. Füge unten Items in Kaufreihenfolge hinzu.')}</li>`;
    return;
  }
  list.innerHTML = ids.map((id, i) => {
    const it = buildData.items.find((x) => x.id === id) || { name: `#${id}`, gold: 0 };
    return `<li><img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${id}.png" alt="">
      <span class="name">${i + 1}. ${esc(it.name)}</span><span class="gold">${it.gold} g</span>
      <button data-act="up" data-i="${i}" aria-label="${esc(t('{item} nach oben', { item: it.name }))}" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-act="down" data-i="${i}" aria-label="${esc(t('{item} nach unten', { item: it.name }))}" ${i === ids.length - 1 ? 'disabled' : ''}>↓</button>
      <button data-act="del" data-i="${i}" aria-label="${esc(t('{item} entfernen', { item: it.name }))}">✕</button></li>`;
  }).join('');
}

async function saveBuild(ids) {
  buildData.builds[champId] = ids;
  await window.lol.setBuild(champId, ids);
  renderBuild();
}

function renderRunes() {
  const r = buildData.runes[champId];
  const img = (x) => (x ? `<img src="${esc(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}">` : '');
  $('runeView').innerHTML = r
    ? `<div class="rune-row"><span class="style">${esc(r.primary?.name || '')} / ${esc(r.sub?.name || '')}</span></div>
       <div class="rune-row">${img(r.primary)}${r.perks.map(img).join('')}${img(r.sub)}</div>`
    : `<p class="hint">${t('Für diesen Champion ist noch keine Runenseite gespeichert. Stell sie im Client ein und klick „Aktuelle Runenseite speichern“.')}</p>`;
}

// lolalytics-Vorschlag unter Build und Runen, mit Quelle und „Übernehmen“
const LANE_NAMES = { top: 'Top', jungle: 'Jungle', middle: 'Mid', bottom: 'Bot', support: 'Support' };
async function renderSuggestion(load = false) {
  const b = $('buildSuggestion');
  b.innerHTML = '';
  $('spellView').innerHTML = `<p class="hint">${t('Empfehlung kommt beim Pick in der Champ-Auswahl.')}</p>`;
  if (window.lol.sources.lolalytics && buildData.suggestions && champId) {
    const forChamp = champId;
    try {
      const s = await window.lol.suggestion(champId, load);
      if (forChamp !== champId) return; // inzwischen anderer Champ gewählt, dessen Aufruf zeichnet selbst
      if (!s) {
        b.innerHTML = `<p class="hint">${t('Noch kein Vorschlag geladen. Er kommt automatisch beim Pick in der Champ-Auswahl.')}</p><div class="btn-row"><button id="loadSuggestion">${t('Jetzt von lolalytics laden')}</button></div>`;
      } else {
        const icon = (id) => `<img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${id}.png" alt="" title="${esc(buildData.items.find((x) => x.id === id)?.name || '')}">`;
        b.innerHTML = `<p class="hint">${t('Vorschlag von {link} ({lane}, Emerald+, Stand {date})', {
          link: `<a href="#" data-url="${esc(s.url)}">lolalytics.com</a>`, lane: esc(LANE_NAMES[s.lane] || t('Standard-Rolle')),
          date: new Date(s.fetchedAt).toLocaleDateString(i18n.locale()) })}</p>
          <div class="icons">${s.starting.map(icon).join('')}<span class="sep">›</span>${s.items.map(icon).join('')}</div>
          <div class="btn-row"><button data-take="build">${t('Als meinen Build übernehmen')}</button></div>
          ${(s.builds || []).map((x, i) => (x.shown ? '' : `<p class="hint">${esc(x.label)}</p>
            <div class="icons">${x.items.map(icon).join('')}</div>
            <div class="btn-row"><button data-take="build:${i}">${t('Als meinen Build übernehmen')}</button></div>`)).join('')}`;
        if (s.spells.length) {
          $('spellView').innerHTML = `<div class="icons">${s.spells.map((x) => `<img src="${esc(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}"><span class="label">${esc(x.name)}</span>`).join('')}</div>
            <p class="hint">${t('Meistgespielt laut lolalytics.com')}</p>`;
        }
      }
    } catch (e) {
      if (forChamp !== champId) return;
      b.innerHTML = `<p class="hint">lolalytics.com: ${esc(e.message)}</p>`;
    }
  }
  renderRuneOptions();
}

// Mehrere Runenseiten zur Auswahl (lolalytics + Riot-Empfehlungen): „Setzen“ schreibt sie sofort auf die
// Seite „Farmy“, „Merken“ speichert sie als deine Runen für diesen Champion
async function renderRuneOptions() {
  const r = $('runeSuggestion');
  const forChamp = champId;
  const options = forChamp ? await window.lol.runeOptions(forChamp).catch(() => []) : [];
  if (forChamp !== champId) return; // inzwischen anderer Champion gewählt
  const img = (x) => (x ? `<img src="${esc(x.icon)}" alt="${esc(x.name)}" title="${esc(x.name)}">` : '');
  r.innerHTML = options.length
    ? `<p class="hint">${t('Runenseiten zur Auswahl')}</p>${options.map((o, i) => `
        <div class="rune-option">
          <div class="icons">${o.runes.perks.slice(0, 6).map(img).join('')}</div>
          <span class="label">${esc(o.runes.primary?.name || '')} / ${esc(o.runes.sub?.name || '')}<br>
            ${o.url ? `<a href="#" data-url="${esc(o.url)}">${esc(o.source)}</a>` : esc(o.source)}</span>
          <button data-rune="${i}">${t('Setzen')}</button><button data-rune="${i}" data-save="1">${t('Merken')}</button>
        </div>`).join('')}`
    : '';
}
document.querySelectorAll('.suggestion').forEach((el) => el.addEventListener('click', async (e) => {
  const link = e.target.closest('a[data-url]');
  if (link) {
    e.preventDefault();
    return window.lol.openSource(link.dataset.url);
  }
  if (e.target.id === 'loadSuggestion') return renderSuggestion(true);
  const option = e.target.closest('button[data-rune]');
  if (option && champId) {
    try {
      runeStatus(await window.lol.useRuneOption(champId, Number(option.dataset.rune), !!option.dataset.save));
      if (option.dataset.save) {
        buildData = await window.lol.buildData();
        renderRunes();
      }
    } catch (e) {
      runeStatus(`${t('Fehler')}: ${errText(e)}`);
    }
    return;
  }
  if (e.target.closest('button[data-own]') && champId) {
    try {
      await window.lol.takeOwnItems(champId);
    } catch (err) {
      return buildStatus(errText(err));
    }
    buildData = await window.lol.buildData();
    return renderBuild();
  }
  const take = e.target.closest('button[data-take]');
  if (!take || !champId) return;
  try {
    await window.lol.takeSuggestion(champId, take.dataset.take);
  } catch (err) {
    return buildStatus(errText(err));
  }
  buildData = await window.lol.buildData();
  renderBuild();
  renderRunes();
}));
$('suggestionsOn').addEventListener('change', async () => {
  buildData.suggestions = $('suggestionsOn').checked;
  await window.lol.setSuggestions(buildData.suggestions);
  renderSuggestion();
});
window.lol.onSuggestion((id) => id === champId && renderSuggestion());
$('openInChampSelect').addEventListener('change', () => window.lol.setOpenInChampSelect($('openInChampSelect').checked));
$('autoAccept').addEventListener('change', () => window.lol.setAutoAccept($('autoAccept').checked));
window.lol.onAutoAccept((on) => ($('autoAccept').checked = on));
const buildStatus = (msg) => ($('buildStatus').textContent = msg);
$('importItemSet').addEventListener('click', async () => {
  if (!champId) return;
  try {
    buildStatus(await window.lol.importItemSet(champId));
  } catch (e) {
    buildStatus(`${t('Fehler')}: ${errText(e)}`);
  }
});
$('itemSetAuto').addEventListener('change', () => window.lol.setItemSetAuto($('itemSetAuto').checked));
window.lol.onBuildStatus(buildStatus);

// ARAM-Bank: dein Champ und die Bank nach ARAM-Siegrate; ab 2 Prozentpunkten Vorsprung „Tausch lohnt sich“.
// Klick auf einen Champ zeigt seinen Build und seine Runen.
const pct = (v) => `${dec(v, 1)} %`;
function renderBench(info) {
  $('benchCard').hidden = !info;
  if (!info) return;
  const mine = info.list.find((c) => c.mine);
  $('benchList').innerHTML = info.list.map((c) => {
    const diff = mine && mine.wr != null && c.wr != null && !c.mine ? c.wr - mine.wr : null;
    const better = diff != null && diff >= 2;
    return `<div class="bench-row${c.mine ? ' mine' : ''}${better ? ' better' : ''}" data-champ="${esc(c.id)}">
      <img src="${esc(c.icon)}" alt=""><span class="name">${esc(c.name)}${c.mine ? ` <small>(${t('du')})</small>` : ''}</span>
      <b>${c.wr == null ? '–' : pct(c.wr)}</b>
      <span class="diff">${better ? t('Tausch lohnt sich (+{pct})', { pct: pct(diff) }) : diff != null ? `${diff >= 0 ? '+' : ''}${pct(diff)}` : ''}</span>
    </div>`;
  }).join('');
  $('benchSource').innerHTML = t('ARAM-Siegrate von {link}, Stand {date}. Tauschen musst du selbst im Client.', {
    link: `<a href="#" data-url="${esc(info.url)}">lolalytics.com</a>`, date: new Date(info.fetchedAt).toLocaleDateString(i18n.locale()) });
}
$('benchCard').addEventListener('click', (e) => {
  const link = e.target.closest('a[data-url]');
  if (link) {
    e.preventDefault();
    return window.lol.openSource(link.dataset.url);
  }
  const row = e.target.closest('[data-champ]');
  if (row) selectChampion(row.dataset.champ);
});
window.lol.onBench(renderBench);
window.lol.bench().then(renderBench);

$('champInput').addEventListener('change', () => {
  const c = champByName.get($('champInput').value.trim().toLowerCase());
  if (c) selectChampion(c.id);
});
$('addItem').addEventListener('click', () => {
  const it = itemByName.get($('itemInput').value.trim().toLowerCase());
  if (!it || !champId) return;
  $('itemInput').value = '';
  saveBuild([...(buildData.builds[champId] || []), it.id]);
});
$('itemInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('addItem').click());
$('buildList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const ids = [...(buildData.builds[champId] || [])];
  const i = Number(b.dataset.i);
  if (b.dataset.act === 'del') ids.splice(i, 1);
  if (b.dataset.act === 'up') [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
  if (b.dataset.act === 'down') [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
  saveBuild(ids);
});
const runeStatus = (msg) => ($('runeStatus').textContent = msg);
$('saveRunes').addEventListener('click', async () => {
  if (!champId) return;
  try {
    buildData.runes[champId] = await window.lol.saveRunes(champId);
    renderRunes();
    runeStatus(t('Gespeichert.'));
  } catch (e) {
    runeStatus(`${t('Fehler')}: ${errText(e)}`);
  }
});
$('applyRunes').addEventListener('click', async () => {
  if (!champId) return;
  try {
    runeStatus(await window.lol.applyRunes(champId));
  } catch (e) {
    runeStatus(`${t('Fehler')}: ${errText(e)}`);
  }
});
$('runesAuto').addEventListener('change', () => window.lol.setRunesAuto($('runesAuto').checked));
$('spellsAuto').addEventListener('change', () => window.lol.setSpellsAuto($('spellsAuto').checked));
const spellStatus = (msg) => ($('spellStatus').textContent = msg);
$('applySpells').addEventListener('click', async () => {
  try {
    spellStatus(await window.lol.applySpells());
  } catch (e) {
    spellStatus(`${t('Fehler')}: ${errText(e)}`);
  }
});
window.lol.onSpellsStatus((msg) => spellStatus(msg));
