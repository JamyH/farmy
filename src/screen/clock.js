// Spielzeit von der Bildschirm-Uhr (Dev-Schalter „Spielzeit per OCR“), abgesichert gegen Lesefehler.
// Die Erkennung liest manchmal Unsinn: eine 6 an der Minutenstelle gar nicht (die Uhr blieb dann auf 5:59, 15:59 …
// stehen, im Spiel-Log fehlten die Minuten 6, 16, 26, 36) oder den Doppelpunkt als 1 („4:15“ → 41:15). Deshalb zählt
// eine Lesung nur, wenn sie zur weiterlaufenden Uhr passt; dazwischen läuft die Zeit selbst weiter. Ein Sprung
// (Practice Tool: Zeit vorgespult oder angehalten) gilt erst, wenn zwei Lesungen hintereinander zueinander passen.
// Außer im Practice Tool darf die Uhr außerdem nicht weit von der Zeit der Live-API abweichen.
const TOLERANCE = 3; // s, eine Lesung darf so weit von der weitergelaufenen Uhr abweichen
const API_LIMIT = 30; // s, mehr Abstand zur Live-API ist ein Lesefehler

let anchor = null; // letzte gültige Lesung { t: Sekunden, at: Zeitpunkt der Lesung }
let jump = null; // Lesung, die nicht passte: gilt, wenn die nächste dazu passt
let lastAt = 0; // dieselbe Lesung nicht zweimal auswerten (Spiel-Abfrage und Bildschirm laufen getrennt)

function reset() {
  anchor = jump = null;
  lastAt = 0;
}

const project = (p, now) => p.t + (now - p.at) / 1000;
const fits = (p, read, at) => Math.abs(read - project(p, at)) <= TOLERANCE;

// read: zuletzt gelesene Uhr in Sekunden oder null (unlesbar), readAt: wann gelesen. Gibt die Spielzeit in Sekunden
function update(read, readAt, apiTime, practice, now = Date.now()) {
  if (read != null && readAt !== lastAt) {
    lastAt = readAt;
    if (practice || Math.abs(read - apiTime) <= API_LIMIT) {
      if (!anchor || fits(anchor, read, readAt) || (jump && fits(jump, read, readAt))) {
        anchor = { t: read, at: readAt };
        jump = null;
      } else {
        jump = { t: read, at: readAt };
      }
    }
  }
  if (!anchor) return practice ? 0 : apiTime; // noch keine gültige Lesung
  return Math.max(0, Math.floor(project(anchor, now)));
}

module.exports = { reset, update };
