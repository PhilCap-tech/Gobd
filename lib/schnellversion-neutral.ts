/**
 * Nur die Standardfassung. Die Vollversion läuft an dieser Funktion vorbei,
 * ihr Text bleibt unverändert.
 */

const FIXED_DATES = ["01.07.2026", "1.07.2026", "2026-07-01"];

export const SV_BASIS_SATZ = "Standardfassung auf Basis Ihrer Angaben zu Branche und Größe.";

export type StandardNeutralOptions = {
  /** Buchführung im Unternehmen, nicht durch die Kanzlei. */
  selfBooking?: boolean;
  /** Programm aus der Antwort. DATEV und Kanzlei bleiben, wenn der Kunde sie genannt hat. */
  software?: string;
};

export function neutralizeStandardText(
  text: string,
  erstelltAm: string,
  options: StandardNeutralOptions = {},
): string {
  let next = text;
  next = next.replaceAll("in die Weiß ich nicht, macht die Kanzlei", "in der von der Kanzlei eingesetzten Software");
  next = next.replaceAll("in Weiß ich nicht, macht die Kanzlei", "in der von der Kanzlei eingesetzten Software");
  next = next.replaceAll("Weiß ich nicht, macht die Kanzlei", "die von der Kanzlei eingesetzte Software");
  next = next.replaceAll("in Excel / manuell", "in Excel-Listen bzw. manuellen Aufzeichnungen");
  next = next.replaceAll("Excel / manuell", "Excel-Listen bzw. manuelle Aufzeichnungen");
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
    "Bitte prüfen Sie, ob die beschriebenen Abläufe zu Ihrem Betrieb passen.",
  );
  next = next.replaceAll("Robert Funke", "[bitte prüfen]");
  next = next.replaceAll("Ines Wolf", "[bitte prüfen]");
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
  if (options.software) next = applyChosenFibu(next, options.software);
  if (options.selfBooking) next = stripUnstatedBookkeeping(next, options.software ?? "");
  return next;
}

/**
 * Die Buchhaltung im Text ist das gewählte Programm.
 * DATEV bleibt nur in Export- und Übergabeformeln an die Kanzlei.
 */
function fibuForms(software: string): { nom: string; inside: string; bank: string } | null {
  const name = software.trim();
  if (!name || /datev/i.test(name)) return null;
  if (name.startsWith("die von der Kanzlei")) {
    return {
      nom: "die von der Kanzlei eingesetzte Software",
      inside: "in der von der Kanzlei eingesetzten Software",
      bank: "Kontoumsätze werden aus den Kontoauszügen in die Buchhaltung der Kanzlei übernommen",
    };
  }
  if (name.startsWith("Excel-Listen")) {
    return {
      nom: "Excel-Listen bzw. manuelle Aufzeichnungen",
      inside: "in Excel-Listen bzw. manuellen Aufzeichnungen",
      bank: "Kontoumsätze werden aus Kontoauszügen in die Buchhaltung übernommen",
    };
  }
  return {
    nom: name,
    inside: `in ${name}`,
    bank: `Kontoumsätze werden über ${name} in die Buchhaltung übernommen`,
  };
}

export function applyChosenFibu(text: string, software: string): string {
  const forms = fibuForms(software);
  if (!forms) return text;
  const kept: string[] = [];
  const protect = /DATEV-(?:Export|Schnittstelle|Format|Upload)|DATEV Upload|per DATEV|an DATEV/g;
  let next = text.replace(protect, (match) => {
    const token = `§§D${kept.length}§§`;
    kept.push(match);
    return token;
  });
  next = next.replaceAll("Kontoumsätze werden täglich über DATEV Bankdaten abgerufen", forms.bank);
  next = next.replaceAll("unter Beleg-ID in DATEV Unternehmen online", `unter Beleg-ID ${forms.inside}`);
  next = next.replaceAll("in DATEV Unternehmen online", forms.inside);
  next = next.replaceAll("DATEV Lohn und Gehalt (Kanzlei)", "das Lohnprogramm der Kanzlei");
  next = next.replaceAll("DATEV-intern", forms.nom.startsWith("Excel") ? "in den Aufzeichnungen" : "in der Software der Kanzlei");
  next = next.replaceAll("DATEV-Rechenzentrum", "beim Betrieb");
  next = next.replaceAll("in DATEV", forms.inside);
  next = next.replaceAll("DATEV Unternehmen online", forms.nom);
  next = next.replaceAll("DATEV", forms.nom);
  next = next.replaceAll("in die die von der Kanzlei eingesetzte Software", "in der von der Kanzlei eingesetzten Software");
  next = next.replaceAll("in die von der Kanzlei eingesetzte Software", "in der von der Kanzlei eingesetzten Software");
  next = next.replaceAll("in Excel-Listen bzw. manuelle Aufzeichnungen", "in Excel-Listen bzw. manuellen Aufzeichnungen");
  for (let i = 0; i < kept.length; i += 1) next = next.replaceAll(`§§D${i}§§`, kept[i] ?? "");
  return next;
}

function namesBookkeeping(software: string, word: "datev" | "kanzlei"): boolean {
  return software.toLowerCase().includes(word);
}

/** Bei Eigenbuchhaltung nur stehen lassen, was der Kunde selbst genannt hat. */
function stripUnstatedBookkeeping(text: string, software: string): string {
  let next = text;
  if (!namesBookkeeping(software, "datev")) {
    next = next.replaceAll("DATEV", "Buchhaltung laut Betrieb");
  }
  if (!namesBookkeeping(software, "kanzlei")) {
    next = next.replace(/Steuerkanzlei/gi, "Buchhaltung");
    next = next.replace(/Kanzlei/g, "Buchhaltung");
    next = next.replace(/kanzlei/g, "Buchhaltung");
  }
  return next;
}
