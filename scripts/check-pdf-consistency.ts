/**
 * Offline check: Gesamtdokument sagt nur, was die Angaben hergeben.
 * Usage: npx tsx scripts/check-pdf-consistency.ts
 */
import { renderDeliveryDocument, type RenderedChapter } from "@/lib/delivery-templates";
import gastroFixture from "@/scripts/fixtures/gastro-bella-vista.json";
import { KEINE_AUSNAHMEN_SATZ, KEINE_KONTROLLE_SATZ, KEINE_REGELMAESSIGE_KONTROLLE } from "@/lib/keine-angaben";
import { kanzleiKasseAnswers, oezguerAnswers, pixelwerkAnswers, shkAnswers } from "@/scripts/fixtures/pdf-consistency";
import { ensureGesamt } from "@/lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function render(
  answers: IntakeAnswers,
  options: { company?: string; onlyModul?: string } = {},
): { cover: string; body: string; claims: string; chapters: RenderedChapter[] } {
  const doc = renderDeliveryDocument({
    identity: {
      email: "qa@example.com",
      company: options.company ?? "TEST Pixelwerk Webdesign Jana Probst",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    documentId: "pdf-consistency",
    version: 1,
    onlyModul: options.onlyModul,
  });
  const body = [doc.cover, ...doc.chapters.map((chapter) => chapter.body)].join("\n");
  const claims = [
    doc.cover,
    ...doc.chapters.filter((chapter) => chapter.id !== "vollstaendigkeit").map((chapter) => chapter.body),
  ].join("\n");
  return { cover: doc.cover, body, claims, chapters: doc.chapters };
}

function presentChapters(body: string): Set<number> {
  const present = new Set<number>();
  for (const match of body.matchAll(/^#\s+(\d+)\s/gm)) present.add(Number(match[1]));
  return present;
}

const VERKAUF_AUSSERHALB = [
  "Angebot erstellen und ablegen",
  "Auftrag annehmen und bestätigen",
  "Leistung erbringen und dokumentieren",
  "Rechnung mit Pflichtangaben",
  "Rechnung im vereinbarten Format versenden",
  "Storno oder berichtigte Rechnung",
  "Ausgangsrechnungen übergeben",
];

const pixel = render(pixelwerkAnswers());
for (const stem of ["Kasse", "Shop", "Lohn"]) {
  expect(!pixel.claims.includes(stem), `Pixelwerk nennt ${stem}`);
}
for (const phrase of [
  "Vier-Augen-Prüfung vor Versand",
  "Vier-Augen-Prüfung bei Bankdatenänderungen",
  "Vier-Augen-Freigabe von Zahlungen",
  "Abgleich der Kreditkartenabrechnung",
  "Externe Kanzlei (soweit beteiligt)",
  "Übergabe an die Kanzlei",
  "Tägliche Sichtung",
]) {
  expect(!pixel.claims.includes(phrase), `Pixelwerk nennt Katalogtext „${phrase}“`);
}
for (const phrase of [
  "keine Kreditkarte; Barauslagen per Foto",
  "Vier-Augen-Prinzip ab 1.000 €, Stichproben monatlich",
  "Belege laufend digital, Auswertungen monatlich zurück per Kanzlei-Portal",
  "Kanzleivertrag",
  "Vertrag mit dem Anbieter",
  "Leistungsbeschreibung",
  "Berechtigungskonzept",
  "Nachweis Aufbewahrung oder Export",
  "Kontrollnachweise",
  "Systemverzeichnis",
]) {
  expect(pixel.claims.includes(phrase), `Pixelwerk verliert Kundentext „${phrase}“`);
}
for (const phrase of VERKAUF_AUSSERHALB) {
  expect(!pixel.claims.includes(phrase), `Pixelwerk enthält Verkaufsschritt „${phrase}“`);
}
expect(!pixel.claims.includes("Zahlungsvorschlag"), "Pixelwerk erfindet Zahlungsvorschlag");
expect(!pixel.claims.includes("SEPA-Datei"), "Pixelwerk erfindet SEPA-Datei");
expect(!pixel.claims.includes("Tägliche Sichtung"), "Pixelwerk setzt tägliche Sichtung");
expect(
  !pixel.claims.includes("Backup-Verfahren ist im Intake nicht angegeben"),
  "Pixelwerk behauptet fehlendes Backup",
);
expect(
  !pixel.claims.includes("keine konkrete Kontrollroutine bestätigt"),
  "Pixelwerk bestreitet genannte Kontrollen",
);
expect(!pixel.claims.includes("Allgemeine Beschreibung (Vorlage)"), "Pixelwerk behält die Vorlagenüberschrift");
expect(!pixel.claims.includes("lexoffice lexoffice"), "Pixelwerk wiederholt lexoffice");
expect(pixel.claims.includes("lexoffice"), "Pixelwerk verliert die lexoffice-Angabe");
expect(pixel.claims.includes("Wie wird dieser Eingang gesichtet"), "Pixelwerk zerstört den Fragetext");
expect(pixel.claims.includes("strukturierte E-Rechnung"), "Pixelwerk zerstört die E-Rechnungsfrage");
expect(pixel.claims.includes("wöchentlich"), "Pixelwerk nennt die wöchentliche Sichtung nicht");
expect(pixel.claims.includes("NAS"), "Pixelwerk nennt das NAS-Backup nicht");
expect(pixel.claims.includes("Eigenbuchhaltung"), "Pixelwerk nennt die Eigenbuchhaltung nicht");
expect(pixel.claims.includes(KEINE_KONTROLLE_SATZ), "Keine-Kontrolle bleibt Katalogtext");
expect(pixel.claims.includes(KEINE_AUSNAHMEN_SATZ), "Keine-Ausnahme bleibt Rohtext");
expect(!pixel.claims.includes("lexoffice Belegarchiv, keine"), "Ausnahme „keine“ bleibt als Katalogfragment stehen");
expect(pixel.claims.includes("Satz 5 UStG"), "Gutschrift zitiert § 14 Abs. 2 Satz 5");
expect(!pixel.claims.includes("Satz 2 UStG"), "Gutschrift zitiert noch Satz 2");
expect(!pixel.cover.includes("zu bestätigen (soweit beteiligt)"), "Deckblatt erfindet eine Kanzlei");
expect(pixel.claims.includes("§ 147 Abs. 4 AO"), "Aufbewahrungshinweis zerstört die Gesetzesstelle");
expect(!pixel.claims.includes("Abs.."), "Abkürzung Abs. wird verdoppelt");

const present = presentChapters(pixel.body);
for (const match of pixel.claims.matchAll(/Kap(?:itel)?\.?\s*(\d+)/gi)) {
  const nr = Number(match[1]);
  expect(present.has(nr), `Kapitelverweis ins Leere: ${match[0]}`);
}
expect(!/Kap(?:itel)?\.?\s*14\b/i.test(pixel.claims), "Verweis auf das fehlende Kapitel 14");

expect(!/\b(du|dich|dir|dein|deine|deinen)\b/i.test(pixel.claims), "Pixelwerk spricht mit du");
expect(!/\b(?!Siehe\b)(Sie|Ihnen|Ihr|Ihre|Ihren)\b/.test(pixel.claims), "Pixelwerk spricht mit Sie");

const positive = render(kanzleiKasseAnswers());
expect(positive.claims.includes("Kanzlei Nordlicht"), "bestätigte Kanzlei fehlt");
expect(positive.claims.includes("Kasse"), "bestätigte Kasse fehlt");
expect(positive.claims.includes("Vier-Augen"), "bestätigtes Vier-Augen-Prinzip fehlt");
expect(/Vier-Augen-Prinzip:\s*ja/.test(positive.claims), "Vier-Augen steht nicht auf ja");
expect(
  positive.cover.includes("Eingangs- und Ausgangsrechnungen, sonstige Buchungsbelege"),
  "Belegfluss-Geltungsbereich bleibt ohne UO06",
);

const gastro = render(gastroFixture.answers as IntakeAnswers, {
  company: "TEST Gastro Bella Vista GmbH",
});
const GASTRO_KATALOG = [
  "Validierung strukturierter Rechnungen",
  "Kasse, Shop und Lohn",
  "Prüfung der TSE-Funktion (Signatur auf dem Beleg)",
  "Durchsicht der Bedienerberechtigungen",
  "Freigabe vor Vernichtung",
  "Prüfung negativer Bestände",
  "Abgleich Bestandswert der Warenwirtschaft mit der FiBu",
  "Unterjährige Stichprobenzählung",
  "Freigabe von Bestandskorrekturen im Vier-Augen-Prinzip",
];
for (const phrase of GASTRO_KATALOG) {
  expect(!gastro.claims.includes(phrase), `Gastro druckt Katalogkontrolle „${phrase}“`);
}
for (const phrase of VERKAUF_AUSSERHALB) {
  expect(!gastro.claims.includes(phrase), `Gastro enthält Verkaufsschritt „${phrase}“`);
}
expect(gastro.claims.includes("Täglicher Kassensturz (Soll-Ist-Abgleich)"), "Gastro verliert den Kassensturz");
expect(
  gastro.claims.includes("Abgleich erbrachter Leistungen mit gestellten Rechnungen"),
  "Gastro verliert die bestätigte Verkaufskontrolle",
);
expect(gastro.claims.includes("lokale Dateien wöchentlich auf NAS"), "Gastro nennt die NAS-Sicherung nicht");
expect(
  !gastro.claims.includes("Backup-Verfahren ist im Intake nicht angegeben"),
  "Gastro behauptet fehlendes Backup",
);
expect(
  !gastro.claims.includes("keine konkrete Kontrollroutine bestätigt"),
  "Gastro bestreitet genannte Kontrollen",
);
expect(!gastro.claims.includes("Andere Beschäftigte"), "Gastro behält die leere Berechtigungszeile");
expect(!/Kap(?:itel)?\.?\s*14\b/i.test(gastro.claims), "Gastro verweist auf Kapitel 14");
expect(gastro.claims.includes("Satz 5 UStG"), "Gastro-Gutschrift zitiert Satz 5");
expect(!gastro.claims.includes("Satz 2 UStG"), "Gastro-Gutschrift zitiert Satz 2");
expect(gastro.cover.includes("Privatbereich der Gesellschafter"), "Deckblatt nennt den Ausschluss nicht");
expect(gastro.cover.includes("Gesamtbetrieb ab 01.10.2026"), "Deckblatt nennt den Geltungsbereich nicht");
expect(!gastro.cover.includes("nichts ausdrücklich ausgenommen"), "Deckblatt behauptet keinen Ausschluss");
for (const chapter of gastro.chapters) {
  if (!chapter.body.includes("| Kontrolle | Zweck |")) continue;
  expect(
    !chapter.body.includes("**Kontrollen im Modul:** noch zu klären"),
    `noch zu klären neben Kontrolltabelle in ${chapter.title}`,
  );
}
expect(
  gastro.claims.includes("Für diesen Teil sind noch keine Kontrollen bestätigt."),
  "Offene Kontrollfrage neben einer Tabelle bleibt unmarkiert",
);
expect(!/\b(du|dich|dir|dein|deine|deinen)\b/i.test(gastro.claims), "Gastro spricht mit du");
expect(!/\b(?!Siehe\b)(Sie|Ihnen|Ihr|Ihre|Ihren)\b/.test(gastro.claims), "Gastro spricht mit Sie");

function mitKontrollen(base: IntakeAnswers, patches: Record<string, string[]>): IntakeAnswers {
  const katalog = { ...(base.katalog ?? {}) };
  for (const [id, names] of Object.entries(patches)) {
    const prev = katalog[id];
    const values = { ...(prev?.values ?? {}) };
    const existing = Array.isArray(values.kontrollen) ? values.kontrollen.map((item) => String(item)) : [];
    katalog[id] = { status: "bestaetigt", values: { ...values, kontrollen: [...existing, ...names] } };
  }
  return { ...base, katalog };
}

const WIDERSPRUCH = [
  "Validierung strukturierter Rechnungen",
  "Kasse, Shop und Lohn",
  "Freigabe vor Vernichtung",
  "Prüfung negativer Bestände",
  "Abgleich Bestandswert der Warenwirtschaft mit der FiBu",
  "Unterjährige Stichprobenzählung",
  "Freigabe von Bestandskorrekturen im Vier-Augen-Prinzip",
];
const widerspruch = render(
  mitKontrollen(gastroFixture.answers as IntakeAnswers, {
    ER92: ["Validierung strukturierter Rechnungen"],
    PB92: ["Freigabe vor Vernichtung"],
    WW92: [
      "Prüfung negativer Bestände",
      "Abgleich Bestandswert der Warenwirtschaft mit der FiBu",
      "Unterjährige Stichprobenzählung",
      "Freigabe von Bestandskorrekturen im Vier-Augen-Prinzip",
    ],
    BU92: ["Abstimmung Vorsysteme mit Buchhaltung"],
  }),
  { company: "TEST Gastro Bella Vista GmbH" },
);
for (const phrase of WIDERSPRUCH) {
  expect(!widerspruch.claims.includes(phrase), `Widersprüchliche Kontrolle bleibt stehen: ${phrase}`);
}
expect(
  widerspruch.claims.includes("Kasse und Lohn sind vollständig übernommen."),
  "Abstimmung ohne Shop fällt ganz weg",
);
expect(widerspruch.claims.includes("Täglicher Kassensturz (Soll-Ist-Abgleich)"), "Kassensturz fällt mit der Widerspruchsliste weg");
expect(
  widerspruch.claims.includes("Vollständigkeitsprüfung nach dem Scannen"),
  "Bestätigte Scan-Kontrolle fällt weg",
);
expect(
  widerspruch.claims.includes("Abgleich Wareneingang mit Lieferschein und Bestellung"),
  "Bestätigter Wareneingang fällt weg",
);

const leerRechte = render(ensureGesamt(emptyAnswers()), { onlyModul: "m18" });
expect(leerRechte.claims.includes("Geschäftsführung (zu benennen)"), "Leere Rechtevorlage löscht die Geschäftsführung");
expect(leerRechte.claims.includes("Buchhaltung (zu benennen)"), "Leere Rechtevorlage löscht die Buchhaltung");
expect(leerRechte.claims.includes("Andere Beschäftigte"), "Leere Rechtevorlage löscht die übrigen Zeilen");
const leerSicherung = render(ensureGesamt(emptyAnswers()), { onlyModul: "m19" });
expect(
  leerSicherung.claims.includes("Backup-Verfahren ist im Intake nicht angegeben"),
  "Fehlendes Backup wird nicht mehr gesagt",
);
expect(!leerSicherung.claims.includes("erfolgt laut Intake über"), "Leere Sicherung behauptet ein Verfahren");
expect(leerSicherung.claims.includes("Bei Ausfall des Eingangskanals"), "Leere Notfallvorlage löscht den Absatz");
const leerKontrollen = render(ensureGesamt(emptyAnswers()), { onlyModul: "m20" });
expect(!/Kap(?:itel)?\.?\s*14\b/i.test(leerKontrollen.claims), "Leere Kontrollvorlage verweist auf Kapitel 14");
expect(leerKontrollen.claims.includes("Anhang A"), "Leere Kontrollvorlage nennt Anhang A nicht");
expect(
  leerKontrollen.claims.includes("keine konkrete Kontrollroutine bestätigt"),
  "Wirklich fehlende Kontrolle wird verschwiegen",
);

const oezguer = render(oezguerAnswers(), { company: "TEST Özgür & Söhne – Grüne Straße ß € GmbH" });
const vk01 =
  "S1: Ä Ö Ü ä ö ü ß € § ° ² µ „Anführung“ ‚einfach‘ – Gedankenstrich — Geviert … © ® ™ ½ S2: <script>alert('TEST')</script> fett _kursiv_ # Überschrift | Spalte A | Spalte B | [Link](https://example.com) ` Backtick S3: Kasse | Bank | Shop || doppelt";
const kf01 =
  "S3 Pipe: Kasse | Bank | Shop || doppelt · S2 MD: <script>alert('TEST')</script> fett _kursiv_ # Überschrift | Spalte A | Spalte B | [Link](https://example.com) ` Backtick";
expect(oezguer.claims.includes(vk01), "Özgür verliert den VK01-Freitext");
expect(oezguer.claims.includes(kf01), "Özgür verliert den KF01-Freitext");
expect(oezguer.claims.includes("Wir haben keine Kasse, Bargeld kommt nicht vor."), "Özgür verliert die Kassen-Verneinung");
for (const phrase of [
  "Kasse, Shop und Lohn",
  "Täglicher Kassensturz (Soll-Ist-Abgleich)",
  "Prüfung der TSE-Funktion (Signatur auf dem Beleg)",
]) {
  expect(!oezguer.claims.includes(phrase), `Özgür nennt Katalogtext „${phrase}“`);
}

const shk = render(shkAnswers(), { company: "TEST Haustechnik Kessler SHK GmbH" });
expect(
  shk.claims.includes("Kreditkarten und Barauslagen:** Ablauf: Tankkarten DKV, monatliche Abrechnung"),
  "SHK verliert den BA09-Freitext",
);
expect(!shk.claims.includes("Abgleich der Kreditkartenabrechnung"), "SHK nennt die Katalog-Kreditkartenkontrolle");

const keineKontrolle = render(
  ensureGesamt({
    ...emptyAnswers(),
    katalog: {
      VK92: {
        status: "bestaetigt",
        values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "Lückenprüfung der Rechnungsnummern" },
      },
      LE92: {
        status: "bestaetigt",
        values: { kontrollen: [KEINE_REGELMAESSIGE_KONTROLLE], details: "Abgleich erbrachter Leistungen mit Rechnungen" },
      },
    },
  }),
  { company: "QA Beispiel GmbH", onlyModul: "m02" },
);
expect(keineKontrolle.claims.includes(KEINE_KONTROLLE_SATZ), "Keine-Kontrolle nennt den neutralen Satz nicht");
expect(keineKontrolle.claims.includes("keine regelmäßige Kontrolle"), "Keine-Kontrolle steht nicht ausdrücklich im PDF");
for (const phrase of [
  "Lückenprüfung der Rechnungsnummern",
  "Abgleich erbrachter Leistungen mit Rechnungen",
  "Abgleich erbrachter Leistungen mit gestellten Rechnungen",
  "Freigabe von Angeboten und Sonderpreisen",
  "keine konkrete Kontrollroutine",
  "Typische Kandidaten",
  `| ${KEINE_REGELMAESSIGE_KONTROLLE} |`,
]) {
  expect(!keineKontrolle.claims.includes(phrase), `Keine-Kontrolle enthält Katalogtext „${phrase}“`);
}

const keineAusnahmen = render(
  ensureGesamt({
    ...emptyAnswers(),
    katalog: {
      C02: {
        status: "bestaetigt",
        values: {
          kanaeleDetail: {
            "E-Mail-PDF": {
              ort: "postfach@example.com",
              wer: "Inhaber",
              turnus: "wöchentlich",
              uebergabe: "Ablage",
              ausnahmen: "Barbelege vom Wochenmarkt",
              keineAusnahmen: true,
            },
          },
        },
      },
    },
  }),
  { company: "QA Beispiel GmbH", onlyModul: "m03" },
);
expect(keineAusnahmen.claims.includes(KEINE_AUSNAHMEN_SATZ), "Keine-Ausnahme nennt den neutralen Satz nicht");
expect(keineAusnahmen.claims.includes("Keine Ausnahmen"), "Keine Ausnahmen steht nicht ausdrücklich im PDF");
expect(!keineAusnahmen.claims.includes("Barbelege vom Wochenmarkt"), "Keine-Ausnahme behält den Katalogtext");
expect(!keineAusnahmen.claims.includes("Urlaubsvertretung"), "Keine-Ausnahme nutzt die Beispielausnahme");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("pdf consistency ok");
