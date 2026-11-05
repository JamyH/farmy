// Updates (src/app/updater.js) im Tray: Menü-Eintrag je nach Stand und eine Meldung je neuer Version
const { t } = require('../../renderer/i18n');
const updater = require('../app/updater');
const { refreshMenu, balloon } = require('./state');

// fertig geladen -> neu starten; portable -> Release-Seite; sonst von Hand suchen
function menuItems() {
  const u = updater.state();
  if (u.status === 'ready') return [{ label: t('Neu starten und auf {version} aktualisieren', { version: u.version }), click: () => updater.apply() }];
  if (u.status === 'available') return [{ label: t('Version {version} herunterladen …', { version: u.version }), click: () => updater.apply() }];
  if (u.status === 'downloading') return [{ label: t('Lade Version {version} …', { version: u.version }), enabled: false }];
  return [{ label: t('Nach Updates suchen'), click: () => manualCheck().catch((e) => console.warn('Update-Suche:', e.message)) }];
}

// Von Hand gesucht: immer eine Antwort zeigen, auch wenn alles aktuell ist
async function manualCheck() {
  const r = await updater.checkNow();
  if (r.result === 'found' || r.result === 'ready') return; // Meldung kommt über changed, sobald geladen
  const text = {
    latest: [t('Farmy ist aktuell'), t('Du hast die neueste Version ({version}).', { version: r.version })],
    dev: [t('Entwicklerversion'), t('Updates gibt es nur für die installierte Version.')],
    error: [t('Update-Suche fehlgeschlagen'), t('GitHub nicht erreichbar. Später nochmal versuchen.')],
  }[r.result];
  balloon(text[0], text[1]);
}

// Meldung einmal je neuer Version, sobald sie fertig geladen (bzw. bei portable: verfügbar) ist
let notified = null;
function changed(u) {
  refreshMenu();
  if (notified === `${u.status}|${u.version}` || !['ready', 'available'].includes(u.status)) return;
  notified = `${u.status}|${u.version}`;
  balloon(
    t('Farmy {version} ist da', { version: u.version }),
    u.status === 'ready'
      ? t('Wird beim Beenden installiert. Sofort: Tray-Menü → „Neu starten und aktualisieren“.')
      : t('Die portable Version aktualisiert sich nicht selbst. Tray-Menü → herunterladen.'),
  );
}

const start = () => updater.start(changed);
// Dev „Update-Meldung testen“
function test() {
  notified = null;
  changed({ status: 'ready', version: '9.9.9' });
}

module.exports = { start, menuItems, test };
