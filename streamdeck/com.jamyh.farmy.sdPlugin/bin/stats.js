// Welche Werte die Aktion „Farmy-Wert“ zeigen kann. Genutzt vom Plugin (plugin.js) und vom Einstellungsfeld
// (ui/stat.html, dort als window.FarmyStats)
(function () {
  const L = typeof module !== 'undefined' ? require('./look') : window.FarmyLook;
  const { C, txt, mmss, pct } = L;

  // Summoner D/F: Bildschirm-Erkennung liefert Bereit bzw. Restzeit; ohne Erkennung gibt es nichts
  function spell(slot) {
    return (d, T) => {
      const s = d.spells[slot];
      if (!s) return { label: slot, value: '–', sub: T.noRead };
      if (s.ready) return { label: s.name || slot, value: T.ready, color: C.ok };
      return { label: s.name || slot, value: s.cd == null ? '…' : `${s.cd}s`, color: C.bad };
    };
  }
  const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
  // Session-Ziel: wie im Panel (deaths = höchstens, sonst mindestens)
  const GOAL = { deaths: { de: 'TODE', en: 'DEATHS', digits: 0 }, csm: { de: 'CS/MIN', en: 'CS/MIN', digits: 1 },
    kda: { de: 'KDA', en: 'KDA', digits: 1 }, vision: { de: 'SICHT/MIN', en: 'VISION/MIN', digits: 1 } };

  // id, Name im Einstellungsfeld, label ohne Spiel, Anzeige aus den Farmy-Daten; always: auch ohne Spiel
  const list = [
    { id: 'csm', name: { de: 'CS pro Minute', en: 'CS per minute' }, label: 'CS/MIN', show: (d, T) => ({
      label: 'CS/MIN', value: d.csPerMin.toFixed(1), sub: d.csTarget ? `${T.target} ${d.csTarget}` : '',
      color: d.csTarget && d.gameTime >= 300 ? (d.csPerMin >= d.csTarget ? C.ok : C.bad) : C.text,
      bar: d.csTarget ? pct((d.csPerMin / d.csTarget) * 100) : null }) },
    { id: 'cs', name: { de: 'CS', en: 'CS' }, label: 'CS', show: (d) => ({
      label: 'CS', value: String(d.cs), sub: `${d.csPerMin.toFixed(1)}/min` }) },
    { id: 'kda', name: { de: 'KDA', en: 'KDA' }, label: 'KDA', show: (d) => ({
      label: 'KDA', value: d.kda, sub: d.kdaRatio.toFixed(2) }) },
    { id: 'gold', name: { de: 'Gold', en: 'Gold' }, label: 'GOLD', show: (d) => ({
      label: 'GOLD', value: String(d.gold), color: C.gold }) },
    { id: 'level', name: { de: 'Level und XP', en: 'Level and XP' }, label: 'LEVEL', show: (d) => ({
      label: 'LEVEL', value: String(d.level), sub: d.xpPercent == null ? '' : `${d.xpPercent} % XP`, bar: d.xpPercent }) },
    { id: 'xp', name: { de: 'Wellen bis Level-up', en: 'Waves to level up' }, label: 'LEVEL-UP', show: (d, T) => (d.level >= 18
      ? { label: 'LEVEL-UP', value: T.max, color: C.gold }
      : { label: 'LEVEL-UP', value: d.xpWaves == null ? '–' : d.xpWaves.toFixed(1), sub: T.wavesTo.replace('{n}', d.level + 1),
        color: d.xpWaves != null && d.xpWaves <= 1 ? C.ok : C.text, bar: d.xpPercent }) },
    { id: 'vision', name: { de: 'Sichtwert', en: 'Vision score' }, label: { de: 'SICHT', en: 'VISION' }, show: (d) => ({
      value: String(d.vision), sub: `${d.visionPerMin}/min` }) },
    { id: 'mana', name: { de: 'Mana (Warnung)', en: 'Mana (warning)' }, label: 'MANA', show: (d, T) => (d.mana
      ? { value: `${d.mana.percent}%`, sub: d.mana.low ? T.noMana : '', color: d.mana.low ? C.bad : C.text, bar: d.mana.percent }
      : { value: '–' }) },
    { id: 'spellD', name: { de: 'Summoner D', en: 'Summoner D' }, label: 'D', show: spell('D') },
    { id: 'spellF', name: { de: 'Summoner F', en: 'Summoner F' }, label: 'F', show: spell('F') },
    { id: 'item', name: { de: 'Aktiv-Item (Zhonya, QSS …)', en: 'Active item (Zhonya, QSS …)' }, label: 'ITEM', show: (d, T) => {
      const it = (d.items || [])[0];
      if (!it) return { value: '–', sub: T.noItem };
      // nur das erste Wort passt auf die Taste („Zhonyas Stundenglas“ → „Zhonyas“)
      return { label: it.name.split(/\s+/)[0], value: it.ready ? T.ready : `${it.cd}s`, sub: `[${it.key}]`, color: it.ready ? C.ok : C.bad };
    } },
    { id: 'goal', name: { de: 'Session-Ziel', en: 'Session goal' }, label: { de: 'ZIEL', en: 'GOAL' }, show: (d, T) => {
      const g = d.goal;
      if (!g) return { value: '–' };
      const k = GOAL[g.key] || GOAL.csm;
      return { value: g.now.toFixed(k.digits), sub: `${g.key === 'deaths' ? '≤' : '≥'} ${g.target} ${k[T === txt('de') ? 'de' : 'en']}`,
        color: g.early ? C.text : g.ok ? C.ok : C.bad };
    } },
    { id: 'clear', name: { de: 'Jungle-Clear-Zeit', en: 'Jungle clear time' }, label: 'CLEAR', show: (d, T) => (d.clear
      ? { value: mmss(d.clear.time), sub: d.clear.best ? `${T.best} ${mmss(d.clear.best)}` : '',
        color: d.clear.best && d.clear.time <= d.clear.best ? C.ok : C.text }
      : { value: '–', sub: T.firstClear }) },
    { id: 'time', name: { de: 'Spielzeit', en: 'Game time' }, label: { de: 'ZEIT', en: 'TIME' }, show: (d, T) => ({
      value: mmss(d.gameTime), sub: d.dead ? T.dead : '' }) },
    { id: 'session', name: { de: 'Heute (Siege, LP)', en: 'Today (wins, LP)' }, label: { de: 'HEUTE', en: 'TODAY' }, always: true,
      show: (d) => {
        const s = d.session;
        if (!s) return { value: '–' };
        const lp = s.lp && (s.lp.solo != null ? s.lp.solo : s.lp.flex);
        return { value: `${s.wins}–${s.losses}`, sub: lp == null ? '' : `${signed(lp)} LP`,
          color: s.wins > s.losses ? C.ok : s.losses > s.wins ? C.bad : C.text };
      } },
  ];

  const pick = (id) => list.find((s) => s.id === id) || list[0];
  const labelOf = (stat, lang) => (typeof stat.label === 'string' ? stat.label : stat.label[lang] || stat.label.en);

  // Anzeige einer Taste: { label, value, sub, color, bar }
  function view(stat, data, lang) {
    const T = txt(lang);
    const label = labelOf(stat, lang);
    if (!data) return { label, value: '–', sub: T.off, color: C.dim, bar: null };
    if (!data.inGame && !stat.always) return { label, value: '–', sub: T.idle, color: C.dim, bar: null };
    return { label, sub: '', color: C.text, bar: null, ...stat.show(data, T) };
  }

  const api = { list, pick, view };
  if (typeof module !== 'undefined') module.exports = api;
  else window.FarmyStats = api;
})();
