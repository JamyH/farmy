# Datenschutzerklärung

Stand: [DATUM]

## 1. Verantwortlicher

[VOLLER NAME], [ANSCHRIFT], E-Mail: [E-MAIL-ADRESSE]
(weitere Angaben im Impressum)

## 2. Kurz gesagt

- Farmy speichert deine Daten **nur auf deinem PC**. Wir betreiben keinen eigenen Server, der Spiel- oder
  Kontodaten empfängt.
- Farmy enthält **kein Tracking, keine Werbung, keine Analyse- oder Telemetrie-Dienste**.
- Für Spieldaten, Bilder und Updates lädt Farmy Dateien von den unten genannten Diensten. Dabei sehen diese Dienste,
  wie bei jedem Abruf im Internet, deine IP-Adresse.

## 3. Die App Farmy

### 3.1 Daten auf deinem PC

Farmy liest über die offiziellen lokalen Schnittstellen von League of Legends (League Client API und Live Client
Data API) und über kleine Bildschirmausschnitte, was im Spiel ohnehin zu sehen ist: deinen Riot-Namen, Rang,
Spielverlauf, Werte des laufenden Spiels. Die Bildschirmausschnitte werden nur im Arbeitsspeicher ausgewertet und
nicht gespeichert (Ausnahme: der Debug-Modus, den du selbst einschaltest; seine Dateien bleiben in deinem
Datenordner).

Farmy speichert Einstellungen, Notizen, Spielverlauf und Zwischenspeicher im Datenordner
(`%APPDATA%\Farmy`). Diese Daten verlassen deinen PC nicht. Du kannst sie jederzeit löschen, indem du diesen Ordner
löschst.

Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der von dir genutzten Funktionen). Da die Daten nur
auf deinem Gerät verarbeitet werden, haben wir keinen Zugriff darauf.

### 3.2 Abrufe aus dem Internet

Beim Abruf übermittelt dein PC technisch bedingt deine IP-Adresse, Uhrzeit und die abgerufene Adresse an den
jeweiligen Anbieter. Farmy sendet dabei **keine** Riot-Namen, Spieldaten oder Kennungen mit.

| Anbieter | Wofür | Sitz |
|---|---|---|
| Riot Games, Inc. (Data Dragon, `ddragon.leagueoflegends.com`) | Champion-, Item- und Runendaten, Icons | USA |
| Meraki Analytics (`cdn.merakianalytics.com`) | Rollen und Fähigkeitswerte der Champions | [SITZ PRÜFEN] |
| arammayhem.com | Augment-Tiers für ARAM Mayhem | [SITZ PRÜFEN] |
| CommunityDragon (`raw.communitydragon.org`) | englische Augment-Namen | [SITZ PRÜFEN] |
| GitHub, Inc. (Microsoft) | Prüfen und Laden von Updates | USA |

Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (die Daten sind für die Funktionen nötig) und Art. 6 Abs. 1 lit. f
DSGVO (berechtigtes Interesse an einer aktuellen, sicheren Software). Für Anbieter in den USA erfolgt die
Übermittlung, soweit sie unter dem EU-US Data Privacy Framework zertifiziert sind, auf Grundlage des
Angemessenheitsbeschlusses der EU-Kommission (Art. 45 DSGVO). [ZERTIFIZIERUNG JE ANBIETER PRÜFEN:
dataprivacyframework.gov]

Updates: Farmy fragt alle sechs Stunden bei GitHub nach, ob es eine neue Version gibt. Dabei wird die Datei
`latest.yml` abgerufen; außer der IP-Adresse wird nichts übertragen.

### 3.3 Fehlerberichte

Farmy schreibt Fehler in eine Log-Datei in deinem Datenordner (`debug/error.log`, höchstens 1 MB). Sie wird nicht automatisch übertragen.
Schickst du sie uns für den Support, verarbeiten wir sie nur zur Fehlerbehebung (Art. 6 Abs. 1 lit. b DSGVO) und
löschen sie, wenn der Fall erledigt ist.

## 4. Die Website

Die Website wird bei GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA)
betrieben. GitHub verarbeitet beim Aufruf technisch bedingt deine IP-Adresse und speichert Server-Logs
(Art. 6 Abs. 1 lit. f DSGVO; berechtigtes Interesse am sicheren Betrieb der Website). Details:
https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement

Die Download-Knöpfe fragen bei der GitHub-API (`api.github.com`) die neueste Version ab.

Die Website setzt keine Cookies, nutzt keine Analyse-Werkzeuge und lädt keine Schriften von Dritten.

## 5. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage von
Art. 6 Abs. 1 lit. f (Art. 21). Schreib dafür an [E-MAIL-ADRESSE].

Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für unseren Sitz
zuständigen: [AUFSICHTSBEHÖRDE DES BUNDESLANDS, z. B. Bayerisches Landesamt für Datenschutzaufsicht].

## 6. Änderungen

Ändert sich, was Farmy überträgt, passen wir diese Erklärung an und nennen die Änderung im Changelog.
