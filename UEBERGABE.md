# Übergabe Farmy (früher „All You Need“) – Stand 2026-11-05

Für den nächsten Claude, der hier weiter codet. Erst diese Datei, dann `CLAUDE.md` (Aufbau + Regeln) lesen.

## Was Farmy ist

League-of-Legends-Begleiter (Electron, Windows): Overlay im Spiel (OCR des HUD, Live-API Port 2999) und Hauptfenster
mit Wiki/Champions, Build & Runen, Live-Spiel, Verlauf, Fortschritt, Notizen, Spielersuche. Daten aus dem lokalen
League-Client (LCU, `src/client/lcu.js`), kein Riot-API-Key. Repo: `D:\lol-overlay`, Remote `github.com/JamyH/farmy`,
Branch `main`, Version 1.9.0. Website: `docs/` (GitHub Pages, jamyh.github.io/farmy).

## Arbeitsweise mit Jamy

- Antworten auf Deutsch, kurz und klar. Sichtbare Texte in der App über `t('…')`, englisch in `renderer/i18n.js`.
- **Committen/pushen nur, wenn Jamy darum bittet.** Gerade ist sehr viel *uncommittet* (siehe unten) – nichts
  verwerfen, kein `git checkout -- .`/`reset`.
- **Nach jeder Code-Änderung Farmy selbst neu starten**, nie Jamy darum bitten:
  - Läuft als Dev: `D:\lol-overlay\node_modules\electron\dist\electron.exe . --data-dir=D:\lol-overlay\userdata`
    (Arbeitsordner `D:\lol-overlay`).
  - Hauptprozess = `electron.exe`, dessen CommandLine **kein** `--type=` enthält (CommandLine endet mit Leerzeichen,
    Regex auf ` .$` trifft nicht → Neustart scheitert still an der Single-Instance-Sperre).
  - Stop-Process, dann Start-Process mit gleichen Argumenten; danach prüfen, dass CreationDate neu ist und die
    CommandLine das richtige `--data-dir` zeigt. Aus Git Bash Schrägstriche: `--data-dir=D:/lol-overlay/userdata`
    (Backslashes frisst bash → falscher, leerer Datenordner).
  - **Dev-Build läuft immer als Admin** (Jamy 2026-11-01, damit Rose sich beenden lässt), aber ohne UAC-Fenster:
    (Neu-)Start nur mit `schtasks /run /tn FarmyDevBuild`. Die geplante Aufgabe (höchste Rechte) führt
    `tools/dev-admin.ps1` aus: beendet ein laufendes Dev-Build und startet es mit `--data-dir=D:\lol-overlay\userdata`.
    Desktop-Verknüpfung „Farmy Dev“ ruft dasselbe auf. Nicht mehr per Start-/Stop-Process (kein Zugriff auf den
    Admin-Prozess, `-Verb RunAs` zeigt das UAC-Fenster, das Jamy nicht will). Das installierte Farmy bleibt ohne Admin.
    Prüfen: CreationDate der electron.exe neu, frische Zeitstempel in `userdata\` (CommandLine ist von außen leer).
    Aufgabe neu anlegen: `powershell -File tools\dev-admin.ps1 -Register` (fragt einmal nach Admin).
  - Auch während eines laufenden Spiels neu starten. `renderer/` lädt in Dev ohne Neustart neu.
- **Code ordentlich halten** (Jamy legt Wert darauf, ein Mensch soll das später warten können): Neues in das Modul
  seiner Aufgabe, nie in `main.js` anbauen; Datei > ~400 Zeilen oder zweite Aufgabe → erst aufteilen; neue Module
  mit Kopfkommentar + Zeile in `CLAUDE.md`; keine Kreis-requires (`npx madge --circular src main.js`).
- **UX/QOL ist Jamy sehr wichtig**: schnelles Ablesen im Spiel, wenig Scrollen, flache Navigation (eine Ebene),
  Spalten scrollen einzeln, Seitenwechsel immer über `showTab` (damit „Zurück“/Alt+←/Maus-Zurück funktioniert),
  Menüs/Auswahlen nicht schließen, wenn man etwas umstellt.
- Kein Design im „Hextech“-Stil (zu klobig); aktueller Look: fast schwarz, feine Goldlinien, Barlow Condensed.
- Den Nextcloud-Ordner (`D:\nextcloud\…`) nie anfassen – gehört nicht zu Farmy.
- Keine Aufgaben an Qwen / MCP `qwen-worker` abgeben.
- Neue Funktion → Eintrag in `CHANGELOG.md` unter „Unveröffentlicht“.

## Harte Regeln (Riot + Open Source) – Details in CLAUDE.md

- **Farmy bleibt kostenlos und Open Source (MIT), kein Abo (Jamy 2026-11-05).** 2.0 ist vorerst das Endprodukt.
- Riot: nur lesen, was der Spieler sieht; kein Speicherlesen, keine Gegner-Timer, keine MMR, keine
  Augment-Siegquoten; in Ranked versteckte Namen bleiben versteckt (kein Lobby-Reveal, keine Chat-Endpunkte).
  Die Lobby-Skill-Einschätzung bleibt, wird im Riot-Portal offengelegt.
- lolalytics + Phylaris-Jungle-Tabelle: auch in der gebauten App an (Jamy 2026-11-05, `src/data/sources.js`).
- Jeder neue Netzabruf → README, Abschnitt Datenquellen. Keine Schriften/Skripte/Bilder von Dritten laden.
- Rose-Begleiter (`src/main/rose.js`): nur FarmyDevBuild, steuert ein installiertes Rose nur an, injiziert nichts.
- Release-Build: `npm run dist` (Fuses, keine Verschleierung); kein `eval` im Fenster-Code.

## Aktueller Stand (alles uncommittet seit Commit 6c0ebe6)

Großer Umbau + neue Funktionen, siehe `CHANGELOG.md` „Unveröffentlicht“. Kurz:
- `main.js` aufgeteilt nach `src/main/`, `src/app|client|game|screen|data/`; Fenster-Code nach
  `renderer/main-window/` und `renderer/overlay/` (alte `renderer/stats.*`, `renderer/overlay.js`, `src/*.js` gelöscht
  bzw. verschoben – in git noch als „deleted“ + „untracked“ sichtbar).
- Neuer Look, eigene Stile (`src/main/themes.js`, `renderer/theme.js`, `renderer/themes/`).
- Champions-Wiki, Tierliste, Gegner-Panel, „Dein Team“, Premade-/Tilt-Tags im Live-Spiel, Arena im Fortschritt,
  Spiel-Archiv (`userdata/archive.jsonl`).
- Abo-Rückbau (2026-11-05): Farmy Plus, Lizenzprüfung, Kaufseite, Lizenzvertrag und Verschleierung sind entfernt,
  `LICENSE` wieder MIT. Der Stand davor liegt in `D:\AllYouNeed\Backup-vor-Open-Source-Rueckbau`.
- Rechtliches: Seite „Rechtliches“ (Lizenz, Quellcode, Quellen, Riot-Hinweis). Impressum und Datenschutz gibt es nicht,
  Farmy ist ein reines GitHub-Projekt (Jamy 2026-11-05); `tools/notices.js` erzeugt `legal/THIRD_PARTY_NOTICES.txt`.
- Overlay-Aufnahme-Schutz (`setContentProtection`) bewusst aus, damit das Overlay im Discord-Stream sichtbar ist
  (Begründung als Kommentar in `src/main/windows.js`).
- Skill „Schaden pro Leben“ (`dph` = `dmg / taken`, 2026-11-03) neben `dpd` in `progress.js` (Fortschritt, Letztes
  Spiel über EOG `TOTAL_DAMAGE_TAKEN`) und `lobbyskill.js` (Spielerprofil). Erlittener Schaden zählt Vasallen,
  Monster und Türme mit (Jungler wirken schlechter). Im Fenster noch nicht angesehen.
- Rose-Panel unter Devtools fertig; Jamy hat Rose noch nicht installiert → mit echter Installation noch nicht getestet.

## Offene Punkte (Vorschlag für die Reihenfolge)

1. **Abo-Rückbau**: erledigt 2026-11-05 (siehe oben), nichts committet.
2. **lolalytics-Runen**: geprüft 2026-11-05, kein Fehler. Alle 118 Build-Einträge im Cache und die Ahri-Seite haben 9 IDs.
   `runes: 0` vom 31.10. kam vermutlich vom Test ohne geladene Data-Dragon-Daten: dann gibt `parse()` `runes: null`.
3. **Arena 3x6**: behoben 2026-11-05 (Branch `fix/arena-live-zuordnung`, uncommittet). Rang/Tags gehen über die Riot-ID
   (`live.playerKeys()`), Champion nur als Ersatz, wenn er einmalig ist. Mit gestellten Daten getestet, nicht im echten Spiel.
4. **Rose** ist installiert (`D:\Rose`, Daten/Mods in `%LOCALAPPDATA%\Rose`). Pfaderkennung liest jetzt den
   Apps-Eintrag (Registry Uninstall → DisplayIcon). Start/Stop aus Farmy noch testen (Rose läuft mit
   Adminrechten, Farmy-Dev-Build deshalb jetzt auch). Jamy wollte Rose „komplett integrieren“ → abgeraten
   (Python + Pengu Loader + GPL-mod-tools, eigene Regel „Farmy injiziert nichts“), stattdessen enger angesteuert:
   Rose startet mit dem Dev-Build (Schalter „Mit Farmy starten“), Karte zeigt letzte Injection/Phase aus
   `%LOCALAPPDATA%\Rose\logs\rose_*.log` und `rose_diagnostics.txt`. Stand 01.11.: Der LTK-Patcher in Rose 1.4.9
   ist seit 29.10. abgelaufen. Workaround aus Rose-Issues #407/#411 eingespielt: Patcher-Dateien aus dem offiziellen
   LTK Manager 1.29.1 (entpackt, nicht installiert, signiert Natoken LLC) nach `D:\Rose\_internal\injection\tools`;
   Originale in `D:\tools\ltk-1.29.1-download\backup-rose-1.4.9-original`. Getestet 10:22: Skin kommt
   (Seelenblumen-Bard), Rose musste dafür nicht neu starten.
   Ein Rose-Update kann die Dateien wieder überschreiben.
   **RuneForge → Rose** (01.11.): Rose-Karte → „RuneForge öffnen (Mods laden)“; Downloads landen in
   `userdata\runeforge\` und werden direkt in Rose' Mods-Ordner importiert (`src/main/runeforge.js`, `rose-mods.js`).
   Erkennung gegen echte Mod-Seite (Guts/Aatrox) und Import gegen einen Test-Rose-Ordner getestet; ein echter
   Download aus dem Fenster und ob Rose den Mod in der Champ-Auswahl anbietet, steht noch aus.
   Jamy hat „Sion Kaido“ geladen: Import ok, aber das Spiel stürzte mit dem Mod in Schleife ab (alter Stand vom März,
   RuneForge sagt trotzdem „Working“). Mod liegt jetzt in `userdata\runeforge\deaktiviert`. Dafür `rose-guard.js`:
   erkennt die Schleife im Rose-Log, stoppt die Injection, nimmt den Mod aus Rose. Gegen das echte Log getestet,
   Bridge-Verbindung getestet; das eigentliche Stoppen und Verschieben im Ernstfall noch nicht.
5. **Nur Jamy**: Riot-Produktregistrierung (Skill-Score offenlegen).
6. Das Repo `JamyH/farmy` bleibt öffentlich, der geplante Umzug in ein privates Repo entfällt.
7. **Stream-Deck-Plugin** (2026-11-03, v0.2): `src/main/deck.js` (Brücke) + `streamdeck/com.jamyh.farmy.sdPlugin/`, per
   Verbindung in `%APPDATA%\Elgato\StreamDeck\Plugins` eingehängt. Aktionen Farmy-Wert (15 Werte), Farmy-Knopf
   (Overlay, Klick-durch, kompakt, Marke, Build, Auto-Accept, Reiter öffnen), Overlay-Regler; Profil „Farmy“ für
   Stream Deck + (kein automatischer Wechsel, auf Jamys Wunsch entfernt). Getestet: Brücke im Spiel (echte Werte), Aktion `adjust`, Abweisung
   ohne JSON-Kopf, Plugin verbunden, Profil installiert, alle Tastenbilder als Vorschau. Nicht getestet: Aussehen auf
   dem Gerät, Knöpfe vom Deck aus, Marken im Rückblick mit echtem Spiel.
   Jamys installierte Kopie des Profils (`ProfilesV3\47ACC840…`) hat statt der Overlay-Regler seine 4 Wave-Link-Regler
   (Lautstärke im Spiel); das Profil im Repo bleibt neutral. Ein neues Profil per Plugin-Update überschreibt das evtl.
   Offen: Verteilung an Nutzer (`.streamDeckPlugin` packen, z. B. Elgato-CLI `streamdeck pack`, Download auf der Website),
   vor dem Release im Riot-Portal melden. Item-Wert-Differenz bewusst nicht auf dem Deck (zeigt das Overlay nur bei Tab).
