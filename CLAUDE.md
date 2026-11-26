# Farmy – Hinweise für die Arbeit am Code

## Aufbau

| Wo | Was |
|---|---|
| `main.js` | Hauptprozess, nur Start und Verdrahtung (Datenordner, Instanz-Sperre, `register()`/`start()` der Module) |
| `src/main/` | Hauptprozess nach Aufgaben, siehe unten |
| `preload.js` | `window.lol`: alles, was die Fenster vom Hauptprozess bekommen |
| `src/app/` | App selbst: `config.js` (config.json, Overlay-Vorgaben, `moduleOn`), `main-window-data.js` (IPC fürs Hauptfenster ohne Spielzustand), `buildcheck.js` (Build-Check im Rückblick), Setup, Updater, Notizen |
| `src/client/` | League-Client (LCU): `lcu.js`, Historie, Archiv, Spielverläufe, Team-Scout, Lobby-Skill |
| `src/game/` | Laufendes Spiel (Live-API, Port 2999): Panel-Werte, Gegner-Team, Spielprotokoll, Clear-Zeit, Augments, Hinweise aus eigenen Spielen (`tips.js`) |
| `src/screen/` | Bildschirm lesen: Regionen, GDI-Ausschnitte, OCR, Ziffern, Minimap, Spielfenster, Tasten, Spieluhr-Absicherung (`clock.js`) |
| `src/data/` | Externe Daten: Data Dragon, lolalytics, Meraki, arammayhem, Jungle-Routen, Level-1–3-Duell; `sources.js`: welche Quelle erlaubt ist (an/aus) und ihre Lizenz |
| `renderer/overlay.html`, `overlay.css` + `renderer/overlay/` | Overlay im Spiel: `core` (Helfer), `overlays` (Jungle-Route, Augments, Scoreboard), `panel`, `mouse`, `settings` (⚙) |
| `renderer/main-window.html` + `renderer/main-window/` | Hauptfenster, ein Skript je Reiter |
| `renderer/i18n.js` | Texte Deutsch → Englisch, von Hauptprozess und Fenstern genutzt |
| `tools/` | Kalibrier- und Render-Helfer (`npx electron tools/…`); `notices.js` sammelt die Lizenztexte der Fremd-Software |
| `legal/` | `THIRD_PARTY_NOTICES.txt` (erzeugt von `tools/notices.js`) |
| `assets/tessdata/`, `renderer/fonts/` | Mitgelieferte OCR-Sprachdaten und Schriften: nichts davon wird aus dem Netz geladen |
| `streamdeck/com.jamyh.farmy.sdPlugin/` | Stream-Deck-Plugin (ohne Fremdpakete, Node 24), Aktionen Farmy-Wert / Farmy-Knopf / Overlay-Regler: `bin/plugin.js` (Verbindung, Abfrage jede Sekunde, Knöpfe), `bin/stats.js` (Werte), `bin/buttons.js` (Knöpfe), `bin/look.js` (Farben, Texte, Tastenbild); die drei auch von den Einstellungsfeldern `ui/*.html` + `ui/pi.js` genutzt. `profiles/Farmy.streamDeckProfile` erzeugt `streamdeck/make-profile.js` (danach Plugin-Version hochzählen). Nicht Teil des Farmy-Builds. Zum Testen per Verbindung (`mklink /J`) in `%APPDATA%\Elgato\StreamDeck\Plugins`, danach Stream Deck neu starten. Antwort-Format geändert → `VERSION` in `deck.js` und `plugin.js` gemeinsam hochzählen |

## Hauptprozess (`src/main/`)

| Datei | Aufgabe |
|---|---|
| `state.js` | Geteilter Zustand (`state.phase`, `gameMode`, `champion`, `data` …) und Ereignisse `refreshMenu()`, `balloon()` |
| `env.js` | `DEV`, Name, Icons, `DEBUG_DIR`/`writeDebug`, Dev-Schalter (`devFlag`) |
| `datadir.js` | `--data-dir` und Übernahme aus „All You Need“, läuft vor allem anderen |
| `windows.js` | Overlay (Klick-durch, Verschiebe-Modus, Einstellungen) und Hauptfenster, `toMainWindow`, `toOverlay` |
| `client.js` | Client-Abfrage alle 3 s, Verlauf importieren, Session, Auto-Accept |
| `wiki.js` | Reiter „Champions“: Champion-Liste nach Rolle, Fähigkeiten (Data Dragon + Meraki), Build je Lane (`wiki:*`) |
| `themes.js` | Stile: eingebauter Look (HUD, in `main-window.css`/`overlay.css`) und eigene aus `<Datenordner>/themes/`, Protokoll `farmy-theme://`, Untermenü „Stil“; angewendet in `renderer/theme.js` |
| `champselect.js` | Champ-Auswahl: Runen, Summoner, Item-Set, Matchup, Team, ARAM-Bank, IPC des Build-Reiters |
| `game.js` | Spiel-Abfrage (Live-API): Panel-Werte, Spielstart/-ende, Spielprotokoll, Live-Ränge |
| `deck.js` | Stream-Deck-Brücke (nur 127.0.0.1, Host-Prüfung, kein CORS, Aktionen nur mit JSON-Körper): `GET /stats` Panel-Werte (von `game.js` über `publish()`) + Session, Overlay-Stand, Auto-Accept; `POST /action` für die Knöpfe (`ACTIONS`). `config.deck.port` / `config.deck.enabled` |
| `hud.js` | Spielfenster, Lese-Regionen (`regions()`), Minimap, `toDip` |
| `screen-reader.js` | Bildschirm jede Sekunde lesen (`screenState`), Augment-Karten, Dev-Lese-Bereiche |
| `review.js` | Ulti ungenutzt und Death Recap fürs Spielprotokoll |
| `scoreboard.js` | Tastenabfrage im Spiel: Tab-Scoreboard, Jungle-Route, Tastenkürzel |
| `legal.js` | Seite „Rechtliches“ (`legal:*`), Schalter der Datenquellen fürs Hauptfenster (`app:sources`) |
| `rose.js` | FarmyDevBuild-Begleiter für Rose (Custom-Skin-Tool): finden (Apps-Eintrag), mit Farmy starten, beenden, Status, Mods-Ordner, letzte Injection + Phase aus Rose' Log, Rose' Fehlerdiagnose (`rose:*`). Nur Entwicklerversion, `register()`/`start()` tun sonst nichts |
| `runeforge.js` | FarmyDevBuild: RuneForge-Fenster (eigene Sitzung `persist:runeforge`); fängt *deine* Downloads ab, liest Kategorie/Champion/Skin von der offenen Mod-Seite und importiert über `rose-mods.js` (`runeforge:*`). Kein automatischer Abruf – RuneForges Nutzungsbedingungen verbieten Bots/Scraper |
| `rose-guard.js` | FarmyDevBuild: Absturz-Schutz – stürzt das Spiel nach einer Custom-Mod-Injection zweimal sofort ab (Rose-Log), Injection über Rose' Bridge stoppen (`stop-injection`) und den Mod nach `<Datenordner>\runeforge\deaktiviert` verschieben (`rose:deactivated`) |
| `rose-mods.js` | FarmyDevBuild: Mod-Archiv so in `%LOCALAPPDATA%\Rose\mods` ablegen wie Rose' eigener Import (Skins: Archiv + `rose_mod_targets.json`; Kategorien: entpackt per Windows-`tar` + `rose_category_mods.json`; `.modpkg` nur für Skins) |
| `hotkeys.js`, `tray.js`, `updates.js`, `dev.js` | Tastenkürzel, Tray-Menü, Update-Meldungen, Dev-Menü/Devtools-Seite/Fehler-Log |

Jedes Modul meldet seine IPC-Handler in `register()` an und startet seine Takte in `start()`; `main.js` ruft beides
auf. Den Zustand eines Moduls ändert nur das Modul selbst; was andere brauchen, steht in `state.js` (mit Vermerk,
wer schreibt) oder geht über eine exportierte Funktion. Tray und Meldungen nie direkt ansprechen, sondern über
`refreshMenu()` / `balloon()`.

## Fenster-Skripte (`renderer/main-window/`, `renderer/overlay/`)

Klassische Skripte mit gemeinsamem globalem Namensraum, Reihenfolge steht in `main-window.html` bzw. `overlay.html`. Hauptfenster:
`core.js` zuerst (Helfer wie `$`, `esc`, `t`), `app.js` zuletzt (Reiter, `showTab`, Start mit `loadAll()`).
Was beim Laden sofort läuft (Listener auf `window.lol.on…`, `.then` beim Start), darf nur Funktionen aus derselben
oder einer früheren Datei aufrufen.

Navigation: flache Seitenleiste in Gruppen (Spiel, Champions, Du), jeder Eintrag ein Klick zu seiner `<section>` in
`main-window.html`, `showTab(id)` öffnet sie. Mehrere Ansichten eines Eintrags (Champions: Nach Rolle / Tierliste)
stehen in `VIEWS` (app.js) und als Umschalter im Seitenkopf. Neue Seite: eigene Datei vor `app.js` eintragen, die
`<section>` und den Knopf in der passenden Gruppe anlegen, in `PAGES` Titel und Untertitel. Keine tieferen Ebenen.
`quick.js` ist die Schnellsuche (Strg+K), `nav.css` das Aussehen von Suchknopf, Unterseiten-Leiste und Schnellsuche.

## Regeln

- Dateien mit CRLF (git `core.autocrlf=true`); Kommentare und Texte auf Deutsch, sichtbare Texte über `t('…')` und
  die englische Fassung in `renderer/i18n.js`.
- Neue Funktion: Eintrag in `CHANGELOG.md` unter „Unveröffentlicht“.
- Riot-Regeln: nur lesen, was der Spieler ohnehin sieht; kein Speicherlesen, keine Gegner-Timer, keine MMR, keine
  Siegquoten für Augments, ranked versteckte Namen bleiben versteckt. Overlays zeigen Optionen, sie entscheiden nicht.
- Ordnung: Neues kommt in das Modul, dessen Aufgabe es ist, nie „schnell“ in `main.js`. Passt es nirgends hin, ein
  neues Modul mit Kopfkommentar (was es tut) anlegen und hier eintragen. Wächst eine Datei über ~400 Zeilen oder
  bekommt eine zweite Aufgabe, aufteilen, bevor weiter angebaut wird.
- Keine Kreis-`require`s (Prüfen: `npx madge --circular src main.js`); braucht ein unteres Modul etwas von oben,
  Ereignis über `state.js` statt `require`.
- Nach Änderungen außerhalb von `renderer/` die App neu starten (`renderer/` lädt in der Entwicklerversion sofort neu).

## Open Source: Regeln

Farmy ist kostenlos und Open Source (MIT), ohne Abo und ohne Bezahlfunktionen (Jamys Entscheidung vom 2026-11-05).
Der Quellcode bleibt öffentlich und lesbar. Daraus folgt:

- **Neue Datenquelle**: Eintrag in `src/data/sources.js` (mit Lizenz, erscheint unter „Rechtliches“), Abruf nur über
  `sources.need()`. lolalytics und die Jungle-Tabelle sind an (Jamys Entscheidung vom 2026-11-05).
- **Nichts aus dem Netz, was nicht nötig ist**: keine Schriften, Skripte oder Bilder von Dritten. Jeder neue Abruf
  gehört in die README (Abschnitt zu den Datenquellen) und in `docs/code-signing/index.html` (Privacy).
- **Riot-Regeln** (developer.riotgames.com/policies/general): Produkt registriert. Neue Funktionen vor dem Release im
  Developer Portal melden.
- **Keine Injection, kein Spiel-Verändern.** Der Rose-Begleiter (`src/main/rose.js`) steuert nur ein installiertes Rose
  an und läuft ausschließlich in FarmyDevBuild (`!app.isPackaged`). In der gebauten App nie – Skin-Injection würde die
  Riot-Freigabe kosten. Farmy selbst injiziert nichts und bündelt weder Rose noch Skins.
- **Neue Pakete** nur mit freizügiger Lizenz (MIT, BSD, ISC, Apache); vor dem Release `node tools/notices.js`.
- **Release-Build** auf GitHub: Tag `vX.Y.Z` pushen, `.github/workflows/build.yml` baut (`npm run dist`), signiert über
  SignPath und legt einen Release-Entwurf an; `tools/release-files.js` zieht `latest.yml` nach dem Signieren nach.
  Keine lokal gebauten Dateien mehr hochladen (SignPath verlangt den Build aus dem Quellcode). Der Code wird nicht
  verschleiert. Die gebaute App hat Electron Fuses (kein `ELECTRON_RUN_AS_NODE`, kein `--inspect`, Archiv-Prüfung).
