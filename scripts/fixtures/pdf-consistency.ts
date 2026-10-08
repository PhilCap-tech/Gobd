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
      BA09: q("bestaetigt", { ablauf: "keine; Barauslagen per Foto" }),
      BA92: q("bestaetigt", { kontrollen: ["Keine regelmäßige Kontrolle"] }),
      EK04: q("bestaetigt", { wer: "Jana Probst", vierAugen: "nein" }),
      H01: q("bestaetigt", {
        kontrollen: [
          { name: "Lückenprüfung Rechnungsnummern", turnus: "monatlich", wer: "Jana Probst", nachweis: "Nummernliste" },
        ],
      }),
      KF02: q("bestaetigt", { kontrollen: "Lückenprüfung Rechnungsnummern, Stichproben monatlich" }),
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
