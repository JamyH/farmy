// --- Rechtliches: Version, Lizenz/Quellcode/Datenschutz/Impressum, Riot-Hinweis, Quellen mit Lizenz, Fremd-Software.
// Erreichbar über Menü → „Über Farmy und Rechtliches“ und den Link unten im Fenster (src/main/legal.js) ---
// Riots Pflicht-Hinweis wörtlich auf Englisch (developer.riotgames.com/policies/general, „Legal“)
const RIOT_NOTICE = "Farmy isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone " +
  'officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are ' +
  'trademarks or registered trademarks of Riot Games, Inc.';

async function loadLegal() {
  const box = $('legal');
  const i = await window.lol.legalInfo();
  const link = (url, text) => `<a href="#" data-legal="${esc(url)}">${esc(text)}</a>`;
  box.innerHTML = `
    <div class="card legal-card">
      <h2>Farmy ${esc(i.version)}</h2>
      <p>${t('Kostenlose Open-Source-Software unter der MIT-Lizenz.')}</p>
      <div class="legal-links">${link(i.docs.license, t('Lizenz'))}${link(i.docs.source, t('Quellcode'))}${link(i.docs.privacy, t('Datenschutz'))}${link(i.docs.imprint, t('Impressum'))}</div>
      <p class="hint">${t('Farmy speichert deine Daten nur auf deinem PC. Kein Tracking, keine Werbung, keine Telemetrie.')}</p>
    </div>
    <div class="card legal-card">
      <h2>Riot Games</h2>
      <p>${esc(RIOT_NOTICE)}</p>
      <p class="hint">${t('Farmy liest und verändert keinen Spielspeicher, schleust nichts ins Spiel ein und sendet keine Eingaben.')}</p>
    </div>
    <div class="card legal-card">
      <h2>${t('Datenquellen')}</h2>
      <table class="legal-table">
        <tr><th>${t('Quelle')}</th><th>${t('Wofür')}</th><th>${t('Lizenz')}</th></tr>
        ${i.sources.map((s) => `<tr><td>${link(s.url, s.name)}${s.devOnly ? ' <span class="chip">nur FarmyDevBuild</span>' : ''}</td><td>${esc(t(s.use))}</td>` +
          `<td>${s.licenseUrl ? link(s.licenseUrl, s.license) : esc(s.license || '–')}</td></tr>`).join('')}
      </table>
    </div>
    <div class="card legal-card">
      <h2>${t('Software von Dritten')}</h2>
      <p>${t('Electron {v} und Chromium, tesseract.js und Tesseract-Sprachdaten (Apache 2.0), koffi (MIT), electron-updater (MIT), Schriften Barlow und Barlow Condensed (SIL Open Font License 1.1) und weitere Pakete.', { v: esc(i.electron) })}</p>
      <div class="btn-row"><button id="legalNotices">${t('Alle Lizenztexte öffnen')}</button></div>
    </div>`;
}

$('legal').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-legal]');
  if (a) {
    e.preventDefault();
    window.lol.legalOpen(a.dataset.legal);
  }
  if (e.target.closest('#legalNotices')) window.lol.legalNotices();
});
$('legalLink').addEventListener('click', (e) => {
  e.preventDefault();
  showTab('legal');
});
