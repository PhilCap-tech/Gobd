import type { IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

/**
 * Demo-only seed. Not the partner-muster PDF fixture.
 *
 * Anonymisierte Beispiel GmbH, fest im Code (kein Speicher, keine Datenbank):
 * Dienstleistung/Beratung, GmbH, 2–5 Mitarbeitende, Eingang nur per E-Mail-PDF,
 * Buchhaltung in DATEV. Bestätigte Angaben sind ausgefüllt. Absichtlich offen
 * bleiben betriebliche Prüfung des Entwurfs, Wiederherstellungstest, Kanzlei,
 * Beleg-ID, Anbieterunterlagen und der Fassungszeitraum — damit die Abschlussübersicht
 * beide Gruppen zeigt (vor Verwendung / später).
 * Status: „So läuft es heute“ ist bestaetigt, „Muss ich klären“ ist unbekannt.
 * „Nicht zutreffend“ kommt nur aus der Sachangabe, nicht aus einem Extra-Status.
 */
export const DEMO_BEISPIEL_SEED_NOTE =
  "Beispielbetrieb: anonymisierte Beispiel GmbH, Dienstleistung, GmbH, 2–5 Mitarbeitende, Eingang per E-Mail, Buchhaltung in DATEV. Einige Punkte sind absichtlich offen.";

type CatalogStatus = "bestaetigt" | "geplant" | "unbekannt" | "nicht_zutreffend";

function q(
  status: CatalogStatus,
  values: Record<string, unknown> = {},
): NonNullable<IntakeAnswers["katalog"]>[string] {
  return { status, values };
}

export function demoBeispielAnswers(): IntakeAnswers {
  const answers = emptyAnswers();
  answers.katalog = {
    A01: q("bestaetigt", {
      company: "Beispiel GmbH",
      standort: "Musterstadt",
      branchen: ["Dienstleistung/Beratung"],
      rechtsform: "GmbH",
      mitarbeitende: "2–5",
      gf: "Anna Beispiel",
    }),
    A02: q("bestaetigt", {
      belegartenScope: ["Eingangsrechnungen", "Ausgangsrechnungen", "sonstige Buchungsbelege"],
      ausgeschlossen: [],
    }),
    A03: q("bestaetigt", {
      kasse: "nein",
      shop: "nein",
      lager: "nein",
      lohn: "nein",
      plattformen: "nein",
    }),
    A04: q("bestaetigt", {
      gueltigAb: "2023-01-01",
      keineRueckdatierungBestaetigt: true,
    }),
    B01: q("bestaetigt", {
      systeme: [
        {
          name: "DATEV",
          funktion: "FiBu und Belegablage",
          typ: "fibu",
          nutzer: "Geschäftsführung und Buchhaltung",
          belegeRein: ["Eingangsrechnungen", "Ausgangsrechnungen"],
          uebergabe: "Ablage in DATEV Unternehmen online",
          originalOrt: "DATEV Unternehmen online",
          hostingArt: "Anbieter-Cloud",
        },
      ],
      hosting: "Anbieter-Cloud",
      it: "Geschäftsführung",
    }),
    B04: q("bestaetigt", {
      originalJeWeg: [{ belegweg: "E-Mail-PDF", originalBeschreibung: "empfangene PDF" }],
    }),
    B05: q("unbekannt", { anbieter: "unbekannt" }),
    C01: q("bestaetigt", { kanaele: ["E-Mail-PDF"] }),
    C02: q("bestaetigt", {
      postfachOderPortal: "rechnung@beispiel.invalid",
      wer: "Ben Muster",
      turnus: "täglich",
      kanaeleDetail: {
        "E-Mail-PDF": {
          ort: "rechnung@beispiel.invalid",
          wer: "Ben Muster",
          turnus: "täglich",
          turnusFrei: "",
          uebergabe: "Weiterleitung an die Buchhaltung in DATEV",
          ausnahmen: "keine",
        },
      },
    }),
    E01: q("bestaetigt", { formate: ["PDF"] }),
    E03: q("bestaetigt", {
      pruefer: "Anna Beispiel",
      kriterienAuswahl: ["Leistungsbezug", "Betrag"],
      kriterien: "Leistungsbezug, Betrag",
    }),
    E05: q("bestaetigt", {
      systeme: "Rechnungssoftware",
      wer: "Anna Beispiel",
      freigabe: "Anna Beispiel",
      nummernvergabe: "fortlaufend je Jahr",
      versand: "E-Mail an den Kunden",
      storno: "Storno als eigene Rechnung, das Original bleibt",
    }),
    F01: q("bestaetigt", {
      sachlich: "Anna Beispiel",
      freigabe: "Anna Beispiel",
      buchung: "Ben Muster",
      buchhaltung: "Ben Muster",
      schrittSystem: {
        sachlich: "DATEV",
        freigabe: "DATEV",
        buchung: "DATEV",
      },
      schrittNachweis: {
        sachlich: "Vermerk am Beleg",
        freigabe: "Freigabestatus in DATEV",
        buchung: "Buchungssatz mit Belegbezug",
      },
    }),
    F02: q("unbekannt"),
    F05: q("unbekannt", { kanzleiBeteiligt: "unbekannt" }),
    G01: q("bestaetigt", {
      ablageJeArt: [
        {
          art: "Eingangsrechnungen",
          ort: "DATEV Unternehmen online",
          suche: "Belegdatum und Lieferant",
        },
        {
          art: "Ausgangsrechnungen",
          ort: "DATEV Unternehmen online",
          suche: "Rechnungsnummer",
        },
      ],
      ablage: "DATEV Unternehmen online",
      ordnung: "Eingangsrechnungen: Belegdatum und Lieferant; Ausgangsrechnungen: Rechnungsnummer",
    }),
    G02: q("bestaetigt", {
      zugriffRollen: [
        { rolle: "Geschäftsführung", rechte: ["lesen"] },
        { rolle: "Buchhaltung", rechte: ["lesen", "ändern"] },
      ],
      zugriffKurz: "Geschäftsführung: lesen. Buchhaltung: lesen, ändern",
      berechtigungslisteVorhanden: "nein",
    }),
    G05: q("bestaetigt", {
      rolleFristen: "Geschäftsführung",
      verfahren: "Löschung erst nach Prüfung der Frist durch die Geschäftsführung",
    }),
    G06: q("bestaetigt", {
      sicherung: ["Anbieter sichert"],
      backupArten: "Sicherung durch den Anbieter",
      wiederherstellungGetestet: "nein",
    }),
    H01: q("bestaetigt", {
      kontrollen: [
        {
          name: "Stichprobe",
          turnusWahl: "monatlich",
          turnus: "monatlich",
          wer: "Anna Beispiel",
          nachweis: "Notiz in der Monatsmappe",
        },
      ],
    }),
    H04: q("unbekannt", { status: "unbekannt" }),
    I01: q("bestaetigt", {
      pfleger: "Anna Beispiel",
      ausloeserAuswahl: ["neues oder ersetztes System"],
      ausloeser: "neues oder ersetztes System",
    }),
    I02: q("bestaetigt", {
      anlagen: [
        { name: "Vertrag mit dem Anbieter", status: "vorhanden" },
        { name: "Leistungsbeschreibung", status: "nicht_zutreffend" },
        { name: "Berechtigungskonzept", status: "offen" },
        { name: "Nachweis Aufbewahrung oder Export", status: "nicht_zutreffend" },
        { name: "Kontrollnachweise", status: "vorhanden" },
      ],
    }),
    I04: q("unbekannt"),
    I05: q("unbekannt"),
  };
  return answers;
}

/** Empty catalog so the demo validates the catalog, not the legacy short intake. */
export function demoBlankAnswers(): IntakeAnswers {
  return { ...emptyAnswers(), katalog: { A01: { values: {} } } };
}
