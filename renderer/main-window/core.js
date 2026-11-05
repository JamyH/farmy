const $ = (id) => document.getElementById(id);
i18n.setLang(window.lol.lang);
i18n.translatePage(document);
// Entwicklerversion: Name und lila Logo, damit man sie von der installierten App unterscheidet
if (window.lol.dev) {
  document.title = 'FarmyDevBuild';
  document.querySelector('.brand .logo').src = '../assets/icon-dev.png';
  document.querySelector('.brand span').textContent = 'FarmyDevBuild';
  // Meme: Klick aufs Logo legt 23× „Farmy“ in die Zwischenablage
  const logo = document.querySelector('.brand .logo');
  logo.style.cursor = 'pointer';
  logo.style.webkitAppRegion = 'no-drag'; // die Seitenleiste ist Zieh-Fläche fürs Fenster, dort kämen Klicks nicht an
  logo.title = '23× Farmy';
  logo.addEventListener('click', async () => {
    const name = document.querySelector('.brand span');
    try {
      await navigator.clipboard.writeText(Array(23).fill('Farmy').join(' '));
      name.textContent = '23× Farmy kopiert';
    } catch {
      name.textContent = 'Zwischenablage gesperrt';
    }
    setTimeout(() => (name.textContent = 'FarmyDevBuild'), 1500);
  });
}
const { t, num } = i18n;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v) => num(v);
const dec = (v, digits) => num(v, digits);
// Fehler aus dem Hauptprozess ohne den Electron-Vorspann; läuft der Client nicht, ein kurzer Satz
const errText = (e) => (e.message.includes(t('League-Client läuft nicht')) ? t('League-Client läuft nicht.')
  : e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
const dur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let ddVersion = null;
// ohne Champion (z. B. Übungspuppen im Practice Tool) ein Platzhalter statt eines kaputten Bildes
const champImg = (c) => (c && c.id
  ? `<img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${c.id}.png">`
  : '<span class="champ-ph" aria-hidden="true"></span>');
const itemsHtml = (ids) =>
  `<span class="items">${ids.filter((i) => i > 0)
    .map((i) => `<img src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${i}.png">`).join('')}</span>`;

const QUEUES = { 420: 'Solo/Duo', 440: 'Flex', 400: 'Normal Draft', 430: 'Normal Blind', 450: 'ARAM', 490: 'Quickplay', 1700: 'Arena', 1710: 'Arena', 1750: 'Arena 3x6', 1900: 'URF' };
