/**
 * Nur die Standardfassung. Die Vollversion läuft an dieser Funktion vorbei,
 * ihr Text bleibt unverändert.
 */

import { applyStandardBausteine, dropFremdeProzesse, standardFall, type StandardFall } from "@/lib/schnellversion-bausteine";
import { OFFENE_KASSE_FRIST } from "@/lib/schnellversion-basis";
import { capitalizeSentenceStart } from "@/lib/satzanfang";

const FIXED_DATES = ["01.07.2026", "1.07.2026", "2026-07-01"];

export const SV_BASIS_SATZ = "Standardfassung auf Basis der Angaben zu Branche und Größe.";

/** Anzeige im PDF. Die Bestellseite behält das Auswahllabel. */
export const SV_SOLO_MITARBEITENDE = "keine (nur die Inhaberin bzw. der Inhaber)";

/** Freiberuf 16.5, Wortlaut aus R340-F47. */
export const FREIBERUF_BUECHER =
  "Bücher, Aufzeichnungen und Inventare; Jahresabschlüsse, Lageberichte und Eröffnungsbilanz, soweit vorhanden; Arbeitsanweisungen und Organisationsunterlagen";

const FREIBERUF_BUECHER_ALT =
  "Bücher, Aufzeichnungen, Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz sowie Arbeitsanweisungen und Organisationsunterlagen";

export type StandardNeutralOptions = {
  /** Buchführung im Unternehmen, nicht durch die Kanzlei. */
  selfBooking?: boolean;
  /** Programm aus der Antwort. DATEV und Kanzlei bleiben, wenn der Kunde sie genannt hat. */
  software?: string;
  fall?: StandardFall;
  branche?: string;
  /** Mitarbeitende „1 (nur ich)“. */
  solo?: boolean;
  /** Rechtsform Einzelunternehmen. */
  einzelunternehmen?: boolean;
};

export function neutralizeStandardText(
  text: string,
  erstelltAm: string,
  options: StandardNeutralOptions = {},
): string {
  let next = text;
  next = next.replaceAll(
    "Entwurf aus Kunden-Intake — betriebliche Bestätigung ausstehend",
    `Standardfassung, erstellt am ${erstelltAm}`,
  );
  next = next.replaceAll(
    "Entwurf aus Kunden-Intake - betriebliche Bestätigung ausstehend",
    `Standardfassung, erstellt am ${erstelltAm}`,
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
  // Ersetzungsquelle, kein Kundentext. Ausnahme: BELEGFRIST_ALLOWLIST in scripts/check-belegfrist.ts
  next = next.replaceAll("Buchungsbelege 10 Jahre", "Buchungsbelege 8 Jahre");
  next = next.replaceAll("1 (nur ich)", SV_SOLO_MITARBEITENDE);
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
  next = next.replace(/Hinweis: Diese Verfahrensdokumentation[\s\S]*?hinzuzuziehen\.\s*/g, "");
  next = next.replaceAll("entfällt. Grund: offene Ladenkasse.", "entfällt (offene Ladenkasse).");
  next = next.replaceAll("..", ".");
  const fall = options.fall ?? standardFall({
    software: options.software ?? "",
    bucht: options.selfBooking ? "Wir selbst im Unternehmen" : "Unsere Steuerkanzlei",
  });
  const withBlocks = applyStandardBausteine(next, fall);
  const dropped = options.branche ? dropFremdeProzesse(withBlocks, options.branche) : withBlocks;
  return anpassenFall(ohneInterneVerweise(dropped), options);
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
  next = next.replaceAll("**Kassenart:** Art:", "**Kassenart:**");
  next = next.replaceAll("**Belegausgabe:** Belegausgabe:", "**Belegausgabe:**");
  next = next.replaceAll("**System:** System:", "**System:**");
  next = next.replaceAll("**Bestellweg:** Bestellwege:", "**Bestellwege:**");
  next = next.replace(/[ \t]{2,}/g, " ");
  next = next.replace(/ +\./g, ".");
  next = next.replace(/\(\s*\)/g, "");
  next = next.replace(/\s+—\s+—/g, " —");
  if (next.includes(RECHTE_TABELLE) && !next.includes("Vorschlag – vom Betrieb zu bestätigen")) {
    next = next.replaceAll(RECHTE_TABELLE, `Vorschlag – vom Betrieb zu bestätigen\n\n${RECHTE_TABELLE}`);
  }
  return next;
}

function anpassenFall(text: string, options: StandardNeutralOptions): string {
  let next = text;
  next = next.replaceAll(
    "| Lieferscheine, die keine Buchungsbelege sind | bis Erhalt der Rechnung | § 147 Abs. 3 AO |",
    "| Empfangene Lieferscheine, soweit kein Buchungsbeleg | bis zum Erhalt der Rechnung | § 147 Abs. 3 Satz 3 AO |",
  );
  next = next.replaceAll(
    "| Abgesandte Lieferscheine, die keine Buchungsbelege sind | bis Versand der Rechnung | § 147 Abs. 3 AO |",
    "| Abgesandte Lieferscheine, soweit kein Buchungsbeleg | bis zum Versand der Rechnung | § 147 Abs. 3 Satz 4 AO |",
  );
  next = next.replaceAll(
    "| Lieferscheine, die keine Buchungsbelege sind | bis Erhalt bzw. Versand der Rechnung | § 147 Abs. 3 AO |",
    "| Lieferscheine, soweit kein Buchungsbeleg | bis Erhalt bzw. Versand der Rechnung | § 147 Abs. 3 Satz 3, 4 AO |",
  );
  next = next.replaceAll(
    "deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO)",
    "deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 Satz 5 AO)",
  );
  if (options.branche === "freiberuf") {
    next = next.replaceAll(
      "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO; § 257 Abs. 1 Nr. 2, 3, Abs. 4 HGB",
      "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO (Geschäftsbriefe)",
    );
    next = next.replace(/; § 257 Abs\. 1[^|\n]*HGB/g, "");
    next = next.replaceAll(" (§ 240 HGB)", "");
    next = next.replaceAll(" (§ 241 Abs. 2 HGB)", "");
    next = next.replaceAll(`| ${FREIBERUF_BUECHER_ALT} |`, `| ${FREIBERUF_BUECHER} |`);
    next = next.replaceAll(
      "Jahresabschlüsse, Lageberichte, Eröffnungsbilanz",
      "Jahresabschlüsse, Lageberichte und Eröffnungsbilanz, soweit vorhanden",
    );
  }
  if (options.einzelunternehmen) {
    next = next.replaceAll("durch die Geschäftsführung", "durch die Inhaberin bzw. den Inhaber");
    next = next.replaceAll("bei der Geschäftsführung", "bei der Inhaberin bzw. dem Inhaber");
    next = next.replaceAll("der Geschäftsführung", "der Inhaberin bzw. dem Inhaber");
    next = next.replaceAll("Die Geschäftsführung", "Die Inhaberin bzw. der Inhaber");
    next = next.replaceAll("die Geschäftsführung", "die Inhaberin bzw. der Inhaber");
    next = next.replaceAll("Geschäftsführung", "Inhaberin bzw. Inhaber");
  }
  if (options.solo) {
    next = next.replaceAll(
      "Bei Ausfall des Eingangskanals informiert die Buchhaltung die Inhaberin bzw. der Inhaber und dokumentiert Beginn und Ende.",
      "Bei Ausfall des Eingangskanals dokumentiert die Inhaberin bzw. der Inhaber Beginn und Ende.",
    );
    next = next.replaceAll(
      "Bei Ausfall des Eingangskanals informiert die Buchhaltung die Geschäftsführung und dokumentiert Beginn und Ende.",
      "Bei Ausfall des Eingangskanals dokumentiert die Inhaberin bzw. der Inhaber Beginn und Ende.",
    );
    next = next.replaceAll(
      "Bei Ausfall des Eingangskanals informiert die Inhaberin bzw. der Inhaber und dokumentiert Beginn und Ende.",
      "Bei Ausfall des Eingangskanals dokumentiert die Inhaberin bzw. der Inhaber Beginn und Ende.",
    );
    next = next.replaceAll("die Buchhaltung erfasst Anlass", "die Inhaberin bzw. der Inhaber erfasst Anlass");
    next = next.replaceAll(
      "| die Buchhaltung | ja | ja | nein* | nein |",
      "| externe Steuerberatung (soweit beauftragt) | im Mandatsumfang | nein | nein | nein |",
    );
    next = next.replace(/\| Andere Beschäftigte \|[^\n]*\n/g, "");
    next = next.replace(/\* Sofern die Buchhaltung sachlich freigibt[^\n]*\n?/g, "");
    next = next.replaceAll(". die Inhaberin bzw. der Inhaber", ". Die Inhaberin bzw. der Inhaber");
    next = next.replaceAll("\ndie Inhaberin bzw. der Inhaber", "\nDie Inhaberin bzw. der Inhaber");
  }
  return capitalizeSentenceStart(next);
}

/** Offene Ladenkasse: keine TSE, Kassensystem-Zeilen in Aufbewahrung angepasst. */
export function offeneKasseText(text: string): string {
  return ohneTseAussage(text)
    .split("\n")
    .flatMap((line) => {
      if (line.includes("Programmierung und Organisationsunterlagen")) {
        return [line.replaceAll("Programmierung und Organisationsunterlagen", "Organisationsunterlagen")];
      }
      if (line.includes("Programmier- und Änderungsprotokolle des Kassensystems")) return [];
      if (
        line.includes("Tagesabschlüsse (Z-Bons), Kassenberichte und Zählprotokolle") ||
        line.includes("Tagesabschlüsse (Z-Bons) und, soweit geführt, Kassenberichte und Zählprotokolle")
      ) {
        return OFFENE_KASSE_FRIST.split("\n");
      }
      if (line.includes("| Einzahlungsquittungen, Einlage- und Entnahmebelege |")) return [];
      return [line];
    })
    .join("\n");
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
