/**
 * Offline check: Gesamtdokument sagt nur, was die Angaben hergeben.
 * Usage: npx tsx scripts/check-pdf-consistency.ts
 */
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { kanzleiKasseAnswers, pixelwerkAnswers } from "@/scripts/fixtures/pdf-consistency";
import type { IntakeAnswers } from "@/lib/types";

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function render(answers: IntakeAnswers): { cover: string; body: string; claims: string } {
  const doc = renderDeliveryDocument({
    identity: {
      email: "qa@example.com",
      company: "TEST Pixelwerk Webdesign Jana Probst",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    documentId: "pdf-consistency",
    version: 1,
  });
  const body = [doc.cover, ...doc.chapters.map((chapter) => chapter.body)].join("\n");
  const claims = [
    doc.cover,
    ...doc.chapters.filter((chapter) => chapter.id !== "vollstaendigkeit").map((chapter) => chapter.body),
  ].join("\n");
  return { cover: doc.cover, body, claims };
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
for (const stem of ["Vier-Augen", "Kreditkarte", "Kasse", "Shop", "Lohn", "Kanzlei"]) {
  expect(!pixel.claims.includes(stem), `Pixelwerk nennt ${stem}`);
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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("pdf consistency ok");
