// Was die Aktion „Farmy-Knopf“ auslösen kann (POST /action an src/main/deck.js) und wie die Taste ihren Stand zeigt.
// Genutzt vom Plugin (plugin.js) und vom Einstellungsfeld (ui/button.html, dort als window.FarmyButtons)
(function () {
  const L = typeof module !== 'undefined' ? require('./look') : window.FarmyLook;
  const { C } = L;

  const onOff = (on, T) => ({ value: on ? T.on : T.offState, color: on ? C.ok : C.dim });
  // Reiter des Hauptfensters (ids aus renderer/main-window/app.js, freigegeben in deck.js → TABS)
  const TABS = [
    ['live', { de: 'Live-Spiel', en: 'Live game' }, { de: 'LIVE', en: 'LIVE' }],
    ['eog', { de: 'Letztes Spiel', en: 'Last game' }, { de: 'RÜCKBLICK', en: 'REVIEW' }],
    ['build', { de: 'Build & Runen', en: 'Build & runes' }, { de: 'BUILD', en: 'BUILD' }],
    ['wiki', { de: 'Champions', en: 'Champions' }, { de: 'CHAMPS', en: 'CHAMPS' }],
    ['history', { de: 'Verlauf', en: 'History' }, { de: 'VERLAUF', en: 'HISTORY' }],
    ['progress', { de: 'Fortschritt', en: 'Progress' }, { de: 'FORTSCHR.', en: 'PROGRESS' }],
    ['notes', { de: 'Notizen', en: 'Notes' }, { de: 'NOTIZEN', en: 'NOTES' }],
  ];

  // id, Name im Einstellungsfeld, Anfrage an Farmy, Anzeige aus den Farmy-Daten
  const list = [
    { id: 'overlay', name: { de: 'Overlay ein/aus', en: 'Overlay on/off' }, action: { id: 'overlay' },
      show: (d, T) => ({ label: 'OVERLAY', ...onOff(!d.overlay.hidden, T) }) },
    { id: 'clickThrough', name: { de: 'Klick-durch umschalten', en: 'Toggle click-through' }, action: { id: 'clickThrough' },
      show: (d, T, lang) => ({ label: lang === 'de' ? 'KLICK-DURCH' : 'CLICK-THRU', ...onOff(d.overlay.clickThrough, T) }) },
    { id: 'compact', name: { de: 'Panel kompakt', en: 'Compact panel' }, action: { id: 'compact' },
      show: (d, T, lang) => ({ label: lang === 'de' ? 'KOMPAKT' : 'COMPACT', ...onOff(d.overlay.compact, T) }) },
    { id: 'mark', name: { de: 'Moment markieren', en: 'Mark moment' }, action: { id: 'mark' },
      show: (d, T, lang) => ({ label: 'MOMENT', value: '★', sub: lang === 'de' ? 'markieren' : 'mark', color: d.inGame ? C.gold : C.dim }) },
    { id: 'build', name: { de: 'Build übernehmen (Champ-Auswahl)', en: 'Apply build (champ select)' }, action: { id: 'build' },
      show: (d, T, lang) => {
        const now = d.phase === 'ChampSelect';
        return { label: 'BUILD', value: lang === 'de' ? 'LADEN' : 'LOAD', sub: now ? T.runesItems : T.onlyChamp, color: now ? C.gold : C.dim };
      } },
    { id: 'autoAccept', name: { de: 'Auto-Accept ein/aus', en: 'Auto-accept on/off' }, action: { id: 'autoAccept' },
      show: (d, T) => ({ label: 'AUTO-ACCEPT', ...onOff(d.autoAccept, T) }) },
    ...TABS.map(([tab, name, short]) => ({
      id: `main:${tab}`, name: { de: `Öffnen: ${name.de}`, en: `Open: ${name.en}` }, action: { id: 'main', tab },
      show: (d, T, lang) => ({ label: 'FARMY', value: short[lang] || short.en, color: C.text }),
    })),
  ];

  const pick = (id) => list.find((b) => b.id === id) || list[0];

  function view(button, data, lang) {
    const T = L.txt(lang);
    if (!data) return { label: 'FARMY', value: '–', sub: T.off, color: C.dim, bar: null };
    return { sub: '', bar: null, ...button.show(data, T, lang) };
  }

  const api = { list, pick, view };
  if (typeof module !== 'undefined') module.exports = api;
  else window.FarmyButtons = api;
})();
