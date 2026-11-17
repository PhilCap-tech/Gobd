/**
 * Textbausteine der Standardfassung.
 * Software, Kanzlei, Lohn und Bank werden nicht mehr per Ersetzung in den
 * Vollversionstext eingesetzt. Jeder Fall hat eigene Sätze.
 * Die Vollversion ruft diese Datei nicht auf.
 */

export type BausteinKind = "datev" | "lexoffice" | "sevdesk" | "excel" | "unbekannt" | "named";

export type StandardFall = {
  kind: BausteinKind;
  name: string;
  self: boolean;
  datev: boolean;
  excel: boolean;
};

export type BausteinInput = {
  software: string;
  softwareFrei?: string;
  bucht: string;
};

const AUFBEWAHRUNG = "Aufbewahrung der Buchungsbelege 10 Jahre (§ 147 Abs. 3 AO).";

export function standardFall(input: BausteinInput): StandardFall {
  const self = input.bucht === "Wir selbst im Unternehmen";
  const frei = (input.softwareFrei ?? "").trim();
  if (input.software === "DATEV") return { kind: "datev", name: "DATEV", self, datev: true, excel: false };
  if (input.software === "lexoffice") return { kind: "lexoffice", name: "lexoffice", self, datev: false, excel: false };
  if (input.software === "sevdesk") return { kind: "sevdesk", name: "sevdesk", self, datev: false, excel: false };
  if (input.software === "Excel / manuell") {
    return { kind: "excel", name: "Excel-Listen bzw. manuelle Aufzeichnungen", self, datev: false, excel: true };
  }
  if (input.software === "Weiß ich nicht, macht die Kanzlei") {
    return {
      kind: "unbekannt",
      name: self ? "die eingesetzte Buchhaltungssoftware" : "die von der Kanzlei eingesetzte Software",
      self,
      datev: false,
      excel: false,
    };
  }
  return { kind: "named", name: frei || "die eingesetzte Buchhaltungssoftware", self, datev: false, excel: false };
}

export type BausteinPack = {
  ablage: string;
  lohnProgramm: string;
  lohnProtokoll: string;
  lohnAblage: string;
  lohnFibu: string;
  lohnMeldung: string;
  lohnZugriff: string;
  bank: string;
  zahlung: string;
  kasse: string;
  schnittstelle: string;
  archiv: string;
  system: string;
  kanzleiFrei: string;
};

export function bausteinPack(fall: StandardFall): BausteinPack {
  const lohnKanzlei = "Lohn über das Lohnbüro oder die Kanzlei. [bitte prüfen]";
  const lohnSelbst = "Lohn über ein Lohnbüro. [bitte prüfen]";
  const lohnProgramm = fall.self ? "Lohnprogramm: laut Betrieb. [bitte prüfen]" : "Lohnprogramm: das Lohnprogramm der Kanzlei. [bitte prüfen]";
  const kanzleiFrei = "Die Buchhaltung liegt im Unternehmen. [bitte prüfen]";
  if (fall.datev && !fall.self) {
    return {
      ablage: `Nachweis und Ablage unter Beleg-ID in DATEV Unternehmen online. ${AUFBEWAHRUNG}`,
      lohnProgramm: "Lohnprogramm: DATEV Lohn und Gehalt oder LODAS bei der Kanzlei. [bitte prüfen]",
      lohnProtokoll: "Übermittlungsprotokolle legt die Kanzlei ab. [bitte prüfen]",
      lohnAblage: "Ablageort der Lohnunterlagen: bei der Kanzlei.",
      lohnFibu: "Die Kanzlei übernimmt die Lohnbuchungen in die Finanzbuchhaltung.",
      lohnMeldung: "Personaländerungen gehen an die Kanzlei. [bitte prüfen]",
      lohnZugriff: "Zugriff auf Lohnlisten nur für [bitte prüfen].",
      bank: "Kontoumsätze stellt die Bank als Kontoauszug bereit. Die Kanzlei übernimmt sie in DATEV. [bitte prüfen]",
      zahlung: "Zahlungen laufen über das Onlinebanking. Die Freigabe liegt bei [bitte prüfen].",
      kasse: "Monatlicher Export aus dem Kassensystem an die Kanzlei. [bitte prüfen]",
      schnittstelle: "Übergabe an DATEV laut Betrieb. [bitte prüfen]",
      archiv: "Belege liegen in DATEV Unternehmen online. [bitte prüfen]",
      system: "Buchhaltung in DATEV Unternehmen online bei der Kanzlei. Hosting [bitte prüfen].",
      kanzleiFrei,
    };
  }
  if (fall.datev && fall.self) {
    return {
      ablage: `Nachweis und Ablage unter Beleg-ID in DATEV. ${AUFBEWAHRUNG}`,
      lohnProgramm: lohnSelbst,
      lohnProtokoll: "Übermittlungsprotokolle werden im Unternehmen abgelegt. [bitte prüfen]",
      lohnAblage: "Ablageort der Lohnunterlagen: im Unternehmen. [bitte prüfen]",
      lohnFibu: "Die Lohnbuchungen übernimmt die Buchhaltung im Unternehmen.",
      lohnMeldung: "Personaländerungen erfasst der Betrieb. [bitte prüfen]",
      lohnZugriff: "Zugriff auf Lohnlisten nur für [bitte prüfen].",
      bank: "Kontoumsätze werden aus Kontoauszügen in DATEV übernommen. [bitte prüfen]",
      zahlung: "Zahlungen laufen über das Onlinebanking. Die Freigabe liegt bei [bitte prüfen].",
      kasse: "Monatlicher Export aus dem Kassensystem in die Buchhaltung. [bitte prüfen]",
      schnittstelle: "Übergabe an DATEV laut Betrieb. [bitte prüfen]",
      archiv: "Belege liegen in DATEV. [bitte prüfen]",
      system: "Buchhaltung in DATEV im Unternehmen. Hosting [bitte prüfen].",
      kanzleiFrei,
    };
  }
  if (fall.excel) {
    return {
      ablage: `Nachweis und Ablage in Excel-Listen bzw. manuellen Aufzeichnungen. Die Buchhaltung nutzt Excel-Listen bzw. manuelle Aufzeichnungen. ${AUFBEWAHRUNG}`,
      lohnProgramm: fall.self ? lohnSelbst : lohnKanzlei,
      lohnProtokoll: "Übermittlungsprotokolle werden abgelegt. [bitte prüfen]",
      lohnAblage: fall.self
        ? "Ablageort der Lohnunterlagen: im Unternehmen. [bitte prüfen]"
        : "Ablageort der Lohnunterlagen: bei der Kanzlei. [bitte prüfen]",
      lohnFibu: "Lohn an die Finanzbuchhaltung: manuelle Übernahme der Lohnliste.",
      lohnMeldung: fall.self
        ? "Personaländerungen erfasst der Betrieb. [bitte prüfen]"
        : "Personaländerungen gehen an die Kanzlei. [bitte prüfen]",
      lohnZugriff: "Lohnlisten nur für [bitte prüfen] zugänglich.",
      bank: "Kontoauszüge der Bank liegen als PDF oder auf Papier in der Belegablage.",
      zahlung: "Zahlungen erfasst der Betrieb manuell im Onlinebanking. [bitte prüfen]",
      kasse: "Kassenberichte gehen als Liste an die Buchhaltung. [bitte prüfen]",
      schnittstelle: "Keine technische Schnittstelle. Die Erfassung erfolgt manuell. [bitte prüfen]",
      archiv: "Belege liegen in der Belegablage. [bitte prüfen]",
      system: "Buchhaltung über Excel-Listen bzw. manuelle Aufzeichnungen. Ablage lokal. [bitte prüfen]",
      kanzleiFrei,
    };
  }
  if (fall.kind === "unbekannt" && fall.self) {
    return {
      ablage: `Nachweis und Ablage in der eingesetzten Buchhaltungssoftware. ${AUFBEWAHRUNG}`,
      lohnProgramm: lohnSelbst,
      lohnProtokoll: "Übermittlungsprotokolle werden im Unternehmen abgelegt. [bitte prüfen]",
      lohnAblage: "Ablageort der Lohnunterlagen: im Unternehmen. [bitte prüfen]",
      lohnFibu: "Die Lohnbuchungen übernimmt die Buchhaltung im Unternehmen.",
      lohnMeldung: "Personaländerungen erfasst der Betrieb. [bitte prüfen]",
      lohnZugriff: "Zugriff auf Lohnlisten nur für [bitte prüfen].",
      bank: "Kontoumsätze werden aus Kontoauszügen in die Buchhaltung übernommen. [bitte prüfen]",
      zahlung: "Zahlungen laufen über das Onlinebanking. Die Freigabe liegt bei [bitte prüfen].",
      kasse: "Monatlicher Export aus dem Kassensystem in die Buchhaltung. [bitte prüfen]",
      schnittstelle: "Übergabe an die Buchhaltung laut Betrieb. [bitte prüfen]",
      archiv: "Belege liegen in der Belegablage des Betriebs. [bitte prüfen]",
      system: "Buchhaltung in der eingesetzten Buchhaltungssoftware im Unternehmen. Hosting [bitte prüfen].",
      kanzleiFrei,
    };
  }
  if (fall.kind === "unbekannt") {
    return {
      ablage: `Nachweis und Ablage in der von der Kanzlei eingesetzten Software. Die Buchhaltung nutzt die von der Kanzlei eingesetzte Software. ${AUFBEWAHRUNG}`,
      lohnProgramm,
      lohnProtokoll: "Übermittlungsprotokolle legt die Kanzlei ab. [bitte prüfen]",
      lohnAblage: "Ablageort der Lohnunterlagen: bei der Kanzlei.",
      lohnFibu: "Die Kanzlei übernimmt die Lohnbuchungen in die Finanzbuchhaltung.",
      lohnMeldung: "Personaländerungen gehen an die Kanzlei. [bitte prüfen]",
      lohnZugriff: "Zugriff auf Lohnlisten nur für [bitte prüfen].",
      bank: "Kontoumsätze stellt die Bank als Kontoauszug bereit. Die Kanzlei übernimmt sie in die Buchhaltung. [bitte prüfen]",
      zahlung: "Zahlungen laufen über das Onlinebanking. Die Freigabe liegt bei [bitte prüfen].",
      kasse: "Monatlicher Export aus dem Kassensystem an die Kanzlei. [bitte prüfen]",
      schnittstelle: "Übergabe an die Kanzlei laut Betrieb. [bitte prüfen]",
      archiv: "Belege liegen bei der Kanzlei. [bitte prüfen]",
      system: "Buchhaltung in der von der Kanzlei eingesetzten Software. Hosting [bitte prüfen].",
      kanzleiFrei,
    };
  }
  const name = fall.name;
  return {
    ablage: `Nachweis und Ablage in ${name}. ${AUFBEWAHRUNG}`,
    lohnProgramm,
    lohnProtokoll: fall.self
      ? "Übermittlungsprotokolle werden im Unternehmen abgelegt. [bitte prüfen]"
      : "Übermittlungsprotokolle legt die Kanzlei ab. [bitte prüfen]",
    lohnAblage: fall.self
      ? "Ablageort der Lohnunterlagen: im Unternehmen. [bitte prüfen]"
      : "Ablageort der Lohnunterlagen: bei der Kanzlei.",
    lohnFibu: fall.self
      ? `Die Lohnbuchungen übernimmt die Buchhaltung im Unternehmen in ${name}.`
      : "Die Kanzlei übernimmt die Lohnbuchungen in die Finanzbuchhaltung.",
    lohnMeldung: fall.self
      ? "Personaländerungen erfasst der Betrieb. [bitte prüfen]"
      : "Personaländerungen gehen an die Kanzlei. [bitte prüfen]",
    lohnZugriff: "Zugriff auf Lohnlisten nur für [bitte prüfen].",
    bank: `Kontoumsätze werden aus Kontoauszügen in ${name} übernommen. [bitte prüfen]`,
    zahlung: "Zahlungen laufen über das Onlinebanking. Die Freigabe liegt bei [bitte prüfen].",
    kasse: fall.self
      ? "Monatlicher Export aus dem Kassensystem in die Buchhaltung. [bitte prüfen]"
      : "Monatlicher Export aus dem Kassensystem an die Kanzlei. [bitte prüfen]",
    schnittstelle: fall.self
      ? `Übergabe an ${name} laut Betrieb. [bitte prüfen]`
      : `Übergabe an die Kanzlei laut Betrieb. [bitte prüfen]`,
    archiv: `Belege liegen in ${name}. [bitte prüfen]`,
    system: fall.self
      ? `Buchhaltung in ${name} im Unternehmen. Hosting [bitte prüfen].`
      : `Buchhaltung in ${name}. Die Kanzlei bucht. Hosting [bitte prüfen].`,
    kanzleiFrei,
  };
}

/** Sätze, die in jedem PDF dieses Falls vorkommen. */
export function pflichtBausteine(fall: StandardFall): string[] {
  const pack = bausteinPack(fall);
  return [pack.ablage, pack.bank, pack.lohnProgramm, pack.schnittstelle];
}

const SUFFIX = /Nachweis und Ablage unter Beleg-ID in DATEV Unternehmen online;[\s\S]*?§ 147 Abs\. 3 AO\)\./g;

function needsRewrite(chunk: string, fall: StandardFall): boolean {
  if (/Kontoumsätze werden täglich|Bank an DATEV|MT940|per DATEV Upload|DATEV Upload|täglich über DATEV/.test(chunk)) return true;
  if (fall.datev && !fall.self) return false;
  if (fall.self && /Kanzlei|Steuerkanzlei/.test(chunk)) return true;
  if (!fall.datev && /DATEV|LODAS/.test(chunk)) return true;
  if (/Lohn und Gehalt/.test(chunk) && !(fall.datev && !fall.self)) return true;
  if (fall.excel && /SEPA|MT940|Schnittstelle|Cloud-Anbieter|Hosting Anbieter-Cloud|Eigene Rolle|Upload|Zahlungsvorschlag|Export\/Upload/.test(chunk)) {
    return true;
  }
  if ((fall.excel || fall.kind === "unbekannt") && /Hosting Anbieter-Cloud|Cloud-Anbieter/.test(chunk)) return true;
  return false;
}

function topicOf(chunk: string): keyof BausteinPack {
  if (/Lohnprogramm|LODAS|Lohn und Gehalt/.test(chunk)) return "lohnProgramm";
  if (/Übermittlungsprotokoll/.test(chunk)) return "lohnProtokoll";
  if (/Lohnkonto|Lohnunterlagen|Lohnauswertungen|Rechenzentrum/.test(chunk)) return "lohnAblage";
  if (/Lohnbuchungen|Lohn an FiBu|Buchungsdatensatz|DATEV-intern|Lohn an DATEV/.test(chunk)) return "lohnFibu";
  if (/Personalfragebogen|Änderungsmeldung|DATEV Upload|Upload in /.test(chunk)) return "lohnMeldung";
  if (/Eigene Rolle|Zugriff auf Lohndaten|Zugriffsberechtigte/.test(chunk)) return "lohnZugriff";
  if (/Kontoumsätze|Bank an DATEV|MT940|Umsatzabruf|DATEV Bankdaten|Bank -> DATEV|Bank → DATEV/.test(chunk)) return "bank";
  if (/Zahlungsvorschlag|SEPA/.test(chunk)) return "zahlung";
  if (/Kassensystem|DATEV-Export/.test(chunk)) return "kasse";
  if (/Schnittstelle/.test(chunk)) return "schnittstelle";
  if (/im Archiv|E-Rechnung/.test(chunk)) return "archiv";
  if (/Beleg-ID|Ablage im DMS|unter Projektnummer/.test(chunk)) return "ablage";
  if (/DATEV|Cloud-Anbieter|Hosting Anbieter-Cloud|Original /.test(chunk)) return "system";
  if (/Kanzlei|Steuerkanzlei/.test(chunk)) return "kanzleiFrei";
  return "system";
}

function rewriteChunk(chunk: string, fall: StandardFall, pack: BausteinPack): string {
  if (!needsRewrite(chunk, fall)) return chunk;
  return pack[topicOf(chunk)];
}

/** Ersetzt Software-, Kanzlei-, Lohn- und Bank-Passagen durch den Baustein des Falls. */
export function applyStandardBausteine(text: string, fall: StandardFall): string {
  const pack = bausteinPack(fall);
  let next = text.replaceAll("Schnittstellen: Schnittstellen:", "Schnittstellen: ");
  next = next.replace(SUFFIX, pack.ablage);
  next = next
    .split("\n")
    .map((line) => {
      const masked = line.replaceAll("z. B.", "z§B");
      const parts = masked.includes(". ") ? masked.split(/(?<=\.)\s+/) : [masked];
      return parts.map((part) => rewriteChunk(part, fall, pack)).join(" ").replaceAll("z§B", "z. B.");
    })
    .join("\n");
  const kern = [pack.ablage, pack.bank, pack.lohnProgramm, pack.schnittstelle].filter((satz) => !next.includes(satz));
  if (kern.length > 0) next = `${next}\n\n${kern.join(" ")}`;
  return next;
}
