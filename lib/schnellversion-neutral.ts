/**
 * Nur die Standardfassung. Die Vollversion läuft an dieser Funktion vorbei,
 * ihr Text bleibt unverändert.
 */

const FIXED_DATES = ["01.07.2026", "1.07.2026", "2026-07-01"];

export const SV_BASIS_SATZ = "Standardfassung auf Basis Ihrer Angaben zu Branche und Größe.";

export function neutralizeStandardText(text: string, erstelltAm: string): string {
  let next = text;
  next = next.replaceAll(
    "Entwurf aus Kunden-Intake — betriebliche Bestätigung ausstehend",
    `${SV_BASIS_SATZ} Erstellt am ${erstelltAm}.`,
  );
  next = next.replaceAll(
    "Entwurf aus Kunden-Intake - betriebliche Bestätigung ausstehend",
    `${SV_BASIS_SATZ} Erstellt am ${erstelltAm}.`,
  );
  next = next.replaceAll(
    "auf Grundlage der im Intake bestätigten Angaben",
    "als Standardfassung auf Basis Ihrer Angaben zu Branche und Größe",
  );
  next = next.replaceAll(
    "aus bestätigten Angaben des Kunden-Intakes erzeugt",
    `als ${SV_BASIS_SATZ} Erstellt am ${erstelltAm}.`,
  );
  next = next.replaceAll("Kunden-Intake", "Standardfassung");
  next = next.replaceAll("bestätigten Angaben", "Angaben zu Branche und Größe");
  next = next.replaceAll("bestätigte Angaben", "Angaben zu Branche und Größe");
  next = next.replaceAll("Angabe im Intake", "Angabe in der Standardfassung");
  next = next.replaceAll("aus dem Intake", "aus der Standardfassung");
  next = next.replaceAll("Musterbetrieb ", "");
  next = next.replaceAll("Kassensystem mit Cloud-TSE (fiktiv)", "Kassensystem laut Betrieb");
  next = next.replaceAll("Warenwirtschaft (fiktiv)", "Warenwirtschaft laut Betrieb");
  next = next.replaceAll("Shopify (fiktiv)", "Onlineshop laut Betrieb");
  next = next.replaceAll("Zahlungsdienstleister / Kreditkarte (fiktiv)", "Zahlungsdienstleister laut Betrieb");
  next = next.replaceAll("Kartenterminal / Zahlungsdienstleister (fiktiv)", "Kartenterminal laut Betrieb");
  next = next.replaceAll("Anlagenverzeichnis (fiktiv)", "Anlagenverzeichnis laut Betrieb");
  next = next.replaceAll("(fiktiv)", "");
  next = next.replaceAll("bestätigt, ohne nähere Angabe", "[bitte prüfen]");
  next = next.replaceAll(
    "Sätze im Präsens beschreiben nur bestätigte Abläufe",
    "Die beschriebenen Abläufe sind typische Abläufe der Branche",
  );
  next = next.replaceAll(
    "ältere Fassungen bleiben im Kundenkonto abrufbar",
    "Der Download dieser Standardfassung ist 30 Tage möglich",
  );
  next = next.replace(
    /Diese Fassung gilt ab \d{1,2}\.\d{1,2}\.\d{4}[^.]*\./g,
    `Erstellt am ${erstelltAm}. ${SV_BASIS_SATZ}`,
  );
  for (const date of FIXED_DATES) next = next.replaceAll(date, erstelltAm);
  next = next.replaceAll("..", ".");
  return next;
}
