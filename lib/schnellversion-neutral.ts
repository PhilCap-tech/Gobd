/**
 * Nur die Standardfassung. Die Vollversion läuft an dieser Funktion vorbei,
 * ihr Text bleibt unverändert.
 */

import { applyStandardBausteine, dropFremdeProzesse, standardFall, type StandardFall } from "@/lib/schnellversion-bausteine";

const FIXED_DATES = ["01.07.2026", "1.07.2026", "2026-07-01"];

export const SV_BASIS_SATZ = "Standardfassung auf Basis der Angaben zu Branche und Größe.";

export type StandardNeutralOptions = {
  /** Buchführung im Unternehmen, nicht durch die Kanzlei. */
  selfBooking?: boolean;
  /** Programm aus der Antwort. DATEV und Kanzlei bleiben, wenn der Kunde sie genannt hat. */
  software?: string;
  fall?: StandardFall;
  branche?: string;
};

export function neutralizeStandardText(
  text: string,
  erstelltAm: string,
  options: StandardNeutralOptions = {},
): string {
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
    "auf Grundlage der Angaben zu Branche und Größe",
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
  next = next.replaceAll(
    "Keine Bereiche ausgenommen; ältere Fassungen bleiben im Kundenkonto abrufbar.",
    "Keine Bereiche ausgenommen.",
  );
  next = next.replaceAll(
    "Keine Bereiche ausgenommen; Der Download dieser Standardfassung ist 30 Tage möglich.",
    "Keine Bereiche ausgenommen.",
  );
  next = next.replaceAll("Kundenkonto gobd-doku-erstellen.de, Fassungen downloadbar", "Ablage laut Betrieb");
  next = next.replaceAll("Kundenkonto gobd-doku-erstellen.de, Fassungen 1.0 und 2.0", "Ablage laut Betrieb");
  next = next.replaceAll("Kundenkonto gobd-doku-erstellen.de", "Ablage laut Betrieb");
  next = next.replaceAll("Kundenkonto", "Ablage laut Betrieb");
  next = next.replaceAll(
    "Präsens-Aussagen gelten nur, soweit die jeweilige Angabe bestätigt ist.",
    "Die beschriebenen Abläufe sind typische Abläufe der Branche.",
  );
  next = next.replaceAll(
    "Bei einem realen Betrieb bestätigt die Geschäftsleitung an dieser Stelle, dass die beschriebenen Abläufe der tatsächlichen Praxis entsprechen. Automatische Erzeugung und fachliche Hinweise ersetzen diese betriebliche Prüfung nicht.",
    "Die Geschäftsführung prüft, ob die beschriebenen Abläufe zum Betrieb passen.",
  );
  next = next.replaceAll("Robert Funke", "die Geschäftsführung");
  next = next.replaceAll("Ines Wolf", "die Buchhaltung");
  next = next.replaceAll("KassaPro", "Kassensystem laut Betrieb");
  next = next.replaceAll("ERP Fertigplan", "Einkaufssystem laut Betrieb");
  next = next.replaceAll("Faktura+", "Rechnungssystem laut Betrieb");
  next = next.replaceAll("Faktura", "Rechnungssystem laut Betrieb");
  next = next.replaceAll("Kanzlei (Muster, fiktiv)", "Buchhaltung laut Betrieb");
  next = next.replaceAll("(Muster, fiktiv)", "");
  next = next.replaceAll("Kassensystem mit Cloud-TSE (fiktiv)", "Kassensystem laut Betrieb");
  next = next.replaceAll("Warenwirtschaft (fiktiv)", "Warenwirtschaft laut Betrieb");
  next = next.replaceAll("Shopify (fiktiv)", "Onlineshop laut Betrieb");
  next = next.replaceAll("Zahlungsdienstleister / Kreditkarte (fiktiv)", "Zahlungsdienstleister laut Betrieb");
  next = next.replaceAll("Kartenterminal / Zahlungsdienstleister (fiktiv)", "Kartenterminal laut Betrieb");
  next = next.replaceAll("Anlagenverzeichnis (fiktiv)", "Anlagenverzeichnis laut Betrieb");
  next = next.replaceAll("(fiktiv)", "");
  next = next.replaceAll("bestätigt, ohne nähere Angabe", "Angabe des Betriebs");
  next = next.replaceAll("noch zu klären. Siehe offene Punkte.", "ist im Betrieb festzulegen und hier einzutragen.");
  next = next.replaceAll("Siehe offene Punkte", "Siehe Ergänzungsliste am Ende");
  next = next.replaceAll("Laut Betriebs-Check nicht vorhanden", "im Betrieb zu klären");
  next = next.replaceAll("laut Betriebs-Check", "im Betrieb");
  next = next.replaceAll("Buchungsbelege 10 Jahre", "Buchungsbelege 8 Jahre");
  next = next.replaceAll("von die Geschäftsführung", "der Geschäftsführung");
  next = next.replaceAll("bei die Geschäftsführung", "bei der Geschäftsführung");
  next = next.replaceAll("bei die Buchhaltung", "bei der Buchhaltung");
  next = next.replaceAll("mit die Geschäftsführung", "mit der Geschäftsführung");
  next = next.replaceAll("mit die Buchhaltung", "mit der Buchhaltung");
  next = next.replaceAll(" .", ".");
  next = next.replace(/Dieses Dokument beschreibt[\s\S]*?(?:\n{2,}|$)/g, "\n");
  next = next.replace(/Die automatische Generierung ersetzt[\s\S]*?Geschäftsleitung\.\s*/g, "");
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
  const fall = options.fall ?? standardFall({
    software: options.software ?? "",
    bucht: options.selfBooking ? "Wir selbst im Unternehmen" : "Unsere Steuerkanzlei",
  });
  const withBlocks = applyStandardBausteine(next, fall);
  const dropped = options.branche ? dropFremdeProzesse(withBlocks, options.branche) : withBlocks;
  return ohneInterneVerweise(dropped);
}

const RECHTE_TABELLE = "| Rolle | Lesen | Bearbeiten | Freigeben | Rechte verwalten |";

/** Interne Arbeitsbegriffe der Standardfassung. Die Vollversion bleibt unverändert. */
function ohneInterneVerweise(text: string): string {
  let next = text;
  next = next.replaceAll("im Intake zu bestätigen", "vom Betrieb zu bestätigen");
  next = next.replaceAll("im Intake nicht angegeben", "in dieser Dokumentation nicht angegeben");
  next = next.replaceAll("im Intake spezifiziert", "vom Betrieb festgelegt");
  next = next.replaceAll("im Intake als heutige Praxis bestätigt", "vom Betrieb bestätigt");
  next = next.replaceAll("im Intake bestätigte", "vom Betrieb bestätigte");
  next = next.replaceAll("aus dem Intake", "in dieser Dokumentation");
  next = next.replaceAll("aus Intake", "vom Betrieb");
  next = next.replaceAll("laut Intake", "laut Betrieb");
  next = next.replaceAll("Stand im Intake", "Stand");
  next = next.replaceAll("im Intake", "vom Betrieb");
  next = next.replaceAll("Intake", "");
  next = next.replaceAll("siehe Anhang A", "siehe Ergänzungsliste am Ende");
  next = next.replaceAll("sonst siehe Anhang A", "sonst siehe Ergänzungsliste am Ende");
  next = next.replaceAll("Anhang A", "");
  next = next.replace(/[ \t]{2,}/g, " ");
  next = next.replace(/ +\./g, ".");
  next = next.replace(/\(\s*\)/g, "");
  next = next.replace(/\s+—\s+—/g, " —");
  if (next.includes(RECHTE_TABELLE) && !next.includes("Vorschlag – vom Betrieb zu bestätigen")) {
    next = next.replaceAll(RECHTE_TABELLE, `Vorschlag – vom Betrieb zu bestätigen\n\n${RECHTE_TABELLE}`);
  }
  return next;
}

/** Offene Ladenkasse: keine Aussage zur TSE. Nur die Standardfassung. */
export function ohneTseAussage(text: string): string {
  return text
    .split("\n")
    .flatMap((line) => {
      if (!line.includes("TSE")) return [line];
      if (line.startsWith("|")) return [];
      const next = line
        .replaceAll("TSE-Daten", "Kassendaten")
        .replaceAll("TSE-Seriennummer", "Seriennummer")
        .replaceAll("TSE-Art", "Art")
        .replaceAll("TSE und Mitteilung", "Mitteilung zum Kassensystem")
        .replaceAll("Kassenart und TSE", "Kassenart")
        .replaceAll("Kassensystem und TSE", "Kassensystem")
        .replaceAll("von Kasse oder TSE", "der Kasse")
        .replaceAll("Kasse oder TSE", "Kasse")
        .replace(/\bTSE\b/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;:])/g, "$1")
        .replace(/\(\s*\)/g, "")
        .replace(/,\s*,/g, ",")
        .replace(/\s+\./g, ".")
        .trim();
      if (!next || /^\*\*[^*]{0,4}:\*\*\.?$/.test(next)) return [];
      return [next];
    })
    .join("\n");
}
