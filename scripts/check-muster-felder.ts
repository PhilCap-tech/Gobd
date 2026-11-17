/**
 * Bestätigte Muster-Einträge müssen Feldnamen aus lib/module/fragen.ts tragen.
 * Ein Eintrag ohne passendes Feld schlägt den Build fehl.
 * Usage: npx tsx scripts/check-muster-felder.ts
 */
import assert from "node:assert/strict";
import { prefixFieldLabel } from "@/lib/bereich-chapter";
import { renderGesamtChapters } from "@/lib/gesamt-document";
import { capitalizeSentenceStart } from "@/lib/satzanfang";
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

const DOPPELTES_LABEL = /(\b[A-ZÄÖÜ][a-zäöüß-]+): \1:/u;

/** Erstes doppeltes Feldlabel in einem generierten Mustertext, sonst null. */
export function doppeltesFeldlabel(text: string): string | null {
  const plain = text.replaceAll("**", "");
  return DOPPELTES_LABEL.exec(plain)?.[0] ?? null;
}

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

const doppelt = doppeltesFeldlabel("Vertretungsregelung: Vertretungsregelung: Bei Abwesenheit");
if (doppelt !== "Vertretungsregelung: Vertretungsregelung:") {
  fail(`Negativtest doppeltes Label hat nicht getroffen: ${doppelt ?? "kein Treffer"}`);
}
if (doppeltesFeldlabel("Vertretungsregelung: Bei Abwesenheit von der Geschäftsführung") !== null) {
  fail("Negativtest: ein einfaches Label wurde als doppelt gemeldet");
}
if (doppeltesFeldlabel("Steuerrelevante Daten: Daten: Angabe zum Musterbetrieb") !== "Daten: Daten:") {
  fail("Negativtest: letztes Wort des Labels wurde nicht als doppelt gemeldet");
}
console.log("negativ doppeltes Label: rot — Wort: Wort:");

if (prefixFieldLabel("Vertretung", "Lea Nordlicht", "Verantwortung und Vertretung") !== "Vertretung: Lea Nordlicht") {
  fail("Überschrift „Verantwortung und Vertretung“ darf das Feldlabel Vertretung nicht schlucken");
}
if (prefixFieldLabel("Vertretung", "Vertretung: Lea Nordlicht", "Verantwortung und Vertretung") !== "Vertretung: Lea Nordlicht") {
  fail("Ein Wert, der schon mit dem Label beginnt, wird nicht verdoppelt");
}
if (prefixFieldLabel("System", "KassaPro", "System") !== "KassaPro") {
  fail("Gleiche Überschrift und gleiches Label bleiben ohne zweites Label");
}
console.log("ok: Vertretung bleibt als Feldlabel");

/** Stichwort der Frage und erwartetes Stichwort der Musterantwort. */
export const MUSTER_INHALT: ReadonlyArray<{ id: string; frage: RegExp; antwort: RegExp }> = [
  { id: "LE01", frage: /Änderungen eines Auftrags/i, antwort: /änderung/i },
  { id: "AR01", frage: /Abschlags-/i, antwort: /Abschlag/i },
  { id: "AR02", frage: /Gutschrift/i, antwort: /Gutschrift/i },
  { id: "KF03", frage: /Abweichungen/i, antwort: /Abweichung/i },
  { id: "KF04", frage: /nachgewiesen/i, antwort: /Protokoll|Abhakliste|Nachweis|Checkliste/i },
  { id: "ZR02", frage: /beantragt/i, antwort: /Antrag|beantragt/i },
  { id: "ZR03", frage: /entzogen/i, antwort: /Entzug|Austritt/i },
  { id: "SN04", frage: /Wiederanlauf/i, antwort: /Wiederanlauf|nacherfasst/i },
  { id: "SN05", frage: /Notfall/i, antwort: /Kontakt|Rolle|Stelle/i },
  { id: "AE05", frage: /geänderte Arbeitsweise/i, antwort: /Ablaufänderung/i },
  { id: "PZ02", frage: /Auswertungen nach Vorgabe/i, antwort: /Auswertung/i },
  { id: "BS07", frage: /Buchhaltung/i, antwort: /Export|DATEV/i },
];

export function musterInhaltPasst(id: string, prompt: string, antwort: string): string | null {
  const rule = MUSTER_INHALT.find((item) => item.id === id);
  if (!rule) return null;
  if (!rule.frage.test(prompt)) return `${id}: Fragetext passt nicht zur Prüfliste`;
  if (!rule.antwort.test(antwort)) return `${id}: Antwort passt nicht zur Frage`;
  return null;
}

const falschZugeordnet = musterInhaltPasst(
  "KF04",
  "Wie werden durchgeführte Kontrollen nachgewiesen und wie lange aufbewahrt?",
  "Korrektur über Storno oder Neubuchung mit Beleg.",
);
if (!falschZugeordnet) fail("Negativtest: falsch zugeordnete Kontrollantwort wurde nicht erkannt");
console.log("negativ Musterinhalt: rot — Antwort passt nicht zur Frage");

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
  const mustertext = chapters.map((chapter) => chapter.body).join("\n");
  if (mustertext.includes("Angabe zum Musterbetrieb") || /siehe Modul \d+\b/.test(mustertext.replaceAll("siehe Modul 5/6", ""))) {
    fail(`${vorlage}: Selbstverweis „siehe Modul“ im eigenen Modul`);
  }
  if (/\bop-[a-z0-9-]+/.test(mustertext)) fail(`${vorlage}: Roh-ID eines offenen Punkts im Text`);
  if (mustertext.includes("Intake")) fail(`${vorlage}: „Intake“ im Kunden-PDF`);
  if (mustertext.includes("Muss ich klären") || mustertext.includes("So läuft es heute")) {
    fail(`${vorlage}: Fragebogen-Status statt PDF-Label`);
  }
  for (const rule of MUSTER_INHALT) {
    const question = NEUE_GRUPPEN.flatMap((gruppe) => gruppe.questions).find((item) => item.id === rule.id);
    const prompt = question?.prompt ?? "";
    const values = muster.answers.katalog?.[rule.id];
    if (values?.status !== "bestaetigt") {
      fail(`${vorlage}: ${rule.id} ist nicht bestätigt`);
      continue;
    }
    const antwort = Object.values(values.values ?? {}).map((item) => String(item)).join(" ");
    const problem = musterInhaltPasst(rule.id, prompt, antwort);
    if (problem) fail(`${vorlage}: ${problem}`);
  }
  if (vorlage === "dienstleister" && mustertext.includes("Pflegedienstleitung")) {
    fail("dienstleister: Pflegedienstleitung im Beratungsmuster");
  }
  if ((vorlage === "dienstleister" || vorlage === "gastro") && !mustertext.includes("Die Frist für die Entgeltunterlagen ergibt sich aus dem Sozialversicherungsrecht")) {
    fail(`${vorlage}: Satz unter der Lohn- und Zeittabelle fehlt`);
  }
  const label = doppeltesFeldlabel(mustertext);
  if (label) fail(`${vorlage}: doppeltes Feldlabel „${label}“`);
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
    const sichtbar = (modul15.match(/Aufbewahrung der Buchungsbelege 8 Jahre \(§ 147 Abs\. 1 Nr\. 4, Abs\. 3 Satz 1 AO\)/g) ?? []).length;
    if (sichtbar !== 1) {
      fail(`${vorlage}: DATEV-Zusatz steht ${sichtbar} Mal in Modul 15, erwartet einmal an den Suchmerkmalen`);
    }
  }

  if (vorlage === "gastro" || vorlage === "handel") {
    const kasse = chapters.find((chapter) => chapter.id === "modul-m08")?.body ?? "";
    if (!kasse.includes("Tagesabschlüsse (Z-Bons) und, soweit geführt, Kassenberichte und Zählprotokolle")) {
      fail(`${vorlage}: Kassenzeile ohne den Wortlaut aus F44`);
    }
    if (!kasse.includes("| 10 Jahre | § 147 Abs. 1 Nr. 1, Abs. 3 Satz 1 AO |")) {
      fail(`${vorlage}: Kassenzeile ohne 10 Jahre und § 147 Abs. 1 Nr. 1, Abs. 3 Satz 1 AO`);
    }
    if (kasse.includes("im Zweifel die längere Frist")) {
      fail(`${vorlage}: alte Kassenzeile mit „im Zweifel“`);
    }
  }

  if (vorlage === "ecommerce") {
    const shop = chapters.find((chapter) => chapter.id === "modul-m13")?.body ?? "";
    const zeile =
      "Einzelaufzeichnungen der Bestellungen und Zahlungen (Shop- und Zahlungsdienst-Exporte) | 10 Jahre | § 147 Abs. 1 Nr. 1, Abs. 3 Satz 1 AO |";
    if (!shop.includes(zeile)) fail("ecommerce: Onlinehandel 13.4 ohne Frist 10 Jahre und die Grundlage");
    if (shop.includes("im Zweifel die längere Frist")) fail("ecommerce: alte Zeile mit „im Zweifel“");
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

const ohnePflege = getGesamtMuster("dienstleister");
if (!ohnePflege) fail("Dienstleister-Muster fehlt");
const pflege = structuredClone(ohnePflege.answers);
pflege.gf = "die Geschäftsführung";
pflege.buchhaltung = "die Buchhaltung";
for (const id of ["I01", "I02", "I04", "I05", "PF01", "PF02", "PF03", "PF04", "PF05", "PF06"]) {
  delete pflege.katalog?.[id];
}
const kapitel24 = renderGesamtChapters(pflege, "OFFEN").find((chapter) => chapter.id === "modul-m24")?.body ?? "";
if (!kapitel24.includes("Wirksamkeitsdatum. Die Geschäftsführung prüft")) {
  fail("Kap. 24: Satzanfang der Rolle bleibt klein");
}
if (!kapitel24.includes("Die Buchhaltung erfasst Anlass")) {
  fail("Kap. 24: Absatzanfang der Rolle bleibt klein");
}
if (capitalizeSentenceStart("z. B. die Kasse") !== "z. B. die Kasse") {
  fail("Abkürzung z. B. wird großgeschrieben");
}
console.log("check-muster-felder: ok");
