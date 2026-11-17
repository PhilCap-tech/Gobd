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

function ohneMarker(pack: BausteinPack): BausteinPack {
  const out = { ...pack };
  for (const key of Object.keys(out) as Array<keyof BausteinPack>) {
    out[key] = out[key].replaceAll(" [bitte prüfen]", "").replaceAll("[bitte prüfen]", "").replace(/\s{2,}/g, " ").trim();
  }
  return out;
}

function buildPack(fall: StandardFall): BausteinPack {
  const lohnProgramm = fall.self
    ? "Die Lohnabrechnung erfolgt extern (z. B. über ein Lohnbüro)."
    : "Die Lohnabrechnung erfolgt extern (z. B. Lohnbüro oder Steuerkanzlei).";
  const kanzleiFrei = "Die Buchhaltung liegt im Unternehmen. [bitte prüfen]";
  if (fall.datev && !fall.self) {
    return {
      ablage: `Nachweis und Ablage unter Beleg-ID in DATEV Unternehmen online. ${AUFBEWAHRUNG}`,
      lohnProgramm,
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
      lohnProgramm,
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
      lohnProgramm,
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
      lohnProgramm,
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

export function bausteinPack(fall: StandardFall): BausteinPack {
  return ohneMarker(buildPack(fall));
}

/** Sätze, die in jedem PDF dieses Falls vorkommen. */
export function pflichtBausteine(fall: StandardFall): string[] {
  const pack = bausteinPack(fall);
  return [pack.ablage, pack.bank, pack.lohnProgramm, pack.schnittstelle];
}

/** Prozessbegriffe, die in dieser Branche nicht vorkommen. */
export const BRANCHEN_FREMDE: Record<string, readonly string[]> = {
  gastro: ["ERP", "Fertigung", "Mindestbestand", "Feinmechanik", "Handscanner", "WaWi Lagerplus", "Baustelle", "Aufmaß", "Bautagebuch", "Nachunternehmer", "Shopify", "Marktplatz", "Praxissoftware", "Taxameter"],
  handwerk: ["ERP", "Fertigung", "Mindestbestand", "Feinmechanik", "Handscanner", "TSE", "Z-Bon", "Theke", "Shopify", "Marktplatz", "Trinkgeld", "Kassensturz", "WaWi Lagerplus"],
  handel: ["Fertigung", "Mindestbestand", "Feinmechanik", "Theke", "TSE", "Z-Bon", "Baustelle", "Aufmaß", "Bautagebuch", "Shopify", "Praxissoftware", "Taxameter"],
  ecommerce: ["Fertigung", "Mindestbestand", "Feinmechanik", "Theke", "TSE", "Z-Bon", "Baustelle", "Aufmaß", "Kassensturz", "Handscanner", "Praxissoftware", "Taxameter"],
  dienstleistung: ["ERP", "Fertigung", "Mindestbestand", "TSE", "Z-Bon", "Theke", "Shopify", "Marktplatz", "Baustelle", "Aufmaß", "Handscanner", "Kassensturz"],
  freiberuf: ["ERP", "Fertigung", "Mindestbestand", "TSE", "Z-Bon", "Theke", "Shopify", "Marktplatz", "Baustelle", "Aufmaß", "Handscanner", "Kassensturz"],
  sonstiges: ["ERP", "Fertigung", "Mindestbestand", "TSE", "Z-Bon", "Theke", "Shopify", "Marktplatz", "Baustelle", "Aufmaß", "Handscanner", "Kassensturz"],
};

export function dropFremdeProzesse(text: string, branche: string): string {
  const terms = BRANCHEN_FREMDE[branche] ?? [];
  if (!terms.length) return text;
  const hit = (part: string) => terms.some((term) => part.includes(term));
  return text
    .split("\n")
    .map((line) => {
      const masked = line.replaceAll("z. B.", "z§B");
      const parts = masked.includes(". ") ? masked.split(/(?<=\.)\s+/) : [masked];
      return parts.filter((part) => !hit(part)).join(" ").replaceAll("z§B", "z. B.");
    })
    .join("\n");
}

/** Gleiche Sätze ab dieser Länge. Kürzere Tabellenzellen zählen nicht. */
export function repeatedSentences(text: string, max = 3): string[] {
  const counts = new Map<string, number>();
  for (const line of text.split("\n")) {
    const masked = line.replaceAll("z. B.", "z§B");
    const parts = masked.includes(". ") ? masked.split(/(?<=\.)\s+/) : [masked];
    for (const part of parts) {
      const key = part.replaceAll("z§B", "z. B.").replace(/\s+/g, " ").trim();
      if (key.length < 28) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count > max).map(([sentence, count]) => `${count}× ${sentence.slice(0, 80)}`);
}

export function limitIdenticalSentences(text: string, max = 1, counts = new Map<string, number>()): string {
  return text
    .split("\n")
    .map((line) => {
      const masked = line.replaceAll("z. B.", "z§B");
      const parts = masked.includes(". ") ? masked.split(/(?<=\.)\s+/) : [masked];
      const kept = parts.filter((part) => {
        const key = part.replaceAll("z§B", "z. B.").replace(/\s+/g, " ").trim();
        if (key.length < 28) return true;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next <= max;
      });
      return kept.join(" ").replaceAll("z§B", "z. B.");
    })
    .join("\n");
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

function rewriteChunk(chunk: string, fall: StandardFall): string {
  if (!needsRewrite(chunk, fall)) return chunk;
  return "";
}

/** Ersetzt Software-, Kanzlei-, Lohn- und Bank-Passagen durch den Baustein des Falls. */
export function applyStandardBausteine(text: string, fall: StandardFall): string {
  let next = text.replaceAll("Schnittstellen: Schnittstellen:", "Schnittstellen: ");
  next = next.replace(SUFFIX, "");
  next = next
    .split("\n")
    .map((line) => {
      const masked = line.replaceAll("z. B.", "z§B");
      const parts = masked.includes(". ") ? masked.split(/(?<=\.)\s+/) : [masked];
      return parts.map((part) => rewriteChunk(part, fall)).join(" ").replaceAll("z§B", "z. B.");
    })
    .join("\n");
  return limitIdenticalSentences(next, 1);
}

/** Einmal im Systemteil, nicht in jedem Prozess. */
export function standardSystemSection(fall: StandardFall): string {
  const pack = bausteinPack(fall);
  const lines = [pack.system, pack.ablage, pack.bank, pack.lohnProgramm, pack.schnittstelle].filter(Boolean);
  return `# Systeme und Buchhaltung\n\n${lines.join("\n\n")}`;
}
