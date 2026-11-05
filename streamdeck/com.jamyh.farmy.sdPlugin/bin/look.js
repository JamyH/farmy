// Aussehen der Tasten, gemeinsam für Werte (stats.js) und Knöpfe (buttons.js): Farben wie das Farmy-Icon,
// Texte Deutsch/Englisch und das Tastenbild als SVG. Genutzt vom Plugin und von den Einstellungsfeldern (window.FarmyLook)
(function () {
  // fast schwarz, Gold, Creme, Türkis; dazu Rot für Warnungen
  const C = { bg: '#061019', line: '#785A28', gold: '#C8AA6E', text: '#F0E6D2', dim: '#8A8F98', ok: '#0AC8B9', bad: '#E84057' };

  const TXT = {
    de: {
      off: 'Farmy aus', idle: 'kein Spiel', ready: 'BEREIT', noRead: 'Erkennung aus', noMana: 'NO MANA', target: 'Ziel',
      dead: 'tot', on: 'AN', offState: 'AUS', noItem: 'kein Aktiv-Item', firstClear: 'erste Runde', best: 'Best',
      wavesTo: 'Wellen bis {n}', max: 'MAX', onlyChamp: 'nur Champ-Wahl', runesItems: 'Runen + Items', press: 'drücken',
    },
    en: {
      off: 'Farmy off', idle: 'no game', ready: 'READY', noRead: 'reading off', noMana: 'NO MANA', target: 'goal',
      dead: 'dead', on: 'ON', offState: 'OFF', noItem: 'no active item', firstClear: 'first clear', best: 'best',
      wavesTo: 'waves to {n}', max: 'MAX', onlyChamp: 'in champ select', runesItems: 'runes + items', press: 'press',
    },
  };
  const txt = (lang) => TXT[lang] || TXT.en;

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
  const pct = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Tastenbild 144×144 aus { label, value, sub, color, bar (0–100 oder null) }: Beschriftung oben in Gold, Wert groß
  // in der Mitte, Zusatz unten, optional Balken
  // Schriftgröße, bei der text in die Breite passt (Bahnschrift: Versalien rund 0,58 × Größe breit)
  const fit = (text, width, max) => Math.min(max, Math.floor(width / (Math.max(String(text).length, 1) * 0.58)));

  function svg(v) {
    const value = String(v.value);
    const label = String(v.label).toUpperCase().slice(0, 14);
    const size = fit(value, 118, 56);
    const font = "font-family=\"Bahnschrift, 'Barlow Condensed', 'Arial Narrow', sans-serif\"";
    const bar = v.bar == null ? '' :
      `<rect x="16" y="124" width="112" height="6" fill="${C.line}"/><rect x="16" y="124" width="${Math.round(1.12 * v.bar)}" height="6" fill="${v.color === C.text ? C.gold : v.color}"/>`;
    // mit Zusatzzeile sitzt der Wert etwas höher, sonst mittig
    const valueY = (v.sub ? 86 : 94) + Math.round((size - 46) / 4);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
      + `<rect width="144" height="144" fill="${C.bg}"/>`
      + `<rect x="5" y="5" width="134" height="134" fill="none" stroke="${C.line}" stroke-width="2"/>`
      + `<text x="72" y="34" ${font} font-size="${fit(label, 118, 20)}" font-weight="600" fill="${C.gold}" text-anchor="middle" letter-spacing="1">${esc(label)}</text>`
      + `<text x="72" y="${valueY}" ${font} font-size="${size}" font-weight="700" fill="${v.color || C.text}" text-anchor="middle">${esc(value)}</text>`
      + (v.sub ? `<text x="72" y="${v.bar == null ? 120 : 116}" ${font} font-size="${fit(v.sub, 150, 17)}" fill="${C.dim}" text-anchor="middle">${esc(v.sub)}</text>` : '')
      + bar + '</svg>';
  }

  const api = { C, txt, mmss, pct, svg };
  if (typeof module !== 'undefined') module.exports = api;
  else window.FarmyLook = api;
})();
