# Changelog

## 2.0.0 – 2026-11-05

Neu
- Stream Deck: eigenes Farmy-Plugin mit drei Aktionen
  - „Farmy-Wert“ zeigt auf einer Taste oder einem Drehregler einen Wert: CS/min mit Ziel, CS, KDA, Gold, Level mit XP,
    Wellen bis zum Level-up, Sichtwert, Mana-Warnung, Summoner D/F und Aktiv-Item (Zhonya, QSS …) mit Restzeit,
    Session-Ziel, Jungle-Clear-Zeit mit Bestzeit, Spielzeit sowie „Heute“ (Siege–Niederlagen, LP, auch ohne Spiel).
    Drücken oder Drehen wechselt den Wert
  - „Farmy-Knopf“: Overlay ein/aus, Klick-durch, Panel kompakt, Moment markieren, Build übernehmen (eigene Runen +
    Item-Set in der Champ-Auswahl), Auto-Accept ein/aus, Hauptfenster auf einem Reiter öffnen. Die Taste zeigt den Stand
  - „Overlay-Regler“: Drehregler für Overlay-Größe bzw. Hintergrund-Transparenz, Drücken wechselt zwischen beiden
  - Mitgeliefertes Profil „Farmy“ (Stream Deck +) mit fertiger Belegung, zum selbst Auswählen
  - „Moment markieren“ setzt eine Marke ins Spielprotokoll; der Rückblick unter „Letztes Spiel“ zeigt „Markiert bei …“
  Farmy gibt Werte und Knöpfe dafür nur auf diesem PC frei (127.0.0.1, Port 47101, in config.json unter „deck“
  änderbar oder abschaltbar); das Stream Deck bekommt ein neues Bild nur, wenn sich der Wert ändert
- Fortschritt, Spielerprofil und Letztes Spiel: neuer Skill-Bereich „Schaden pro Leben“ (Schaden an Champions geteilt
  durch erlittenen Schaden). Wie „Schaden pro Tod“, zählt aber auch Trades ohne Tod und wie viel Leben ein Tod gekostet hat
- Neuer Look für Hauptfenster und Overlay, angelehnt an die Anzeigen im Spiel: fast schwarz, feine Goldlinien, eckig,
  Titel, Menü und Labels in schmalen Versalien (Barlow Condensed), große Zahlen. Gold nur für Aktives und Empfohlenes,
  Sieg/Niederlage in Blau/Rot wie die Teams im Spiel
- Eigene Stile (Menü → Stil oder „Stil“ in der Seitenleiste): „Eigene Stile öffnen …“ legt ein
  Beispiel an; eine theme.json mit Farben, einer Schrift-Datei aus dem Ordner oder einer installierten Schrift (nichts
  aus dem Netz) und Hintergrundbild reicht, wer will, schreibt eigenes CSS dazu. Änderungen am aktiven Stil sind sofort
  zu sehen. Gewechselt wird live ohne Neuladen; die Auswahl in der Seitenleiste bleibt beim Durchklicken offen
- Reiter „Champions“ (ganz oben im Hauptfenster): kleines Wiki zum Nachschlagen, auch während des Spiels. Alle
  Champions als Icons nach Rolle sortiert (Filter Top/Jungle/Mid/Bot/Support, Suche, Enter öffnet den ersten Treffer);
  im laufenden Spiel stehen die Champions der Partie oben, Gegner rot umrandet. Klick zeigt Summoner, Runen,
  Start-Items, Build und Skill-Reihenfolge je Lane oder ARAM (lolalytics.com, ohne Siegquoten) sowie alle Fähigkeiten
  mit Beschreibung, Abklingzeit, Kosten und Werten je Rang samt Skalierungen (Meraki Analytics). Auf schnelles Ablesen
  gebaut: Liste und Champion füllen das Fenster und scrollen jeweils für sich, der Build steht kompakt als Icons (Name
  beim Drüberfahren), die Fähigkeiten als Reiter P Q W E R, umschaltbar per Klick oder Taste
- Reiter „Tierliste“: stärkste Champions je Lane (Top, Jungle, Mid, ADC, Support) und im ARAM von lolalytics.com
  (Emerald+, aktueller Patch) mit Tier, Siegquote, Pickrate, Bannrate und Spielen, sortierbar per Klick auf die
  Spalte. Suche nach Champion (findet auch Off-Meta-Picks der Lane), Spalte „Du“ mit deinen eigenen Spielen und
  Siegquote, Filter „Nur meine Champs“. Klick auf einen Champion öffnet „Build & Runen“
- Panel „Gegner“ (Kluft und ARAM, im ⚙ abschaltbar): wie viel magischer bzw. körperlicher Schaden vom gegnerischen
  Team kommt, ob es viel CC hat und wer stark heilt, dazu bis zu drei Item-Optionen dagegen, passend zu deinem
  Spielstil (Magier, körperlicher Schaden, Tank) – z. B. Merkurs Schuhe, Naturgewalt, Dornenpanzer. Grundlage sind
  Riots Champion-Daten aus dem Client, angepasst an die Items, die die Gegner gerade tragen. Farmy zeigt nur
  Optionen und kauft nichts
- „Dein Team“ in der Champ-Auswahl (Reiter „Build & Runen“): je Mitspieler Solo/Duo-Rang, Form der letzten Spiele
  (Siege/Niederlagen, Serie), Hauptrolle mit Hinweis, wenn er die zugeteilte Rolle selten spielt, meistgespielte
  Champions, wie oft er seinen Pick zuletzt gespielt hat, und die Skill-Einschätzung gegen seine Lobbys. Namen führen
  zum Profil. In Ranked verborgene Namen bleiben verborgen (kein Lobby-Reveal)
- Live-Spiel: Hinweise unter jedem Spieler. **Premade/Duo** (gleiche Farbe = gleiche Gruppe, erkannt an mindestens
  2 gemeinsamen Spielen auf derselben Seite in den letzten Spielen, Maus drauf zeigt mit wem), Sieges- oder
  Niederlagenserie ab 3, OTP, „5× auf dem Champ“, „neu auf dem Champ“ (nicht in ARAM/Arena) und „Smurf?“ (Level
  unter 60 mit 70 % Siegen). Funktioniert auch in Arena 3x6
- Arena im Fortschritt: eigener Modus „Arena“ (alle Varianten, auch 3x6) mit Skill-Bereich Platzierung, Karte
  „Platzierungen“ (wie oft welcher Platz, Ø Platz, obere Hälfte) und „Augments“ (deine häufigsten mit Ø Platz). Farmy
  merkt sich je Arena-Spiel Platzierung und Augments; ältere Arena-Spiele werden ergänzt
- Spiel-Archiv: Der Client gibt je Spieler nur die letzten 20 Spiele heraus. Farmy merkt sich jetzt jedes Spiel, das
  es lädt (eigene Spiele, Spielersuche, Skill-Einschätzung, Dein Team), mit allen 10 Spielern. Profile und „Dein Team“
  zeigen dadurch mit der Zeit mehr Spiele (bis 100, ältere nach Klick auf „Alle … Spiele zeigen“), die
  Skill-Einschätzung wird genauer. Gespeichert in archive.jsonl, höchstens 6000 Spiele (~30 MB)
- Fortschritt: neuer Skill-Bereich „Schaden pro Tod“ („Good Death“: hat sich dein Sterben gelohnt?), mit Verlauf,
  Tipp und Vergleich wie die anderen Bereiche; bisher nur im Spielerprofil
- Drei Builds statt einem: das Item-Set „Farmy – Champ“ im Shop und die Build-Seite zeigen neben dem
  lolalytics-Build auch „Meistgespielt“, „Höchste Siegrate“ und eine Alternative (je mit „Übernehmen“)

Geändert
- Das Overlay ist jetzt in Bildschirmaufnahmen sichtbar (Discord-Stream, OBS, Screenshots); der Aufnahme-Schutz
  ist aus. Leg das Panel nicht über die abgelesenen HUD-Felder (CS, Gold, Spielzeit), sonst kann die Erkennung gestört werden
- Das Stats-Fenster ist jetzt einfach das Hauptfenster von Farmy: Tray-Menü „Farmy öffnen“, gleiches Tastenkürzel
  (Strg+Shift+S). Bestehende Einstellungen werden beim ersten Start übernommen
- Seitenleiste des Hauptfensters in Gruppen geordnet: Spiel (Live-Spiel, Letztes Spiel), Champions (Champions,
  Build & Runen), Du (Verlauf, Fortschritt, Notizen, Spieler). Die Tierliste ist jetzt eine Ansicht von „Champions“
  (oben umschaltbar: Nach Rolle / Tierliste); Klick in der Tierliste öffnet den Champion mit dem Build für diese Lane.
  Neu: Schnellsuche mit Strg+K oder „Suchen“ in der Seitenleiste, findet Champions und Spieler (Name#Tag, zuletzt
  gesuchte). „Zurück“ wie im Browser (Knopf oben, Maustaste „Zurück“, Alt+←), z. B. nach „In Build & Runen öffnen“
  wieder zum Champion
- Farmy bleibt kostenlos und Open Source (MIT). Neue Seite „Rechtliches“ (Menü → „Über Farmy und Rechtliches“, Link
  unten im Hauptfenster): Lizenz, Quellcode, Riot-Hinweis, Datenquellen mit Lizenz und die
  Lizenztexte aller mitgelieferten Fremd-Software
- Datenschutz: Schriften und die Sprachdaten der Texterkennung liegen jetzt bei, nichts davon wird mehr aus dem
  Internet geladen (bisher Google Fonts und jsDelivr). Eigene Stile nehmen eine Schrift-Datei aus ihrem Ordner oder
  eine installierte Schrift
- Electron 44.10 (vorher 33, ohne Sicherheitsupdates; 44.10 enthält den Schutz vor den kompromittierten
  eMudhra-Zertifikaten). Die gebaute App lässt sich nicht mehr als Node-Umgebung starten, weist ein verändertes
  App-Archiv ab (Electron Fuses)

Behoben
- Live-Spiel: Spielten mehrere denselben Champion (Arena 3x6), konnten Rang und Hinweise beim falschen Spieler stehen.
  Zugeordnet wird jetzt über die Riot-ID
- Live-Spiel: Champion-Bild fehlte, wenn ein Skin-Tool wie Rose den Champion-Namen umschreibt
  („rose_character_displayname_…“); betraf auch Overlay-Werte zum eigenen Champ (Fähigkeiten, Build, Clears)
- Letztes Spiel: War das Hauptfenster beim Spielende schon offen, blieb „Keine Endspiel-Daten“ stehen, bis man
  „Neu laden“ drückte. Jetzt lädt die Auswertung bei Spielende von selbst und das Fenster wechselt von „Live-Spiel“ dorthin
- Eine beschädigte config.json ließ Farmy beim Start ohne Meldung abstürzen; jetzt wird sie als
  config.kaputt-….json beiseitegelegt und Farmy startet mit den Standardwerten. Das Fehler-Log (debug/error.log)
  wächst nicht mehr unbegrenzt (höchstens 1 MB)
- Spielzeit per OCR (Dev-Schalter): Eine 6 an der Minutenstelle wurde nicht gelesen, die Uhr blieb dann eine Minute
  lang stehen (im Spiel-Log fehlten die Minuten 6, 16, 26, 36); ein als 1 gelesener Doppelpunkt machte aus 4:15
  plötzlich 41:15. Farmy übernimmt eine Lesung jetzt nur, wenn sie zur weiterlaufenden Uhr und zur Live-API passt, und
  zählt dazwischen selbst weiter
- Item-Sets kamen nicht mehr in den Client: Alle Sets zusammen waren größer als die 64 KB, die der Client annimmt
  (Fehler 413). Wird es zu viel, löscht Farmy jetzt seine ältesten eigenen Sets (zuerst die alten „All You Need“-Sets),
  fremde Sets bleiben
- Skill-Einschätzung im Spielerprofil: wählt die Map (Kluft/ARAM) nach nutzbaren Spielen; Spiele gegen Bots ließen
  sie sonst oft ohne Wert
- Rang anderer Spieler: Der Client meldet bei ihnen immer 0 Niederlagen, Farmy zeigte deshalb 100 % Siegquote. Jetzt
  steht dort nur die Zahl der Siege

## 1.9.0 – 2026-10-29

Neu
- Fortschritt nach Modus getrennt (Kluft gesamt, Solo/Duo, Flex, Normal, Swiftplay, ARAM, ARAM Mayhem) und auf der
  Kluft nach Rolle (Top, Jungle, Mid, ADC, Support). Rolle ab jetzt aus dem Spiel; ältere Spiele laut Client
- Wochenbericht: diese Woche gegen letzte Woche (Spiele, Siegquote, KDA, CS/min, Tode), Champ der Woche, LP seit Montag
- Wann du stirbst: Tode je 10 Minuten in jeder Spielphase, aus den Spielverläufen des Clients (auch rückwirkend),
  dazu Schadensart je Phase (Death Recap) und Gold beim Tod
- Gold beim Tod: Farmy misst live, wie viel Gold du beim Sterben in der Tasche hattest (Rückblick und Fortschritt)
- Lane-Duell (Kluft): CS-, Gold- und Level-Differenz zu deinem Lane-Gegner bei 10 und 15 Minuten, je Spiel im
  Rückblick und als Trend im Fortschritt. Nur bei eindeutigem Gegner (ab jetzt aus dem Spiel gemerkt)
- Rückblick: Zeitpunkte deiner Tode und ein Spiel-Tagebuch „Was nehme ich mit?“, das datiert in den Notizen des
  Champions landet (dort einzeln löschbar)
- Fortschritt zeigt alle Modi, auch ohne Spiele (ausgegraut mit 0), und startet im Modus mit genug Spielen für die
  Skill-Verläufe; ältere gemerkte Spiele bekommen fehlende Werte (Objectives, Sicht …) aus den Spieldetails des Clients
- ARAM: Farmen und Sicht werden dort nicht mehr bewertet (kein sinnvoller Maßstab), eigener Tipp fürs Überleben
- Fortschritt, Ausbau nach Mobalytics-Vorbild (nur eigene Spiele): Zeitraum (letzte 20/50/alle), neuer Skill
  Aggression, Skill-Profil „davor → zuletzt“, Skill-Details per Klick (woraus der Wert besteht, bestes und schwächstes
  Spiel, Verlauf je Spiel), Siege gegen Niederlagen, Gegen wen du verlierst (Siegquote gegen gegnerische Champions),
  Nach Niederlagen (Siegquote im Folgespiel, Hinweis nach 2 Niederlagen am Stück), Champion-Profil per Klick im Pool,
  Vielseitigkeit, Rekorde (bestes Spiel je Wert, längste Siegesserie) und Ziel-Verlauf (frühere Session-Ziele)
- Skill-Profil als Netzdiagramm (wie das Skill-Hexagon bei Mobalytics): je Skill eine Ecke, Fläche = zuletzt,
  gestrichelt = davor, Werte an den Ecken; die Balken daneben bleiben als genaue Ablesung
- Skill-Vergleich und Netzdiagramm schon ab 6 Spielen je Modus (neuere Hälfte gegen ältere, mit Hinweis „noch
  ungenau“); ab 15 Spielen wie bisher die letzten 10 gegen den Rest
- Fortschritt Runde 3, aus den Spielverläufen des Clients: Wo du stirbst (Tode als Punkte auf einer schematischen
  Karte, Anteil je Zone), Wer dich tötet (häufigste Killer, Tode gegen 2+ Gegner, Solo-Kills gegen Solo-Tode),
  neuer Skill Teamplay (Kill-Beteiligung), Anteile im Team (Schaden, Gold, Tode), Vorsprung und Comeback (Team-Gold
  bei 15 bzw. 10 min gegen das Ergebnis), Level 6 (Kluft), Objective-Beteiligung, Ermüdung (KDA und Tode nach
  Spiel-Nr. in der Session), Lernkurve (n-tes Spiel auf einem Champion), Monatsvergleich und ein Trainingsplan mit
  2–3 Aufgaben aus deinen Schwächen, den Farmy nach jedem Spiel selbst auswertet
- Jungle-Bereich im Fortschritt (Spiele mit Smite; gegnerischer Jungler = Gegner mit Smite, auch rückwirkend):
  Jungler-Duell (CS/Level/XP/Gold bei 5/10/15 min), Konter-Jungling (geschätzt, der Client zählt es nicht mehr),
  Präsenz auf der Karte (Minuten 2–14 je Zone, Siege gegen Niederlagen), Ganks je Lane und – für neue Spiele mit
  gemerkten Rollen – nach Lane-Stand, Objective-Entscheidungen (wo du warst, tot, Trade, umkämpft), Startseite und
  Pfad, tote Zeit, frühe Wirkung, Jungle-Tode. Farmy merkt sich dafür im Spiel die Rollen aller 10 Spieler
- „Dein Plan“ in „Build & Runen“: Notiz, zuletzt Gelerntes zum Champion, Session-Ziel, Fokus und die Lane-Einschätzung
  gegen die gegnerischen Picks auf einen Blick
- Website und README: neuer Abschnitt „Besser werden mit deinen eigenen Spielen“ mit Bildern von Fortschritt,
  Todes-Karte, Rückblick und Jungle-Bereich
- Neuer Reiter „Spieler“: Spieler deiner Region per Riot-ID suchen (Rang in Solo/Duo und Flex, meistgespielte
  Champions, letzte 20 Spiele), über den League-Client, ohne Riot-API-Schlüssel. Zuletzt gesuchte bleiben gemerkt
- Spieler anklicken: Namen im Live-Spiel, im letzten Spiel und in aufgeklappten Spielen öffnen das Profil; Spiele im
  Verlauf und im Profil klappen per Klick auf und zeigen beide Teams mit allen 10 Spielern
- Skill-Einschätzung im Spielerprofil als Netzdiagramm: je Spiel gegen die anderen 9 Spieler derselben Lobby
  gewertet (50 = Lobby-Schnitt), mit Kämpfen, Aggression, Teamplay, Überleben, Schaden, Schaden pro Tod und auf der
  Kluft Farmen, Sicht und Objectives
- Overlay-Farben im ⚙ einstellbar: Hintergrund, Akzent, Text, Gold und Warnung, mit „Farben zurücksetzen“

Behoben und aufgeräumt
- Tab in einem anderen Fenster (z. B. Discord) löst keine Scoreboard-Suche mehr aus
- Overlay schreibt Texte nur noch bei Änderungen neu und baut das Scoreboard nur bei neuen Werten neu auf
- Alte Stream-Aufnahme entfernt, kleinerer Installer (Tesseract-Browserdateien nicht mehr dabei)
- Fehler-Log stürzt bei voller Platte nicht mehr ab

## 1.8.1 – 2026-10-27

Behoben
- Live-Spiel: fehlendes Champion-Bild, wenn die Live-API den Namen im Format „Character_Aatrox_Name“ liefert
- Session in der Seitenleiste stand auf drei Zeilen; auf Englisch jetzt „W/L“ statt „S/N“
- Fortschritt: „1 Spiel“ statt „1 Spiele“, „4+“ statt „4.+“, durchgehende Linien im Champion-Pool; im ARAM keine
  CS- und Sicht-Ziele mehr als Session-Ziel (dort nicht sinnvoll)

## 1.8.0 – 2026-10-27

Neu
- Rollen-Quest unter dem Champion-Namen im Panel (Prozent und schmaler Balken): gelesen aus dem Ring um das
  Quest-Symbol neben den Items (Anteil des türkisen Bogens)
- Ward-Cooldown als Kachel neben Summonern und Items (Trinket-Bild, Taste 4, Restzeit bzw. „bereit“)
- Beides nur auf Summoner's Rift und einzeln abschaltbar im ⚙
- CS-Ziel im CS-Feld („6,1/min · Ziel 7,4“, ab Minute 5 grün/rot): dein Schnitt auf dem Champ aus der eigenen
  Historie (ab 3 Spielen), sonst 8/min
- Erste Runde im Jungle: Farmy schätzt das Ende der ersten Runde aus deinen CS (danach 20 s ohne neue CS), zeigt
  es eine Weile unter dem Namen („3:16 · 24 CS · Bestzeit 3:05“) und merkt es sich je Champ (userdata/clears.json);
  die Jungle-Karte in der Champ-Auswahl zeigt zuletzt/beste/Ø
- Lane-Stand für Jungler (Gank-Priorität): je Lane Item-Wert-Differenz, Kills und Level gegen den Gegner, wie im
  Tab-Scoreboard; keine Siegquoten im Spiel, keine Empfehlung
- Deine besten Champs: in der Champ-Auswahl Top 3 für die zugeteilte Rolle aus deinen eigenen Spielen
- Session: in der Seitenleiste des Stats-Fensters „Heute 3S 1N · Solo +18 LP“; nach 3 Niederlagen am Stück ein
  Hinweis im Tray
- Eigene Spielhistorie speichert jetzt auch K/D/A, CS, Dauer, Queue und Lane, dazu Sicht, Schaden, Gold und
  erlittenen Schaden
- Neuer Reiter „Fortschritt“ im Stats-Fenster (Kluft und ARAM getrennt, ab 15 Spielen): Skill-Bereiche Farmen,
  Kämpfen, Überleben, Sicht und Schaden – deine letzten 10 Spiele gegen deinen eigenen Schnitt davor, mit Verlauf;
  dein Fokus mit einem Tipp; Siegquote nach Spiel-Nr. am Tag, Tageszeit und Spiellänge; Champion-Pool. Nur deine
  eigenen Spiele, kein Vergleich mit anderen Spielern. Dazu Objectives (Kluft) und Konstanz (Schwankung der KDA)
- Rückblick in „Letztes Spiel“: was gut lief und was das Spiel gekostet hat (gegen deinen Schnitt auf derselben
  Map), was du zuerst verbessern kannst, Rekorde und Top-10-%-Werte als Abzeichen
- Spielprotokoll (Modul „Rückblick: Tode und Ulti mitlesen“): Farmy merkt sich je Spiel CS bei 10 min gegen die
  mögliche CS, die Schadensarten deiner Tode aus dem Death Recap und wie lange deine Ulti bereit und ungenutzt war
- Session-Ziel wie eine Challenge: im Reiter „Fortschritt“ aus Vorschlägen wählen (z. B. „Höchstens 5 Tode“),
  im Spiel als Zeile im Panel, nach dem Spiel abgehakt, mit Quote und Serie
- LP-Verlauf (Solo/Duo, sonst Flex) als Kurve im Reiter „Fortschritt“
- Neuer Reiter „Notizen“: eigene Notizen je Champion und eine allgemeine, nur lokal gespeichert
  (userdata/notes.json), Auto-Speichern beim Tippen, Löschen mit Nachfrage; in „Build & Runen“ steht die Notiz
  zum gewählten Champion

Behoben
- Hexflash (Rune) statt Blitz: kaputtes Symbol im Panel und Cooldown blieb auf 0 hängen. Jetzt mit dem Bild der
  Rune, und das blau-lila Symbol zählt nicht mehr als Cooldown
- Verschiebe-Modus (Strg+Shift+E) fing die Maus auf dem ganzen Bildschirm ab: Im Spiel ließ sich nicht mehr laufen.
  Jetzt fängt er nur über dem Panel, überall sonst gehen Klicks ans Spiel
- Augment-Namen lesen konnte abbrechen, wenn die Texterkennung genau in dem Moment nach einer Minute Leerlauf
  entladen wurde (Fehler „postMessage“ im Log). Entladen wartet jetzt, bis nichts mehr gelesen wird

Entwicklerversion (FarmyDevBuild, nicht in den Releases)
- Eigener Name und lila Icon, DEV-Plakette im Panel, Seite „Devtools“ im Stats-Fenster und Tray → Dev
- Lese-Bereiche (Strg+Shift+D): lila Rahmen mit erkanntem Wert über allem, was Farmy liest, inkl. Ward und Quest
- Spielzeit per OCR (Tray → Dev bzw. Devtools-Seite, Standard aus): liest die Uhr oben rechts vom Bildschirm und
  verwirft dafür bewusst die Zeit der Live-API (im Practice Tool weichen beide ab); CS/min, CS-Ziel und Clear-Zeit
  rechnen dann mit der Bildschirm-Uhr
- Weitere Dev-Schalter (gespeichert in `devFlags`): **Perfekt-CS** im CS-Feld („max 107 · 84 %“, Wellen ab dem
  Spawn-Ereignis der Live-API), **FPS/Ping** vom Bildschirm alle 5 s, Schnitt im perf.log, **Death Recap sammeln**
  (ein Bild des Spielfensters je Tod in debug/deathrecap, Grundlage für eine spätere Auswertung), **Ulti
  ungenutzt** (Sekunden mit bereiter eigener R, je Spiel in debug/ult-idle.log)

## 1.7.1 – 2026-10-27

Neu
- „Nach Updates suchen“ im Tray- und ☰-Menü: prüft sofort und sagt immer Bescheid (aktuell, lädt, nicht
  erreichbar)

## 1.7.0 – 2026-10-27

Neu
- Automatische Updates: Farmy prüft beim Start und alle 6 Stunden die GitHub-Releases, lädt neue Versionen
  still im Hintergrund und installiert sie beim Beenden (sofort: Tray-Menü „Neu starten und aktualisieren“).
  Die portable Version zeigt nur einen Hinweis mit Download. Gilt ab dieser Version; wer noch 1.6.x hat,
  lädt einmal von Hand
- Jungle-Route: In der Champ-Auswahl zeigt das Build-Tab für Jungler die erste Runde je Startcamp als Mini-Karte
  mit nummerierten Camps, Clear-Zeit, Smites, Patch und Video (Phylaris' Jungle Clear Compilation; ohne Eintrag
  die Standard-Full-Clear). Per „Auf der Minimap“ wählst du die Route fürs Spiel
- Overlay: Die gewählte Route steht auf der Minimap, solange Tab gedrückt ist (nur mit Smite auf Summoner's Rift).
  Größe und Transparenz im ⚙ einstellbar, ganz abschaltbar. Die Minimap sucht Farmy selbst auf dem Bildschirm
  (schwarzer Kartenrand), passt also bei jeder Minimap-Größe, Auflösung und mit „Minimap links“

Bildschirm-Erkennung
- Fenstermodus und kleinere Spielauflösung: Farmy sucht das Spielfenster und rechnet alle Stellen (CS, Summoner,
  Items, XP, Augment-Karten, Scoreboard, Minimap) relativ dazu, statt vom ganzen Bildschirm auszugehen. Verschiebt
  oder vergrößert man das Fenster, zieht Farmy nach ein paar Sekunden nach
- Alt-Tab: Liegt ein anderes Fenster vorne, blendet Farmy das Overlay aus und liest den Bildschirm nicht mehr
  (vorher hing das Panel über anderen Programmen und las deren Pixel, z. B. Summoner fälschlich „bereit“).
  Farmys eigene Fenster (⚙, Stats-Fenster) zählen wie das Spiel
- Markieren (ARAM-Schneeball), Läuterung und Klarheit galten wegen ihres blauen Symbols immer als „im Cooldown“
  und bekamen eine erfundene Restzeit: Für sie zählt jetzt nur, ob die weiße Restzeit im Feld steht (stimmt auch
  gegen Ende des Cooldowns und während des Schneeball-Sprungs)
- Summoner-Timer bei 1080p: Die nur 1 px breite „1“ galt als Störpixel (aus 115 wurde 5), und dreistellige
  Zeiten verloren ihre linke Ziffer. Außerdem blieb ein einmal zu niedrig gelesener Timer hängen (Abgleich nahm
  nur sinkende Werte an, der Timer stand dann bei 0:00): Liest Farmy zweimal hintereinander einen höheren Wert,
  gilt jetzt dieser

## 1.6.1 – 2026-10-26

Leistung
- Bildschirm-Erkennung ohne Video-Stream: Die App holt sich die paar kleinen Ausschnitte (CS, Summoner, Items,
  XP, Mayhem-Karten, Scoreboard) direkt über Windows (GDI), statt im Spiel dauerhaft den ganzen Bildschirm
  mitzuschneiden. Spart rund 230 MB Arbeitsspeicher im Spiel (Bildpuffer des Streams und ein unsichtbares
  Aufnahme-Fenster fallen weg) und CPU; die Farben sind exakt statt durch die Video-Kompression verwischt
- Overlay baut Summoner-/Item-Kacheln, Skill-Banner und Lane-Zeile nur noch neu, wenn sich etwas ändert
  (vorher jede Sekunde neu samt Icons)
- Stats-Fenster: Der Live-Tab fragt nicht mehr nach, solange das Fenster minimiert oder verdeckt ist

App
- Stats-Fenster zeigt oben links das App-Icon statt eines „F“
- Stats-Fenster: Der Startbildschirm „Letztes Spiel“ zeigt seinen Untertitel; schlägt beim Laden ein Bereich
  fehl (z. B. Verlauf, weil der Client gerade neu startet), laden die anderen trotzdem

Fixes
- Stats-Fenster: Schließen- und Minimieren-Knopf ließen sich nur ganz am Rand drücken, der Rest der Fläche
  zog das Fenster (der Seitenkopf zum Verschieben lag darüber)
- Stats-Fenster: Tray-Klick, „Stats-Fenster öffnen“ im Menü oder ein zweiter Start ließen das Fenster
  verschwinden, wenn es gerade oben lag; umschalten macht nur noch Strg+Shift+S
- Stats-Fenster blieb „immer oben“ über dem Spiel, wenn man in der ersten Sekunde nach dem Öffnen ins Spiel klickte
- Overlay: Nach dem Verschieben-Modus (Strg+Shift+E) reagierten Griff und ⚙ nicht mehr, wenn die Maus beim
  Beenden noch darauf stand; ein ausgeblendetes Overlay kam nach dem Verschieben-Modus wieder hervor
- Overlay: Tab-Scoreboard-Werte und Mayhem-Tiers saßen bei Windows-Skalierung über 100 % (z. B. Laptops mit
  125/150 %) zu weit rechts unten
- Overlay: Das Panel lässt sich nicht mehr aus dem Bild ziehen und kommt nach einem Auflösungswechsel zurück
  ins Bild; ändern sich Auflösung oder Skalierung, passt sich das Overlay an
- Overlay-Einstellungen (⚙): auf kleinen Bildschirmen scrollbar statt unten abgeschnitten; beim Neuladen
  (z. B. Sprachwechsel) stehen sie wieder neben dem Panel
- Build & Runen: Bei schnellem Champ-Wechsel konnte der lolalytics-Vorschlag des vorherigen Champs erscheinen;
  „Als meinen Build übernehmen“ zeigt Fehler jetzt an

## 1.6.0 – 2026-10-26

App
- Neuer Name: **Farmy** (bisher „All You Need“). Einstellungen, Builds, Runen und Caches werden beim ersten Start
  automatisch aus dem alten Ordner übernommen; der Installer ersetzt die alte Installation. Die Runenseite
  „All You Need“ und die Item-Sets im Client werden weiterbenutzt und auf „Farmy“ umbenannt
- Neues Icon: F-Monogramm im Hextech-Sechseck mit türkisem Kristall

## 1.5.0 – 2026-10-26

Allgemein
- Englische Oberfläche: Overlay, Stats-Fenster, Tray-Menü und Meldungen gibt es jetzt auf Deutsch und Englisch.
  Umschalten im Menü (Tray oder ☰ im Stats-Fenster) unter „Sprache / Language“; beim ersten Start gilt die
  Sprache von Windows. LoL-Begriffe stehen so da wie im englischen Spiel und Client (Riots eigene Texte), Item-,
  Champion-, Runen- und Summoner-Namen kommen in der gewählten Sprache von Data Dragon

## 1.4.0 – 2026-10-25

Build & Runen
- Matchup-Karte (nur vor dem Spiel): je gegnerischem Pick aus der Champ-Auswahl, oder von Hand gewählt, die
  Siegquote gegen ihn (lolalytics) mit Einordnung von „gewinnend“ bis „verlierend“ und eine Einschätzung, wer
  auf Level 1–3 vorne liegt: First-Blood-Anteil aus echten Spielen plus gerechnetes All-in aus Grundwerten und
  Grundfähigkeiten auf Rang 1 (Meraki Analytics; ohne Passiven und Kontrolleffekte)
- Summoner-Empfehlung: Der Vorschlag zeigt das meistgespielte Summoner-Paar (lolalytics; nicht das Paar mit
  der höchsten Siegrate und kaum Spielen), ersatzweise Riots Empfehlung. Beim festen Pick setzt die App es
  automatisch; dein Blitz bleibt auf seiner Taste (D oder F). Eigene Karte „Summoner“ im Build-Tab mit
  „Jetzt setzen“ und Schalter fürs automatische Setzen

Overlay
- Neuer Look „Graphit flach“ (Redesign Richtung B): Panel, ⚙-Einstellungen, Warn-Pillen (SKILL/RECALL/KAUFEN/
  NO MANA mit Icon), Cooldown-Kacheln, Tab-Scoreboard- und Mayhem-Badges jetzt mit Inter-Schrift, abgerundeten
  Kacheln und türkis/gold/korallenroten Akzentfarben statt Hextech-Gold-Rahmen; das Stats-Fenster im selben
  Stil (siehe App)
- Kompakt-Modus (⚙ → Allgemein): schmaleres Panel mit drei Kacheln (CS, KDA, Gold), Summoner- und Item-Cooldowns
  als Ringe, die mit der Restzeit leerlaufen, und Lane-Gegner, CS-Diff und Team-Itemwert in einer Fußzeile
- Einstellungen direkt im Spiel (⚙ im Panel-Kopf oder Tray „Overlay-Einstellungen“): jedes Modul einzeln
  ein- und ausschalten (Werte, Skill-Hinweis, Spar-Ziel, Mana, Summoner- und Item-Cooldowns, XP, Lane-Gegner,
  Team-Itemwert, Tab-Scoreboard, Mayhem-Augments), UI-Größe, Hintergrund- und Hover-Transparenz (Panel wird
  durchsichtiger, solange die Maus darüber steht) und Klick-durch (aus: Panel lässt sich überall greifen).
  Abgeschaltete Cooldowns, Augments und Scoreboard werden auch nicht mehr vom Bildschirm gelesen
- Summoner-Kacheln nur noch mit Icon, Taste und Restzeit (keine Namen mehr)

App
- Stats-Fenster im Graphit-Stil ohne Windows-Rahmen: Seitenleiste mit Account, Navigation, Client-Status und
  ☰-Menü (dasselbe wie am Tray-Icon), Verschieben an Seitenleiste und Kopf, eigene Knöpfe oben rechts
- Startet still im Hintergrund (Overlay + Tray); das Stats-Fenster öffnet sich nur auf Wunsch (Tray, Strg+Shift+S)
  oder nach Einstellung nach dem Spiel und beim Pick
- Tastenkürzel (Strg+Shift+O/E/S) gehen jetzt auch im Spiel; League ließ die globalen Hotkeys dort nicht durch.
  Strg+Shift+S holt das Stats-Fenster über das Spiel, ein zweiter Druck schickt es weg; ein Klick ins Spiel
  lässt es dahinter verschwinden
- Verlauf nach Spielmodus getrennt (Alle / Kluft / ARAM / ARAM Mayhem …, startet mit dem Modus des letzten
  Spiels): Bilanz, Siegquote, Ø KDA, Ø CS/min, Trend-Kurven und Spielliste rechnen nur mit dem gewählten Modus
- Tray-Menü „League komplett beenden …“: beendet nach Rückfrage Riot Client, League-Client und Spiel, z. B. wenn
  League nach einem Vanguard-Fehler hängt (statt Task-Manager)

Leistung
- Weniger Arbeitsspeicher (im Spiel ~815 → ~670 MB): Das Stats-Fenster schließt sich beim Spielstart, wenn die App
  es selbst geöffnet hat und du es nicht benutzt hast (Strg+Shift+S holt es zurück). Die Texterkennung wird nach
  einer Minute ohne Nutzung entladen, das Aufnahme-Fenster gibt es nur noch während eines Spiels
- Overlay: Mausbewegungen werden nur noch in der Nähe des Griffs ans Overlay weitergeleitet. Vorher bekam
  das Overlay im Spiel jede Mausbewegung; das kostete etwa 21 % eines CPU-Kerns im Hauptprozess plus 6 % im
  Overlay, jetzt unter 1 %
- Tab-Scoreboard: Die App fragt im Spiel nur noch ab, ob Tab gedrückt ist, statt alle Eingaben über einen
  globalen Tastatur- und Maus-Hook mitzulesen. Der bekam jede Mausbewegung mit (bei Gaming-Mäusen bis zu 1000
  pro Sekunde) und kostete dafür 2–4 % eines CPU-Kerns; jetzt praktisch nichts

Mayhem
- Augment-Karten werden nur noch neu gelesen, wenn sich die Schrift ändert (vorher jede Sekunde wegen des
  Glitzerns der Karten)

Fixes
- Zerschmettern: Nach dem Aufwerten fehlte das Icon und das Panel sprang jede Sekunde zwischen „F“ und
  „F · Zerschmettern“; die Ladungszahl wurde in die Restzeit mitgelesen (aus „1“ und „45“ wurde 145 s).
  Springt eine Summoner-Restzeit beim Abgleich nach oben, gilt sie jetzt als Fehllesung
- Live-Spiel: Sieben Items liefen über den Kartenrand bzw. wurden abgeschnitten; Übungspuppen im Practice Tool
  hatten ein kaputtes Bild und keinen Namen; Scrollleisten waren weiß
- Spar-Ziel: Andere fertige Stiefel als im Build (z. B. Merkurs statt Stahlkappen) zählen als Stiefel; vorher
  wollte die App ein zweites Paar kaufen und zeigte dafür „bezahlbar“
- Item-Cooldowns: Glanz, Stärke der Dreieinigkeit, Lichbane, Eisgeborener Handschuh und Essenzräuber flackerten
  nach jedem Treffer kurz auf (1,5 s Zauberklinge); kurze Cooldowns unter 5 s von Items ohne Aktiv-Fähigkeit
  werden nicht mehr gezeigt
- Mayhem: Augment-Tiers fehlten bei Angeboten, die lebend kommen (z. B. Stufe 7 auf der Lane); die App
  schaute nur im Tod nach
- Werte-Schmiede: Splitter mit einem falsch gelesenen Buchstaben („…splittar“) wurden nicht erkannt
- Mayhem: Quest-Augments (z. B. „Stähle dein Herz“) zeigten „keine Daten“, weil arammayhem.com sie mit
  „Quest:“ davor führt

## 1.3.0 – 2026-10-25

Im Spiel
- Skill-Hinweis: Solange ein Skillpunkt offen ist, zeigt ein Banner über dem Panel, welche Fähigkeit laut
  lolalytics dran ist (z. B. „SKILL Q · Q › E › W“); passt sich an, wenn du vorher abgewichen bist
- Item-Cooldowns: Items mit Aktiv-Fähigkeit stehen mit Restzeit unter den Summonern, andere Items
  (z. B. Schutzengel) nur, solange ihr Cooldown läuft
- Summoner und Items als Icon statt Name; im Cooldown ausgegraut
- Vollbild-Hinweis: läuft League im echten Vollbild, kommt bei Spielstart eine Meldung, auf „Randlos“
  umzustellen (im Vollbild sieht man das Overlay nicht)

ARAM und ARAM Mayhem
- lolalytics-Vorschlag von der ARAM-Seite (Build, Runen, Skill-Reihenfolge), getrennt vom Rift-Vorschlag
- Item-Set „All You Need – Champion ARAM“ erscheint im ARAM-Shop (eigenes Set neben dem Rift-Set)
- Riots Runen-Empfehlung für die ARAM-Map
- KAUFEN statt RECALL, und nur solange du tot bist; XP-Anzeige nur in Prozent
- Bank-Helfer: in der Champ-Auswahl zeigt „Build & Runen“ deinen Champ und die Bank mit ARAM-Siegrate
  (lolalytics), markiert, wenn sich ein Tausch lohnt; Klick zeigt Build und Runen des Champs
- Augment-Tiers im Mayhem: Beim Augment-Angebot steht über jeder Karte ein Tier (S bis D) mit Grund,
  z. B. „S Tier · 10,5 % der Kayn-Spieler“ oder „God-Combo mit Kayn“. Daten: arammayhem.com (Pickraten
  und Combo-Einschätzungen, keine Siegquoten, die erlaubt Riot für Augments nicht)
- Werte-Schmiede: Bei den Werte-Splittern zeigt das Tier, wie gut der Wert zu deinem Build passt
  (lolalytics-Build plus deine gekauften Items)

Build & Runen
- Deine meistgebauten Items pro Champion und Modus (Rift/ARAM), mit Anzahl und Siegquote; „Als meinen
  Build übernehmen“. Die App merkt sich dafür die Endbuilds deiner Spiele selbst (der Client kennt nur die
  letzten 20); Practice Tool und Custom Games zählen nicht

App
- Auto-Accept: „Spiel automatisch annehmen“ im Tray-Menü (standardmäßig aus) nimmt „Spiel gefunden“ nach
  2 Sekunden an; wer vorher selbst ablehnt, bleibt abgelehnt
- Eigene Ziffern-Erkennung statt Tesseract für Summoner-, Item- und CS-Zahlen (rund 90× schneller);
  Tesseract nur noch, wenn sie unsicher ist. Muster lernt `tools/digit-samples.js`, `ocr.collectDigits`
  sammelt dafür CS-Ausschnitte
- Alte lolalytics-Einträge ohne Skill-Reihenfolge werden beim nächsten Pick neu geholt
- Weniger Last außerhalb des Spiels: die Bildschirmaufnahme läuft nur noch während eines Spiels, Tesseract
  wird erst bei Bedarf geladen und nach dem Spiel freigegeben (rund 100 MB weniger Arbeitsspeicher ohne Spiel)
- Kein Debug-Abzug mehr alle 5 Sekunden in der veröffentlichten Version (sparte 100 KB Schreiblast je Abzug)

Fixes
- CS wurde oft nicht exakt erkannt („0+“), vor allem eine einzelne 0: der Bildschirm-Stream verwischt Gelb,
  die Erkennung achtet jetzt auf Helligkeit
- Summoner sprangen nach dem Tod kurz auf „bereit“ (grauer Bildschirm), obwohl der Cooldown lief
- Flash zeigte ab und zu kurze Fantasie-Cooldowns (0:03 bis 0:09), obwohl er bereit war
- Skill-Banner: Ist die Ulti dran, wird sie zuerst angezeigt, auch wenn noch ein älterer Punkt offen ist

## 1.2.0 – 2026-10-24

Champ-Auswahl
- Build- und Runen-Vorschlag von lolalytics.com für Champion und Rolle: wird beim festen Pick einmal geladen
  und einen Tag gespeichert. Ohne eigene Runen werden die vorgeschlagenen gesetzt, ohne eigenen Build nutzt
  das Spar-Ziel im Spiel den Vorschlag. Im Stats-Fenster mit Quelle und „Übernehmen“; abschaltbar.
  Antwortet lolalytics nicht, kommt Riots eigene Runen-Empfehlung
- Runen-Auswahl: bis zu vier Runenseiten pro Champion (lolalytics + Riots empfohlene Seiten für die Rolle),
  jede mit „Setzen“ (sofort auf die Seite „All You Need“) und „Merken“ (als eigene Runen speichern)
- Item-Set für den Shop: beim Pick (und per Knopf) landet „All You Need – Champion“ im Client, mit
  Start-Items, Kern-Build und jedem Kern-Item samt seinen Teilen; andere Item-Sets bleiben unangetastet
- Stats-Fenster öffnet sich beim festen Pick direkt auf „Build & Runen“, ohne dem Client den Fokus zu
  nehmen (abschaltbar)

App
- Installations-Assistent mit Zielordner, Desktop- und Startmenü-Verknüpfung und „App starten“ am Ende
- Tray-Icon unten rechts: zeigt, dass die App läuft; Menü mit Stats-Fenster, Overlay ein/aus, Panel verschieben,
  „Mit Windows starten“ und Beenden
- Hinweis beim ersten Start und beim ersten Schließen des Stats-Fensters, wo die App weiterläuft
- Nur eine Instanz: ein zweiter Start öffnet das Stats-Fenster der laufenden App
- `--data-dir=<Ordner>` legt Einstellungen und Caches woandershin als `%APPDATA%` (z. B. wenn C: voll ist);
  `npm start` nutzt dieselben Einstellungen wie die installierte App
- Copyright- und Herstellerangaben in den Dateieigenschaften der `.exe`

Fixes
- Overlay konnte hinter dem Spiel verschwinden; es wird jetzt jede Sekunde wieder nach vorne geholt.
  Ein zweiter Start der `.exe` blendet ein per Hotkey ausgeblendetes Overlay wieder ein
- Wird die HUD-Skalierung mitten im Spiel geändert, passt sich die Erkennung nach wenigen Sekunden an
  (bisher erst beim nächsten Spielstart)
- Volle Festplatte: `config.json` kann nicht mehr leer zurückbleiben, und das Overlay läuft weiter, wenn die
  Debug-Datei nicht geschrieben werden kann
- „Mit Windows starten“ funktioniert auch beim Start aus dem Quellcode

## 1.1.0 – 2026-10-24

- Download: Windows-Installer und portable `.exe` auf der Releases-Seite, kein Node.js mehr nötig
- Auflösungs-unabhängig: Bildschirmbereiche werden aus Auflösung und HUD-Skalierung (`game.cfg`) berechnet
  (getestet mit 3440×1440 bei HUD 0 und 100 sowie simulierten 1080p)
- Scoreboard-Suche funktioniert bei jeder Auflösung
- League-Ordner wird automatisch gefunden (Installationsliste des Riot Clients)
- „Erkennung prüfen“ im Stats-Fenster zeigt die gelesenen Bildschirmbereiche und Werte
- Installierte App speichert Einstellungen unter `%APPDATA%\All You Need`
- README auf Englisch mit Screenshots

## 1.0.0 – 2026-10-24

Erste Version.

- Panel im Spiel: KDA, exakte CS per Texterkennung, CS/min, Gold, Vision
- Summoner-Cooldowns (D/F) mit Countdown, alle 10 s mit dem HUD abgeglichen
- XP bis zum nächsten Level mit „noch X Melee / Y Caster“
- Mana-Leiste mit Combo-Kosten und „NO MANA“-Warnung
- Spar-Ziel aus dem eigenen Build mit Restkosten und „RECALL“-Hinweis
- Tab-Scoreboard: Item-Wert-Differenz pro Zeile und Team, findet verschobene Scoreboards selbst
- Stats-Fenster: Live-Spiel mit Rängen, letztes Spiel, Verlauf mit Trend-Kurven
- Build-Reihenfolge und Runenseite pro Champion, Runen-Auto-Import in der Champ-Auswahl
- Hextech-Look, verschiebbares Panel, Hotkeys
- Eigenes App-Icon (Monogramm), Quell-SVGs in `assets/`, neu bauen mit `npx electron tools/build-icon.js`
