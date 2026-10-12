/**
 * Fixtures for scripts/check-pdf-consistency.ts.
 * Pixelwerk: Kleinstbetrieb ohne Kanzlei, Kasse, Shop, Lohn, Kreditkarte
 * und ohne Vier-Augen-Prüfung. Sichtung wöchentlich, Backup auf NAS.
 * Die zweite Fixture bestätigt Kanzlei, Kasse und Vier-Augen.
 */
import { ensureGesamt, setCheckAntwort } from "@/lib/module/status";
import type { CheckKey } from "@/lib/module/typen";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

type Status = "bestaetigt" | "geplant" | "unbekannt" | "nicht_zutreffend";

function q(
  status: Status,
  values: Record<string, unknown> = {},
  reason = "",
): NonNullable<IntakeAnswers["katalog"]>[string] {
  return { status, values, ...(reason ? { reason } : {}) };
}

function withCheck(
  answers: IntakeAnswers,
  pairs: Array<[CheckKey, "ja" | "nein" | "unbekannt"]>,
): IntakeAnswers {
  return pairs.reduce((current, [key, value]) => setCheckAntwort(current, key, value), answers);
}

/** TEST Pixelwerk: Angaben aus dem QA-Lauf, ohne erfundene Verfahren. */
export function pixelwerkAnswers(): IntakeAnswers {
  const base = withCheck(ensureGesamt(emptyAnswers()), [
    ["bargeld", "nein"],
    ["lager", "nein"],
    ["personal", "nein"],
    ["zeiterfassung", "nein"],
    ["online", "nein"],
    ["retouren", "nein"],
    ["papier", "ja"],
    ["erechnung", "ja"],
    ["anlagen", "unbekannt"],
    ["kanzlei", "nein"],
    ["branche", "nein"],
    ["zahlungsdienstleister", "ja"],
  ]);
  return {
    ...base,
    gf: "Jana Probst",
    buchhaltung: "Jana Probst",
    mitarbeitende: "nur ich",
    rechtsform: "Einzelunternehmen",
    branchen: ["Dienstleistung/Beratung"],
    katalog: {
      A01: q("bestaetigt", {
        company: "TEST Pixelwerk Webdesign Jana Probst",
        gf: "Jana Probst",
        mitarbeitende: "nur ich",
        rechtsform: "Einzelunternehmen",
        branchen: ["Dienstleistung/Beratung"],
      }),
      C02: q("bestaetigt", {
        turnus: "wöchentlich",
        wer: "Jana Probst",
        postfachOderPortal: "rechnung@pixelwerk-test.example",
        kanaeleDetail: {
          "E-Mail-PDF": {
            ort: "rechnung@pixelwerk-test.example",
            wer: "Jana Probst",
            turnus: "wöchentlich",
            uebergabe: "lexoffice Belegarchiv",
            ausnahmen: "keine",
          },
        },
      }),
      E02: q("bestaetigt", {
        ablauf: "per E-Mail lexoffice lexoffice liest XML",
        validierung: "unbekannt",
      }),
      F01: q("bestaetigt", {
        buchhaltung: "Jana Probst",
        sachlich: "Jana Probst",
        freigabe: "Jana Probst",
        buchung: "Jana Probst",
      }),
      F05: q("nicht_zutreffend", { kanzleiBeteiligt: "nein" }, "Keine externe Steuerberatung."),
      G06: q("bestaetigt", {
        backupArten: "NAS, wöchentlich, 12 Wochen",
        wiederherstellungGetestet: "nein",
      }),
      SN01: q("bestaetigt", {
        konzept: "Cloud-Daten beim Anbieter; lokale Dateien wöchentlich auf NAS, 12 Wochen Aufbewahrung.",
      }),
      BA01: q("bestaetigt", { konten: "Hausbank, Geschäftskonto", karten: "keine" }),
      BA05: q("bestaetigt", { wer: "Jana Probst", vierAugen: "nein" }),
      BA09: q("bestaetigt", { ablauf: "keine Kreditkarte; Barauslagen per Foto" }),
      BA92: q("bestaetigt", { kontrollen: ["Keine regelmäßige Kontrolle"] }),
      EK04: q("bestaetigt", { wer: "Jana Probst", vierAugen: "nein" }),
      H01: q("bestaetigt", {
        kontrollen: [
          { name: "Lückenprüfung Rechnungsnummern", turnus: "monatlich", wer: "Jana Probst", nachweis: "Nummernliste" },
        ],
      }),
      KF02: q("bestaetigt", { kontrollen: "Vier-Augen-Prinzip ab 1.000 €, Stichproben monatlich" }),
      AU03: q("bestaetigt", {
        ablauf: "Belege laufend digital, Auswertungen monatlich zurück per Kanzlei-Portal",
      }),
      I02: q("bestaetigt", {
        anlagen: [
          { name: "Vertrag mit dem Anbieter", status: "vorhanden" },
          { name: "Leistungsbeschreibung", status: "vorhanden" },
          { name: "Berechtigungskonzept", status: "offen" },
          { name: "Nachweis Aufbewahrung oder Export", status: "vorhanden" },
          { name: "Kontrollnachweise", status: "vorhanden" },
          { name: "Systemverzeichnis", status: "vorhanden" },
          { name: "Kanzleivertrag", status: "nicht_zutreffend" },
        ],
      }),
    },
  };
}

/** Gegenprobe: Kanzlei, Kasse und Vier-Augen sind bestätigt und müssen erscheinen. */
export function kanzleiKasseAnswers(): IntakeAnswers {
  const base = withCheck(ensureGesamt(emptyAnswers()), [
    ["bargeld", "ja"],
    ["lager", "nein"],
    ["personal", "nein"],
    ["zeiterfassung", "nein"],
    ["online", "nein"],
    ["retouren", "nein"],
    ["papier", "nein"],
    ["erechnung", "nein"],
    ["anlagen", "nein"],
    ["kanzlei", "ja"],
    ["branche", "nein"],
    ["zahlungsdienstleister", "nein"],
  ]);
  return {
    ...base,
    gf: "Anna Beispiel",
    buchhaltung: "Ben Muster",
    steuerberater: "Kanzlei Nordlicht",
    mitarbeitende: "4",
    katalog: {
      A01: q("bestaetigt", {
        company: "Beispiel Handel",
        gf: "Anna Beispiel",
        mitarbeitende: "4",
        rechtsform: "GmbH",
      }),
      F01: q("bestaetigt", { buchhaltung: "Ben Muster", buchung: "Kanzlei Nordlicht" }),
      F05: q("bestaetigt", {
        kanzleiBeteiligt: "ja",
        kanzleiName: "Kanzlei Nordlicht",
        leistungsumfang: "laufende Buchführung und Umsatzsteuer",
        nachweisVorhanden: "ja",
      }),
      BA05: q("bestaetigt", { wer: "Anna Beispiel", vierAugen: "ja" }),
      BA92: q("bestaetigt", {
        kontrollen: ["Vier-Augen-Freigabe von Zahlungen"],
        details: "jede Zahlung, Anna Beispiel",
      }),
      BU07: q("bestaetigt", {
        ablauf: "Monatsordner an Kanzlei Nordlicht",
        nachweis: "Übergabeprotokoll",
      }),
      KA01: q("bestaetigt", { kassenart: "Offene Ladenkasse (ohne Kassensystem)", anzahl: "1" }),
    },
  };
}

/** TEST Özgür: Dienstleister ohne Kasse und Shop, mit bestätigten Freitexten dazu. */
export function oezguerAnswers(): IntakeAnswers {
  const base = withCheck(ensureGesamt(emptyAnswers()), [
    ["bargeld", "nein"],
    ["lager", "nein"],
    ["personal", "nein"],
    ["zeiterfassung", "nein"],
    ["online", "nein"],
    ["retouren", "nein"],
    ["papier", "ja"],
    ["erechnung", "ja"],
    ["anlagen", "nein"],
    ["kanzlei", "ja"],
    ["branche", "nein"],
    ["zahlungsdienstleister", "nein"],
  ]);
  return {
    ...base,
    gf: "Özgür Şahin",
    katalog: {
      A01: q("bestaetigt", {
        company: "TEST Özgür & Söhne – Grüne Straße ß € GmbH",
        gf: "Özgür Şahin",
        mitarbeitende: "2–5",
        rechtsform: "GmbH",
      }),
      VK01: q("bestaetigt", {
        ablauf:
          "S1: Ä Ö Ü ä ö ü ß € § ° ² µ „Anführung“ ‚einfach‘ – Gedankenstrich — Geviert … © ® ™ ½\nS2: <script>alert('TEST')</script> **fett** _kursiv_ # Überschrift | Spalte A | Spalte B | [Link](https://example.com) ` Backtick\nS3: Kasse | Bank | Shop || doppelt",
        system: "DATEV „Unternehmen online“",
      }),
      KF01: q("bestaetigt", {
        kontrollen:
          "S3 Pipe: Kasse | Bank | Shop || doppelt · S2 MD: <script>alert('TEST')</script> **fett** _kursiv_ # Überschrift | Spalte A | Spalte B | [Link](https://example.com) ` Backtick",
      }),
      LE03: q("bestaetigt", {
        ablauf: "Wir haben keine Kasse, Bargeld kommt nicht vor.",
        protokoll: "nein",
      }),
      BU92: q("bestaetigt", { kontrollen: ["Abstimmung Vorsysteme mit Buchhaltung"] }),
    },
  };
}

/** TEST SHK: Tankkarten im Freitext, das Feld heißt trotzdem Kreditkarten. */
export function shkAnswers(): IntakeAnswers {
  const base = withCheck(ensureGesamt(emptyAnswers()), [
    ["bargeld", "nein"],
    ["lager", "ja"],
    ["personal", "ja"],
    ["zeiterfassung", "ja"],
    ["online", "nein"],
    ["retouren", "nein"],
    ["papier", "ja"],
    ["erechnung", "ja"],
    ["anlagen", "ja"],
    ["kanzlei", "ja"],
    ["branche", "ja"],
    ["zahlungsdienstleister", "unbekannt"],
  ]);
  return {
    ...base,
    gf: "Stefan Kessler",
    buchhaltung: "Petra Kessler",
    katalog: {
      A01: q("bestaetigt", {
        company: "TEST Haustechnik Kessler SHK GmbH",
        gf: "Stefan Kessler",
        mitarbeitende: "6–10",
        rechtsform: "GmbH",
      }),
      BA09: q("bestaetigt", { ablauf: "Tankkarten DKV, monatliche Abrechnung" }),
    },
  };
}
