import type { IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

/**
 * Demo-only seed. Not the partner-muster PDF fixture.
 *
 * Anonymisierte Beispiel GmbH, fest im Code (kein Speicher, keine Datenbank):
 * Dienstleistung/Beratung, GmbH, 2–5 Mitarbeitende, Eingang nur per E-Mail-PDF,
 * Buchhaltung in DATEV. Bestätigte Angaben sind ausgefüllt. Absichtlich offen
 * bleiben betriebliche Bestätigung, Wiederherstellungstest, Kanzlei-Vereinbarung,
 * Beleg-ID, Anbieterunterlagen und der Fassungszeitraum — damit die Abschlussübersicht
 * beide Gruppen zeigt (vor Verwendung / später).
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
      systeme: [{ name: "DATEV", funktion: "FiBu und Belegablage", typ: "fibu" }],
      hosting: "Anbieter-Cloud",
      it: "Geschäftsführung",
    }),
    B04: q("bestaetigt", {
      originalJeWeg: [{ belegweg: "E-Mail", originalBeschreibung: "empfangene PDF" }],
    }),
    B05: q("unbekannt"),
    C01: q("bestaetigt", { kanaele: ["E-Mail-PDF"] }),
    C02: q("bestaetigt", {
      postfachOderPortal: "rechnung@beispiel.invalid",
      wer: "Ben Muster",
      turnus: "arbeitstäglich",
    }),
    E01: q("bestaetigt", { formate: ["PDF"] }),
    E03: q("bestaetigt", {
      pruefer: "Anna Beispiel",
      kriterien: "Leistungsbezug und Betrag",
    }),
    E05: q("bestaetigt", {
      systeme: "Rechnungssoftware",
      wer: "Anna Beispiel",
      nummernvergabe: "fortlaufend je Jahr",
    }),
    F01: q("bestaetigt", {
      sachlich: "Anna Beispiel",
      freigabe: "Anna Beispiel",
      buchung: "Ben Muster",
      buchhaltung: "Ben Muster",
    }),
    F02: q("unbekannt"),
    F05: q("unbekannt"),
    G01: q("bestaetigt", {
      ablage: "DATEV Unternehmen online",
      ordnung: "Belegdatum und Lieferant",
    }),
    G02: q("bestaetigt", {
      zugriffKurz: "Geschäftsführung und Buchhaltung dürfen lesen, nur die Buchhaltung ändert",
      berechtigungslisteVorhanden: "nein",
    }),
    G05: q("bestaetigt", {
      rolleFristen: "Geschäftsführung",
      verfahren: "Löschung erst nach Prüfung der Frist durch die Geschäftsführung",
    }),
    G06: q("bestaetigt", {
      backupArten: "Sicherung durch den Anbieter",
      wiederherstellungGetestet: "unbekannt",
    }),
    H01: q("bestaetigt", {
      kontrollen: [
        {
          name: "Stichprobe Eingangsrechnungen",
          turnus: "monatlich",
          wer: "Anna Beispiel",
          nachweis: "Notiz in der Monatsmappe",
        },
      ],
    }),
    H04: q("unbekannt"),
    I01: q("bestaetigt", {
      pfleger: "Anna Beispiel",
      ausloeser: "Wechsel eines Systems oder eines Ablaufs",
    }),
    I02: q("bestaetigt", {
      anlagen: [{ name: "Vertrag DATEV", status: "vorhanden" }],
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
