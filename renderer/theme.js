// Eigener Stil: hängt im <head> nach den übrigen Stylesheets an, was src/main/themes.js meldet: Farben, Schrift,
// Hintergrund (nur Hauptfenster, das Overlay liegt über dem Spiel) und eigene main.css/overlay.css. Ohne eigenen
// Stil bleibt der eingebaute Look (HUD) aus main-window.css bzw. overlay.css. Beim Wechsel (Kanal „theme“) wird das
// Bisherige entfernt und der neue Stil angewendet, ohne das Fenster neu zu laden.
// Die CSP erlaubt kein <style>: Farben usw. kommen als CSS-Variablen an <html>, themes/eigen.css wendet sie an.
// data-window am Script-Tag: "main" (Hauptfenster) oder "overlay"
(function () {
  const overlay = document.currentScript.dataset.window === 'overlay';
  const root = document.documentElement;
  let links = [];
  let props = [];
  let face = null; // Schrift-Datei eines eigenen Stils

  const sheet = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
    links.push(link);
  };
  const prop = (name, value) => {
    root.style.setProperty(name, value);
    props.push(name);
  };

  function clear() {
    links.forEach((l) => l.remove());
    props.forEach((p) => root.style.removeProperty(p));
    links = [];
    props = [];
    if (face) document.fonts.delete(face);
    face = null;
    delete root.dataset.themeFont;
    delete root.dataset.themeBg;
  }

  function apply(th) {
    clear();
    th = th || {};
    if (!th.url) return;
    const bust = `?v=${th.v || 0}`;
    sheet('themes/eigen.css');
    for (const [k, v] of Object.entries({ ...th.colors, ...(overlay ? th.overlayColors : {}) })) prop(`--${k}`, v);
    // Schrift: Datei aus dem Stil-Ordner (FontFace statt @font-face, die CSP erlaubt kein <style>) oder installiert
    if (th.fontFile) {
      face = new FontFace('Farmy Eigen', `url("${th.url}${encodeURIComponent(th.fontFile)}${bust}")`);
      document.fonts.add(face);
      face.load().catch(() => {});
      prop('--theme-font', '"Farmy Eigen"');
      root.dataset.themeFont = '';
    } else if (th.font) {
      prop('--theme-font', `"${th.font}"`);
      root.dataset.themeFont = '';
    }
    if (th.background && !overlay) {
      prop('--theme-bg-image', `url("${th.url}${encodeURIComponent(th.background)}${bust}")`);
      prop('--theme-bg-dim', `rgba(0, 0, 0, ${th.backgroundDim})`);
      root.dataset.themeBg = '';
    }
    if (overlay ? th.overlayCss : th.mainCss) sheet(`${th.url}${overlay ? 'overlay' : 'main'}.css${bust}`);
  }

  if (!window.lol) return;
  apply(window.lol.theme);
  window.lol.onTheme(apply);
}());
