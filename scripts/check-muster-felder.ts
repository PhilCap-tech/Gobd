/**
 * Bestätigte Muster-Einträge müssen Feldnamen aus lib/module/fragen.ts tragen.
 * Ein Eintrag ohne passendes Feld schlägt den Build fehl.
 * Usage: npx tsx scripts/check-muster-felder.ts
 */
import assert from "node:assert/strict";
import { renderGesamtChapters } from "@/lib/gesamt-document";
import { NEUE_GRUPPEN } from "@/lib/module/fragen";
import { AF01_ZUORDNUNG } from "@/lib/module/status";
import { getGesamtMuster, MUSTER_VORLAGEN } from "@/lib/module-muster";
import { evaluateOpenPoints } from "@/lib/open-points";
import type { IntakeAnswers } from "@/lib/types";

export type MusterFeldBefund = {
  vorlage: string;
  id: string;
  key: string;
};

const FELDER = new Map<string, Set<string>>();
for (const gruppe of NEUE_GRUPPEN) {
  for (const question of gruppe.questions) {
    FELDER.set(question.id, new Set(question.fields.map((field) => field.key)));
  }
}

type Katalog = NonNullable<IntakeAnswers["katalog"]>;

/** Bestätigte Einträge, deren Schlüssel kein Feld der Frage in fragen.ts sind. */
export function musterFelderOhneFrage(katalog: Katalog | undefined, vorlage: string): MusterFeldBefund[] {
  const out: MusterFeldBefund[] = [];
  for (const [id, entry] of Object.entries(katalog ?? {})) {
    if (entry?.status !== "bestaetigt") continue;
    const fields = FELDER.get(id);
    if (!fields) continue;
    const keys = Object.keys(entry.values ?? {});
    const unknown = keys.filter((key) => !fields.has(key));
    const known = keys.filter((key) => fields.has(key));
    if (known.length === 0) {
      out.push({ vorlage, id, key: unknown[0] ?? "(kein Feld)" });
    }
    for (const key of unknown) {
      if (known.length === 0 && key === unknown[0]) continue;
      out.push({ vorlage, id, key });
    }
  }
  return out;
}

function fail(message: string): never {
  console.error(`check-muster-felder: ${message}`);
  process.exit(1);
}

const negativ = musterFelderOhneFrage(
  { AF02: { status: "bestaetigt", values: { weitere: "Hemmung bei laufender Prüfung" } } },
  "negativ",
);
if (negativ.length !== 1 || negativ[0]?.id !== "AF02" || negativ[0]?.key !== "weitere") {
  fail(`Negativtest hat den toten Schlüssel nicht gemeldet: ${JSON.stringify(negativ)}`);
}
console.log("negativ AF02.weitere: rot — bestätigter Eintrag ohne Feld in fragen.ts");

const positiv = musterFelderOhneFrage(
  { AF02: { status: "bestaetigt", values: { pruefung: "Hemmung bei laufender Prüfung" } } },
  "positiv",
);
if (positiv.length !== 0) fail(`gültiges Feld wurde gemeldet: ${JSON.stringify(positiv)}`);

const fremd = musterFelderOhneFrage(
  { G05: { status: "bestaetigt", values: { verfahren: "kein Fragenfeld" } } },
  "fremd",
);
if (fremd.length !== 0) fail("Katalogfrage außerhalb von fragen.ts darf nicht gemeldet werden");

const offen = musterFelderOhneFrage(
  { AF02: { status: "unbekannt", values: { weitere: "offen" } } },
  "offen",
);
if (offen.length !== 0) fail("nur bestätigte Einträge werden geprüft");

const ZD04_ABLAUF =
  "Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; nicht zuordenbare Zahlungen und Differenzen klärt ";
const ZD04_TURNUS = "wöchentlich, zusätzlich zum Monatsabschluss";
const LISTE = "Fristenliste je Unterlagenart anlegen und im Archiv kennzeichnen (Modul 16).";

for (const vorlage of MUSTER_VORLAGEN) {
  const muster = getGesamtMuster(vorlage);
  if (!muster) fail(`Muster ${vorlage} fehlt`);
  const treffer = musterFelderOhneFrage(muster.answers.katalog, vorlage);
  if (treffer.length) {
    for (const item of treffer) console.error(`  ${item.vorlage} ${item.id}.${item.key}`);
    fail(`${vorlage}: ${treffer.length} bestätigte Einträge ohne passendes Feld`);
  }
  const zd04 = muster.answers.katalog?.ZD04;
  assert.equal(zd04?.status, "bestaetigt");
  const ablauf = String(zd04?.values?.ablauf ?? "");
  const turnus = String(zd04?.values?.turnus ?? "");
  if (!ablauf.startsWith(ZD04_ABLAUF) || !ablauf.includes("Ungeklärte Posten werden bis zur Klärung als offener Punkt geführt.")) {
    fail(`${vorlage}: ZD04.ablauf weicht vom Prüfertext ab`);
  }
  if (turnus !== ZD04_TURNUS) fail(`${vorlage}: ZD04.turnus weicht vom Prüfertext ab`);
  if (ablauf.includes("siehe Modul") || turnus.includes("siehe Modul")) {
    fail(`${vorlage}: ZD04 verweist auf das eigene Modul`);
  }
  assert.equal(muster.answers.katalog?.AF01?.values?.ablauf, AF01_ZUORDNUNG);

  const chapters = renderGesamtChapters(muster.answers, "OFFEN");
  const modul7 = chapters.find((chapter) => chapter.id === "modul-m07")?.body ?? "";
  const modul16 = chapters.find((chapter) => chapter.id === "modul-m16")?.body ?? "";
  if (!modul7.includes("## 7.5 ")) fail(`${vorlage}: Abschnitt 7.5 fehlt`);
  const abschnitt75 = modul7.split("## 7.5 ")[1]?.split("\n## ")[0] ?? "";
  if (!abschnitt75.includes("Ungeklärte Posten werden bis zur Klärung als offener Punkt geführt.")) {
    fail(`${vorlage}: Abschnitt 7.5 enthält den OP-Abgleich nicht`);
  }
  if (abschnitt75.includes("siehe Modul 7")) fail(`${vorlage}: Selbstverweis in Abschnitt 7.5`);

  if (!modul16.includes("## 16.2 ") || !modul16.includes("## 16.3 ") || !modul16.includes("## 16.4 ")) {
    fail(`${vorlage}: Modul 16.2, 16.3 oder 16.4 fehlt`);
  }
  const rahmen = modul16.split("## 16.2 ")[1]?.split("\n## ")[0] ?? "";
  if (!rahmen.includes("§ 147 Abs. 3 Satz 5 AO")) {
    fail(`${vorlage}: Ablaufhemmung in 16.2 ohne Satz 5`);
  }
  const uebersicht = modul16.split("## 16.4 ")[0] ?? "";
  const frage = modul16.split("## 16.4 ")[1] ?? "";
  if (!uebersicht.includes("Jeder Unterlagenart wird ihre Frist zugeordnet.")) {
    fail(`${vorlage}: Prozessübersicht ohne Kurzbeschreibung`);
  }
  if (uebersicht.includes("Buchungsbelege 8 Jahre")) {
    fail(`${vorlage}: AF01-Wortlaut steht doppelt in der Prozessübersicht`);
  }
  if (!frage.includes("Buchungsbelege 8 Jahre, auch wenn sie zugleich Handels- oder Geschäftsbrief sind")) {
    fail(`${vorlage}: AF01-Volltext fehlt in 16.4`);
  }
  const briefInUebersicht = (uebersicht.match(/Buchungsbelege 8 Jahre, auch wenn sie zugleich Handels- oder Geschäftsbrief sind/g) ?? []).length;
  const briefInFrage = (frage.match(/Buchungsbelege 8 Jahre, auch wenn sie zugleich Handels- oder Geschäftsbrief sind/g) ?? []).length;
  if (briefInUebersicht !== 0 || briefInFrage !== 1) {
    fail(`${vorlage}: Brief-Satz steht ${briefInUebersicht + briefInFrage} Mal in Modul 16`);
  }

  if (vorlage === "dienstleister" || vorlage === "ecommerce") {
    const modul15 = chapters.find((chapter) => chapter.id === "modul-m15")?.body ?? "";
    const sichtbar = (modul15.match(/Aufbewahrung der Buchungsbelege 8 Jahre \(§ 147 Abs\. 3 AO\)/g) ?? []).length;
    if (sichtbar < 3) {
      fail(`${vorlage}: DATEV-Zusatz steht ${sichtbar} Mal in Modul 15, erwartet in den sichtbaren Feldern`);
    }
  }

  const points = evaluateOpenPoints({ answers: muster.answers, identity: muster.identity });
  const liste = points.find((point) => point.id === "op-af01-liste");
  if (!liste || liste.text !== LISTE || liste.priority !== "mittel") {
    fail(`${vorlage}: offener Punkt zur leeren Fristenliste fehlt`);
  }
  if (!liste.responsibility || liste.responsibility === "zu benennen") {
    fail(`${vorlage}: Verantwortung der Fristenliste ist nicht die Rolle aus G05`);
  }

  const mitNein: IntakeAnswers = {
    ...muster.answers,
    katalog: {
      ...muster.answers.katalog,
      AF01: { status: "bestaetigt", values: { ...muster.answers.katalog?.AF01?.values, liste: "nein" } },
    },
  };
  const nein = evaluateOpenPoints({ answers: mitNein, identity: muster.identity }).find((point) => point.id === "op-af01-liste");
  if (!nein) fail(`${vorlage}: liste = nein erzeugt keinen offenen Punkt`);

  const mitJa: IntakeAnswers = {
    ...muster.answers,
    katalog: {
      ...muster.answers.katalog,
      AF01: { status: "bestaetigt", values: { ...muster.answers.katalog?.AF01?.values, liste: "ja" } },
    },
  };
  const ja = evaluateOpenPoints({ answers: mitJa, identity: muster.identity }).some((point) => point.id === "op-af01-liste");
  if (ja) fail(`${vorlage}: liste = ja darf keinen offenen Punkt erzeugen`);
  console.log(`ok: ${vorlage}`);
}

console.log("check-muster-felder: ok");
