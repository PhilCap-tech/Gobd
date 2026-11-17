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
  for (const date of FIXED_DATES) next = next.replaceAll(date, erstelltAm);
  return next;
}
