/**
 * Bestätigte Muster-Einträge müssen Feldnamen aus lib/module/fragen.ts tragen.
 * Ein Eintrag ohne passendes Feld schlägt den Build fehl.
 * Usage: npx tsx scripts/check-muster-felder.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prefixFieldLabel } from "@/lib/bereich-chapter";
import { renderGesamtChapters } from "@/lib/gesamt-document";
import { capitalizeSentenceStart } from "@/lib/satzanfang";
import { NEUE_GRUPPEN } from "@/lib/module/fragen";
import { MODULE, modulFragen } from "@/lib/module/katalog";
import { AF01_ZUORDNUNG } from "@/lib/module/status";
import { getGesamtMuster, MUSTER_VORLAGEN } from "@/lib/module-muster";
import { MUSTER_FIRMEN } from "@/lib/module-muster-dense";
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
  { id: "AR01", frage: /Abschlags-/i, antwort: /Abschlag|einzeln berechnet|Veranstaltung|Bestellung/i },
  { id: "AR02", frage: /Gutschrift/i, antwort: /Gutschrift/i },
  { id: "KF03", frage: /Abweichungen/i, antwort: /Abweichung/i },
  { id: "KF04", frage: /nachgewiesen/i, antwort: /Protokoll|Abhakliste|Nachweis|Checkliste/i },
  { id: "ZR02", frage: /beantragt/i, antwort: /Antrag|beantragt/i },
  { id: "ZR03", frage: /entzogen/i, antwort: /Entzug|Austritt/i },
  { id: "SN04", frage: /Wiederanlauf/i, antwort: /Wiederanlauf|nacherfasst/i },
  { id: "SN05", frage: /Notfall/i, antwort: /Kontakt|Rolle|Stelle/i },
  { id: "AE05", frage: /geänderte Arbeitsweise/i, antwort: /Ablaufänderung/i },
  { id: "PZ02", frage: /Auswertungen nach Vorgabe/i, antwort: /Auswertung/i },
  { id: "BS06", frage: /steuerlich/i, antwort: /steuerlich|§ 13b|Steuersätz|umsatzsteuerlichen Pflichten/i },
  { id: "BS07", frage: /Buchhaltung/i, antwort: /Export|DATEV/i },
  { id: "ZR05", frage: /protokolliert/i, antwort: /bei Bedarf/i },
  { id: "BU05", frage: /Umsatzsteuer-Voranmeldung/i, antwort: /Umsatzsteuer-Voranmeldung/i },
  { id: "BU07", frage: /Kanzlei übergeben/i, antwort: /DATEV Unternehmen online/i },
  { id: "KF02", frage: /Richtigkeit/i, antwort: /Vier-Augen-Freigabe/i },
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
const falschBs06 = musterInhaltPasst(
  "BS06",
  "Gibt es besondere steuerliche Regeln, die im Ablauf beachtet werden?",
  "Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch die Buchhaltung.",
);
if (!falschBs06) fail("Negativtest: Abstimmungstext auf BS06 wurde nicht erkannt");
console.log("negativ Musterinhalt: rot — Antwort passt nicht zur Frage");

/** „Entfällt im Muster“ ist keine sachliche Begründung. */
export function entfaelltImMuster(text: string): boolean {
  return text.includes("Entfällt im Muster");
}

if (!entfaelltImMuster("Umsatzsteuer-Voranmeldung: entfällt. Grund: Entfällt im Muster.")) {
  fail("Negativtest: „Entfällt im Muster“ wurde nicht erkannt");
}
if (entfaelltImMuster("Keine Kasse und kein Bargeldverkehr.")) {
  fail("Negativtest: sachlicher Entfällt-Grund wurde als Musterplatzhalter gemeldet");
}
console.log("negativ Entfällt im Muster: rot");

type Zuordnungszeile = { vorlage: string; id: string; antwort: string; urteil: string };

/** Prüfer-Tabelle: eine Zeile je bestätigter Frage des Stands 508e364. */
export function parseZuordnung(markdown: string): Zuordnungszeile[] {
  const zeilen: Zuordnungszeile[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5 || cells[0] === "Muster" || cells[0] === "---") continue;
    zeilen.push({ vorlage: cells[0] ?? "", id: cells[1] ?? "", antwort: cells[3] ?? "", urteil: cells[4] ?? "" });
  }
  return zeilen;
}

/** Reste fremder Vorlagen. Ein Treffer lässt den Build fehlschlagen. */
export const MUSTER_FREMD_ALLE = ["Peter Holm", "Lena Brandt", "Anja Berg", "Fertigplan", "Rohmaterial"] as const;

const MUSTER_FREMD_FIRMA: Record<string, readonly string[]> = {
  gastro: ["Halle A", "Halle B", "Kommissionsware", "Handscanner", "Filialleitung"],
  handwerk: ["Halle A", "Halle B", "Handscanner", "WaWi Lagerplus", "Filialleitung"],
  handel: ["2 Standorten", "Filialleitung", "mit Filiale"],
  ecommerce: ["ERP Fertigplan"],
};

export function fremdeMusterreste(text: string, extra: readonly string[] = []): string[] {
  return [...MUSTER_FREMD_ALLE, ...extra].filter((wort) => text.includes(wort));
}

/** Ist OSS genutzt, darf BS06 die besonderen Regeln nicht verneinen. */
export function bs06WidersprichtOss(oss: string, regeln: string): boolean {
  return oss.trim().toLowerCase() === "ja" && regeln.includes("Keine besonderen Regeln");
}

/** Vorlagenwort nur, wenn SY01 oder UO03 derselben Firma es nennt. */
export const VORLAGEN_BEGRIFFE = ["Projektleitung", "Agentur", "Abschlagsrechnung", "Schlussrechnung", "Faktura+", "Abnahme"] as const;

export function vorlagenbegriffOhneStamm(begriff: string, stamm: string, text: string): boolean {
  const bereinigt = begriff === "Abnahme" ? text.replace(/[Kk]eine Abnahme/g, "").replace(/kein Abnahmeprotokoll/gi, "") : text;
  return bereinigt.includes(begriff) && !stamm.includes(begriff);
}

/** Dieselbe Person oder Rolle erfasst und kontrolliert. */
export function istSelbstkontrolle(text: string): boolean {
  const match = /Kontrolle durch (?:die |den |der )?([^.;]+)/iu.exec(text);
  if (!match || match.index === undefined) return false;
  const kontrolleur = match[1].replace(/\s+beim\b[\s\S]*$/iu, "").trim();
  const davor = text.slice(0, match.index).trim();
  const teile = davor.split(/[,;]/u).map((teil) => teil.trim()).filter(Boolean);
  const akteur = (teile.pop() ?? "").replace(/^(Wer erfasst:\s*)/iu, "").trim();
  const norm = (value: string) => value.toLowerCase().replace(/^(die|der|den)\s+/u, "").replace(/\s+/gu, " ").trim();
  const links = norm(akteur);
  const rechts = norm(kontrolleur);
  if (links.length < 4 || rechts.length < 4) return false;
  return links === rechts || links.includes(rechts) || rechts.includes(links);
}

/** EK-Text nennt ein System, das SY01 nicht hat. */
export function ekFremdsystem(sy01: string, ekText: string): string[] {
  const treffer: string[] = [];
  if (!/\bERP\b/u.test(sy01) && /\bERP\b/u.test(ekText)) treffer.push("ERP");
  if (/keine Warenwirtschaft/iu.test(sy01)) {
    if (/\bLager\b/u.test(ekText)) treffer.push("Lager");
    if (/Wareneingang/u.test(ekText)) treffer.push("Wareneingang");
  }
  return treffer;
}

const KONTROLL_ROLLEN = ["Projektleitung", "Verkaufsleitung", "Schichtleitung", "Lagerleitung", "Lagerpersonal", "Filialleitung", "Küchenchef", "Teamleitung", "Einkaufsleitung"] as const;

function stammFuerRolle(katalog: Katalog, id: string): string {
  const prefix = id.slice(0, 2);
  return `${JSON.stringify(katalog.UO03?.values ?? {})} ${JSON.stringify(katalog[`${prefix}00`]?.values ?? {})}`;
}

/** Rolle in einer Kontrolle, die UO03 der Firma nicht nennt. */
export function rolleOhneStamm(rolle: string, stamm: string, kontrolle: string): boolean {
  return kontrolle.includes(rolle) && !stamm.includes(rolle);
}

if (fremdeMusterreste("Lagerleitung (Peter Holm) im ERP Fertigplan").length < 2) {
  fail("Negativtest: fremder Name oder fremdes System wurde nicht erkannt");
}
if (fremdeMusterreste("Mira Paketpfad, WaWi Lagerplus, Standort Leipzig").length !== 0) {
  fail("Negativtest: die eigene Musterfirma wurde als fremd gemeldet");
}
if (!bs06WidersprichtOss("ja", "Keine besonderen Regeln über die allgemeinen umsatzsteuerlichen Pflichten hinaus.")) {
  fail("Negativtest: OSS und verneinte Sonderregel wurden nicht erkannt");
}
if (bs06WidersprichtOss("nein", "Keine besonderen Regeln über die allgemeinen umsatzsteuerlichen Pflichten hinaus.")) {
  fail("Negativtest: ohne OSS wurde eine Sonderregel verlangt");
}
if (!vorlagenbegriffOhneStamm("Projektleitung", "Buchhaltung", "Abgleich durch die Projektleitung")) {
  fail("Negativtest: Projektleitung ohne Stamm wurde nicht erkannt");
}
if (vorlagenbegriffOhneStamm("Projektleitung", "Projektleitung für Aufträge", "Abgleich durch die Projektleitung")) {
  fail("Negativtest: Projektleitung im Stamm wurde gemeldet");
}
if (!rolleOhneStamm("Küchenchef", "Schichtleitung", "Freigabe durch den Küchenchef")) {
  fail("Negativtest: Rolle ohne UO03 wurde nicht erkannt");
}
if (!rolleOhneStamm("Teamleitung", "Projektleitung Tim Harms", "Plausibilitätsprüfung durch die Teamleitung")) {
  fail("Negativtest: Teamleitung ohne ZE00 wurde nicht erkannt");
}
if (rolleOhneStamm("Teamleitung", "Teamleitung (Sara Linden)", "durch die Teamleitung")) {
  fail("Negativtest: Teamleitung aus ZE00 wurde gemeldet");
}
const OSS_SATZ = "Fernverkäufe an Privatpersonen in Österreich werden mit dem österreichischen Steuersatz berechnet und über das OSS-Verfahren erklärt (§ 3c, § 18j UStG)";
export function ossSatzSichtbar(text: string): boolean {
  return text.includes(OSS_SATZ);
}
if (ossSatzSichtbar("OSS-Verfahren wird genutzt: ja.")) {
  fail("Negativtest: der kurze OSS-Hinweis gilt als der BS06-Satz");
}
if (!ossSatzSichtbar(`${OSS_SATZ}; Steuersätze je Land pflegt die Geschäftsführung im Shop.`)) {
  fail("Negativtest: der volle OSS-Satz wurde nicht erkannt");
}
if (!istSelbstkontrolle("Lagerverantwortliche Person, Kontrolle durch die Lagerverantwortliche Person")) {
  fail("Negativtest: Selbstkontrolle wurde nicht erkannt");
}
if (istSelbstkontrolle("Die lagerverantwortliche Person bucht den Wareneingang. Kontrolle durch Sara Linden beim Drei-Wege-Abgleich")) {
  fail("Negativtest: getrennte Kontrolle wurde als Selbstkontrolle gemeldet");
}
if (ekFremdsystem("Keine Warenwirtschaft.", "Wareneingang im ERP und im Lager").join(",") !== "ERP,Lager,Wareneingang") {
  fail("Negativtest: ERP, Lager oder Wareneingang ohne Warenwirtschaft wurde nicht erkannt");
}
if (ekFremdsystem("Projektsoftware und Lager", "Wareneingang im Lager").length !== 0) {
  fail("Negativtest: Lager bei vorhandener Warenbeschreibung wurde gemeldet");
}

/** Systeme, die eine SY01-Nennung in B01 wiederfinden muss. E-Mail ist ein Kanal, kein System. */
const B01_SYSTEME: Array<{ name: string; sy: RegExp; b01: RegExp }> = [
  { name: "DATEV Unternehmen online", sy: /DATEV Unternehmen online/iu, b01: /DATEV Unternehmen online/iu },
  { name: "Rechnungssoftware", sy: /Rechnungssoftware/iu, b01: /Rechnungssoftware/iu },
  { name: "Zeiterfassung", sy: /Zeiterfassung/iu, b01: /Zeiterfassung/iu },
  { name: "Kassensystem", sy: /Kassensystem/iu, b01: /Kassensystem/iu },
  { name: "Warenwirtschaft", sy: /Warenwirtschaft|\bWaWi\b/iu, b01: /Warenwirtschaft|\bWaWi\b/iu },
  { name: "Handscanner", sy: /Handscanner/iu, b01: /Handscanner/iu },
  { name: "Projektsoftware", sy: /Projektsoftware/iu, b01: /Projektsoftware/iu },
  { name: "Onlineshop", sy: /Onlineshop/iu, b01: /Onlineshop/iu },
  { name: "NAS", sy: /\bNAS\b/iu, b01: /\bNAS\b/iu },
  { name: "E-Mail", sy: /E-Mail/u, b01: /E-Mail/u },
];

export function ohneVerneinteSysteme(text: string): string {
  return text.replace(/\bkein(?:e|en|er)?\s+(?:eigene\s+|weitere\s+)?[A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*/giu, " ");
}

/** Systeme aus SY01, die B01 nicht nennt. Verneinungen wie „keine Warenwirtschaft“ zählen nicht. */
export function b01FehltSystem(sy01: string, b01: string): string[] {
  const stamm = ohneVerneinteSysteme(sy01);
  return B01_SYSTEME.filter((item) => item.sy.test(stamm) && !item.b01.test(b01)).map((item) => item.name);
}

if (b01FehltSystem("Kassensystem, Handscanner, DATEV Unternehmen online", "DATEV Unternehmen online und NAS").join(",") !== "Kassensystem,Handscanner") {
  fail("Negativtest: Kassensystem oder Handscanner ohne B01 wurde nicht erkannt");
}
if (b01FehltSystem("Warenwirtschaft, DATEV Unternehmen online", "WaWi Lagerplus und DATEV Unternehmen online").length !== 0) {
  fail("Negativtest: WaWi in B01 wurde trotz Warenwirtschaft in SY01 gemeldet");
}
if (b01FehltSystem("Kein Kassensystem, keine Warenwirtschaft. Rechnungssoftware und NAS", "Rechnungssoftware und NAS").length !== 0) {
  fail("Negativtest: verneintes System wurde als fehlend gemeldet");
}
if (b01FehltSystem("E-Mail und NAS", "NAS").join(",") !== "E-Mail") {
  fail("Negativtest: E-Mail ohne Karte wurde nicht erkannt");
}
if (b01FehltSystem("Keine E-Mail. NAS", "NAS").length !== 0) {
  fail("Negativtest: verneinte E-Mail wurde als fehlend gemeldet");
}
console.log("negativ fremde Musterreste: rot");

const ZUORDNUNG = parseZuordnung(readFileSync("scripts/fixtures/muster-zuordnung.md", "utf8"));
const ZUORDNUNG_IDS = new Set(ZUORDNUNG.map((zeile) => zeile.id));
if (ZUORDNUNG.length < 1000 || ZUORDNUNG_IDS.size < 200) {
  fail(`Zuordnungstabelle deckt zu wenig ab (${ZUORDNUNG.length} Zeilen, ${ZUORDNUNG_IDS.size} IDs)`);
}

const PERSONEN = [
  ...Object.values(MUSTER_FIRMEN).flatMap((firma) => [firma.gf, firma.buchhaltung]),
  "Nora Klar", "Felix Hahn", "Murat Aydin", "Eva Lindner", "Thomas Brück", "Martin Eichenblatt", "Sabine Krämer",
  "Tobias Lang", "Kai Laufer", "Miriam Ost", "Sandra Linde", "Oliver Pfeiffer", "Ute Sommer", "Robert Funke",
  "Ines Wolf", "Lea Bohn", "Jana Hellweg", "Paul Richter", "Lukas Berger", "Hannes Papke", "Birgit Kranz",
  "Clara Sonnenkorn", "Jonas Weber", "Mia Kern", "Tim Kern",
];

const TOKEN_STOP = new Set([
  "Geschäftsführung", "Buchhaltung", "Partnerin", "Partner", "Teamleitung", "Produktionsleitung",
  "Filialleitung", "Standorten",
  "Schichtleitung", "Einkaufsleitung", "Projektleitung", "Geschäftsführerin", "Verantwortlich", "Vertretung",
]);

function kerntoken(antwort: string): string | null {
  let text = antwort.split(" / ").map((part) => part.split("=").slice(1).join("=")).join(" ");
  for (const name of [...PERSONEN].sort((a, b) => b.length - a.length)) text = text.replaceAll(name, " ");
  const fremd = new Set<string>(MUSTER_FREMD_ALLE);
  const words = text.split(/[^A-Za-zÄÖÜäöüß0-9-]+/u).filter((word) => {
    if (word.length < 10 || TOKEN_STOP.has(word) || fremd.has(word)) return false;
    if (word.includes("Filialleitung") || word.includes("Fertigplan") || word.includes("Rohmaterial")) return false;
    return true;
  });
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** IDs, deren Inhalt in dieser Runde bewusst vom Prüferstand abweicht. */
const NEU_ERWARTUNG: Record<string, RegExp> = {
  BS06: /steuerlich|§ 13b|Steuersätz|umsatzsteuerlichen Pflichten|OSS-Verfahren/i,
  BA02: /2\.000 Euro/,
  BA05: /2\.000 Euro/,
  LO04: /Zeiterfassungs-App/,
  WW00: /Lagerverantwortliche Person|Henrik Bauwerk|Jonas Marktwege|Mira Paketpfad|Paula Speicherblick/,
  WW02: /Projektleitung|Lagerverantwortliche Person|Einkauf|Küchenchef|Schichtleitung|Preisänderungen/,
  WW03: /Lieferschein/,
  WW04: /Warenausgang|Baustelle|Verbrauch/,
  WW05: /Bestand|Projekt|Durchschnitt/,
  WW07: /500 Euro|Projektleitung|Lagerleitung|Lagerverantwortliche|Küchenchef|Schichtleitung/i,
  WW09: /Differenz/,
  WW10: /DATEV|monatlich/,
  WW92: /FiBu|Wareneingang/,
  WW06: /Lager|lager|Halle/,
  WW08: /Inventur|Geschäftsjahresende|NAS/,
  WW90: /Standort|Lager/,
  WW91: /DATEV/,
  ZR05: /bei Bedarf/i,
  BU05: /Umsatzsteuer-Voranmeldung/i,
  BU07: /Belege laufend über DATEV Unternehmen online/i,
  ZR02: /technische Einrichtung durch/i,
  KF02: /Vier-Augen-Freigabe von Zahlungen und Storni/i,
  LE04: /Wiederkehrende Leistungen/i,
  ER05: /PDF-Rechnungen/i,
  ER06: /Original bleibt unverändert/i,
  PB06: /Smartphone/i,
  AW06: /E-Mails mit Rechnung/i,
  SY01: /Kassensystem|Onlineshop|Projektsoftware|Zeiterfassung|Rechnungssoftware/i,
  SY05: /Programmstände/i,
  SY06: /Systemliste/i,
  SN02: /Systemausfall/i,
  AU06: /Aufbewahrungsfrist/i,
  PZ05: /Export wurde geöffnet/i,
  PZ07: /Summen- und Saldenliste/i,
  AE04: /gibt frei/i,
  PF02: /meldet geänderte Abläufe/i,
  EK01: /gemeldeten Bedarfen|Onlineshop|Software-Abos/i,
  VK01: /Angebot|Auftrag|Bestellung|Veranstaltung|WaWi|Shop/i,
  VK02: /Rechnungssoftware|WaWi|Onlineshop|Veranstaltung|Faktura/i,
  VK05: /fortlaufend|Nummernkreis/i,
  VK08: /storniert|Storno/i,
  VK10: /DATEV/i,
  VK06: /Pflichtangaben|Rechnungsvorlage/i,
  VK90: /Geschäftskunden|Veranstaltung|Ladengeschäft|Shop|Privatpersonen|Betrieb/i,
  VK91: /DATEV/i,
  VK92: /OP-Liste|Verrechnungskonten/i,
  LE02: /Lieferschein|Versand|Veranstaltung|Stunden/i,
  LE03: /Lieferschein|Veranstaltung|Shop|Abnahme|Empfangsbestätigung|Bestellung/i,
  AR01: /Abschlag|einzeln|Veranstaltung|Bestellung/i,
  AR04: /DATEV|Archiv|WaWi|Shop|Rechnungssoftware/i,
  ER01: /E-Rechnung|PDF|Postfach/i,
  ER02: /Validierung|Viewer|Prüfung/i,
  ER03: /XRechnung|ZUGFeRD|WaWi|Shop|Rechnungssoftware/i,
  SY02: /DATEV/i,
  RT91: /DATEV|Storno|Kasse|Shop/i,
  WW01: /WaWi|Warenwirtschaft|Materialliste/i,
  EK03: /Lieferantenportal|WaWi Lagerplus|Rechnungssoftware|Projektsoftware|Warenwirtschaft/i,
  EK04: /Abweichungen/i,
  EK05: /Wareneingang|Fremdleistungen|Lieferschein/i,
  EK06: /Rechnung/i,
  EK08: /Rahmenverträge|Software-Abos|Lebensmittel/i,
  EK10: /Bestellnummer/i,
  EK90: /Einkauf/i,
  EK91: /DATEV/i,
  EK92: /2\.000 Euro/,
  BA92: /2\.000 Euro/,
  EK95: /Nacherfassung|Ausfall/i,
  EK96: /Export|DATEV|Originaldokumente/i,
  EC90: /Keine weiteren Verkaufswege/i,
  AN09: /Leasing für Fahrzeuge/i,
  KA90: /Alle Kassen am Standort/i,
  SV00: /[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ]/,
  SV01: /Kassensystem|Projektsoftware/i,
  SV02: /Schichtleitung|Projektleitung/i,
  SV03: /Umsätze, Zahlarten|Aufmaß, Stunden/i,
  SV04: /Tagesabschluss|Aufmaß/i,
  SV05: /Artikel und Preise|Leistungsverzeichnis/i,
  SV06: /DATEV/i,
  SV07: /Z-Bon|Projektauswertung/i,
  SV08: /DATEV|NAS/i,
  SV09: /ja/i,
  SV10: /Systemwechsel ist nicht vorgesehen/i,
  SV91: /DATEV Unternehmen online/i,
  SV92: /gleicht/i,
  BS05: /Z-Bon|Schlussrechnungen/i,
  BS08: /Z-Bons|Projektunterlagen|Branchensoftware/i,
  PZ03: /DATEV-Export/i,
};

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
  if (entfaelltImMuster(mustertext)) fail(`${vorlage}: „Entfällt im Muster“ im Text`);
  const reste = fremdeMusterreste(mustertext, MUSTER_FREMD_FIRMA[vorlage] ?? []);
  if (reste.length) fail(`${vorlage}: fremde Reste ${reste.join(", ")}`);
  const oss = String(muster.answers.katalog?.EC05?.values?.oss ?? "");
  const regeln = String(muster.answers.katalog?.BS06?.values?.regeln ?? "");
  if (bs06WidersprichtOss(oss, regeln)) fail(`${vorlage}: BS06 verneint besondere Regeln trotz OSS`);
  if (vorlage === "ecommerce" && !regeln.includes("OSS-Verfahren")) fail("ecommerce: BS06 ohne OSS-Satz");
  if (vorlage === "ecommerce" && !mustertext.includes(OSS_SATZ)) {
    fail("ecommerce: der OSS-Satz steht nicht im gerenderten PDF");
  }
  const stamm = `${String(muster.answers.katalog?.SY01?.values?.umgebung ?? "")} ${String(muster.answers.katalog?.UO03?.values?.zustaendigkeiten ?? "")}`;
  const antworten = Object.values(muster.answers.katalog ?? {})
    .filter((entry) => entry?.status === "bestaetigt")
    .map((entry) => JSON.stringify(entry?.values ?? {}))
    .join("\n");
  for (const begriff of VORLAGEN_BEGRIFFE) {
    if (vorlagenbegriffOhneStamm(begriff, stamm, antworten)) {
      fail(`${vorlage}: „${begriff}“ in einer Antwort, aber nicht in SY01/UO03`);
    }
  }
  for (const [id, entry] of Object.entries(muster.answers.katalog ?? {})) {
    if (entry?.status !== "bestaetigt") continue;
    const istKontrolltext = id.endsWith("92") || /^ZE0[4-7]$/u.test(id) || id === "ZE95";
    const texte = istKontrolltext
      ? [Object.values(entry.values ?? {}).map((item) => String(item)).join(" ")]
      : [String(entry.values?.freigabe ?? "")];
    const rollenstamm = stammFuerRolle(muster.answers.katalog ?? {}, id);
    for (const text of texte) {
      if (!text) continue;
      for (const rolle of KONTROLL_ROLLEN) {
        if (rolleOhneStamm(rolle, rollenstamm, text)) {
          fail(`${vorlage}: Rolle „${rolle}“ in ${id} fehlt in UO03 und ${id.slice(0, 2)}00`);
        }
      }
    }
  }
  const ekText = Object.entries(muster.answers.katalog ?? {})
    .filter(([id, entry]) => id.startsWith("EK") && entry?.status === "bestaetigt")
    .map(([, entry]) => JSON.stringify(entry?.values ?? {}))
    .join("\n");
  const fremdEk = ekFremdsystem(String(muster.answers.katalog?.SY01?.values?.umgebung ?? ""), ekText);
  if (fremdEk.length) fail(`${vorlage}: Einkauf nennt ${fremdEk.join(", ")} ohne das System in SY01`);
  const sy01Text = String(muster.answers.katalog?.SY01?.values?.umgebung ?? "");
  const b01Text = JSON.stringify(muster.answers.katalog?.B01?.values ?? {});
  const fehltB01 = b01FehltSystem(sy01Text, b01Text);
  if (fehltB01.length) fail(`${vorlage}: B01 nennt nicht alle Systeme aus SY01 (${fehltB01.join(", ")})`);
  const karten = (muster.answers.katalog?.B01?.values?.systeme ?? []) as Array<Record<string, string>>;
  const karte = (name: string) => karten.find((item) => item.name === name);
  if (!karte("E-Mail")) fail(`${vorlage}: B01 ohne E-Mail-Karte`);
  if (vorlage === "handel") {
    const kasse = karte("KassaPro (fiktiv)");
    const scanner = karte("Handscanner");
    if (!kasse || kasse.hostingArt !== "Gemischt" || kasse.nutzer !== "Verkaufsleitung") fail("handel: Kassenkarte passt nicht zu KA91");
    if (!scanner || scanner.hostingArt !== "Lokal") fail("handel: Handscanner ist als Cloud-System geführt");
  }
  if (vorlage === "gastro") {
    const kasse = karte("KassaPro Gastro (fiktiv)");
    if (!kasse || kasse.hostingArt !== "Gemischt" || kasse.nutzer !== "Schichtleitung") fail("gastro: Kassenkarte passt nicht zu KA91");
  }
  if ((vorlage === "dienstleister" || vorlage === "handwerk") && !karte("Zeiterfassungs-App Takt (fiktiv)")) {
    fail(`${vorlage}: Zeiterfassung heißt nicht wie in ZE91`);
  }
  if (vorlage !== "dienstleister") {
    const details = String(muster.answers.katalog?.EK92?.values?.details ?? "");
    if (!details.includes("Freigabe durch die Geschäftsführung.")) fail(`${vorlage}: EK92 ohne Freigabe der Geschäftsführung`);
  }
  const ek07 = String(muster.answers.katalog?.EK07?.values?.wer ?? "");
  if (vorlage === "ecommerce") {
    if (ek07 !== "Einkauf legt an, Buchhaltung bestätigt Bankdaten") fail("ecommerce: EK07 wurde mitgezogen");
    const er01 = String(muster.answers.katalog?.ER01?.values?.postfach ?? "");
    const er02 = String(muster.answers.katalog?.ER02?.values?.viewer ?? "");
    const sy02 = String(muster.answers.katalog?.SY02?.values?.schnittstellen ?? "");
    const b04 = JSON.stringify(muster.answers.katalog?.B04?.values ?? {});
    const ec91 = String(muster.answers.katalog?.EC91?.values?.schnittstellen ?? "");
    const ar04 = String(muster.answers.katalog?.AR04?.values?.ort ?? "");
    if (!er01.includes("XRechnungen über den Eingangskanal von DATEV Unternehmen online") || er01.includes("Eingangskanal des Shops")) {
      fail("ecommerce: ER01 empfängt Lieferanten-XRechnungen nicht über DATEV");
    }
    if (er02 !== "Technische Prüfung (Schema/Validierung) in DATEV Unternehmen online; fachliche Prüfung durch Nils Strom.") {
      fail("ecommerce: ER02 validiert nicht in DATEV");
    }
    if (!sy02.includes("E-Rechnungseingang über DATEV Unternehmen online, Ausgang über den Shop.")) {
      fail("ecommerce: SY02 trennt Eingang und Ausgang nicht");
    }
    if (!b04.includes("Datei in DATEV Unternehmen online") || b04.includes("DATEV / Onlineshop")) {
      fail("ecommerce: B04 legt die Eingangs-E-Rechnung nicht in DATEV ab");
    }
    const mp = "Marktplatzrechnungen (MP-…) monatlich bis zum 5. als PDF/CSV aus dem Verkäuferkonto abrufen und in DATEV Unternehmen online ablegen, durch Nils Strom.";
    if (!ec91.includes(mp)) fail("ecommerce: Abruf der Marktplatzrechnungen fehlt");
    if (!ar04.includes("Marktplatzrechnungen: DATEV Unternehmen online (Abruf monatlich bis zum 5. durch Nils Strom).")) {
      fail("ecommerce: AR04 formuliert den Marktplatzabruf nicht als Ablageort");
    }
    if (String(muster.answers.katalog?.EK06?.values?.ablauf ?? "") !== "Nils Strom ordnet die in DATEV eingegangene Rechnung in der WaWi der Bestellung zu.") {
      fail("ecommerce: EK06 beschreibt die Übergabe von DATEV in die WaWi nicht");
    }
  } else if (vorlage === "gastro") {
    if (ek07 !== "Neuanlage und Änderung von Bankdaten durch die Buchhaltung, Freigabe durch die Geschäftsführung") {
      fail("gastro: EK07 ohne Freigabe der Geschäftsführung");
    }
    const er01 = String(muster.answers.katalog?.ER01?.values?.postfach ?? "");
    const er02 = String(muster.answers.katalog?.ER02?.values?.viewer ?? "");
    const sy02 = String(muster.answers.katalog?.SY02?.values?.schnittstellen ?? "");
    const b04 = JSON.stringify(muster.answers.katalog?.B04?.values ?? {});
    if (!er01.includes("XRechnungen über den Eingangskanal von DATEV Unternehmen online") || er01.includes("Eingangskanal der Rechnungssoftware")) {
      fail("gastro: ER01 empfängt Lieferanten-XRechnungen nicht über DATEV");
    }
    if (er02 !== "Technische Prüfung (Schema/Validierung) in DATEV Unternehmen online; fachliche Prüfung durch Keno Bruns.") {
      fail("gastro: ER02 validiert nicht in DATEV");
    }
    if (!sy02.includes("E-Rechnungseingang über DATEV Unternehmen online, Ausgang über die Rechnungssoftware.")) {
      fail("gastro: SY02 trennt Eingang und Ausgang nicht");
    }
    if (!b04.includes("Datei in DATEV Unternehmen online")) fail("gastro: B04 legt die Eingangs-E-Rechnung nicht in DATEV ab");
  } else if (ek07 !== "Neuanlage und Änderung von Bankdaten durch die Buchhaltung, Freigabe durch die Geschäftsführung") {
    fail(`${vorlage}: EK07 ohne Freigabe der Geschäftsführung`);
  }
  for (const [id, entry] of Object.entries(muster.answers.katalog ?? {})) {
    if (entry?.status !== "bestaetigt") continue;
    const text = Object.values(entry.values ?? {}).map((item) => String(item)).join(". ");
    if (istSelbstkontrolle(text)) fail(`${vorlage}: ${id} ist eine Selbstkontrolle`);
  }
  const nochFestzulegen = (mustertext.match(/Noch festzulegen/g) ?? []).length;
  if (nochFestzulegen > 5) fail(`${vorlage}: „Noch festzulegen“ steht ${nochFestzulegen} Mal`);
  for (const fremd of ["Sichtbeispiel", "Betriebs-Check", "Nora Klar", "Jana Hellweg", "Clara Sonnenkorn", "Robert Funke", "Digitaldruckmaschine", "Wochenmärkten", "Produktionsleitung", "Partnerin"]) {
    if (mustertext.includes(fremd)) fail(`${vorlage}: „${fremd}“ im Muster`);
  }
  const firma = MUSTER_FIRMEN[vorlage];
  const auswertung = String(muster.answers.katalog?.ZR05?.values?.auswertung ?? "");
  if (!auswertung.includes(firma.gf)) fail(`${vorlage}: ZR05 nennt ${firma.gf} nicht`);
  if (muster.answers.katalog?.BU05?.status !== "bestaetigt") fail(`${vorlage}: BU05 ist nicht bestätigt`);
  const gesehen = new Set<string>();
  for (const modul of MODULE) {
    if (muster.answers.module?.status?.[modul.id]?.status !== "tool") continue;
    for (const question of modulFragen(modul)) {
      const entry = muster.answers.katalog?.[question.id];
      if (entry?.status !== "bestaetigt") continue;
      gesehen.add(question.id);
      const text = Object.values(entry.values ?? {}).map((item) => String(item)).join(" ");
      const neu = NEU_ERWARTUNG[question.id];
      if (neu) {
        if (!neu.test(text)) fail(`${vorlage}: ${question.id} trifft die neue Erwartung nicht`);
        continue;
      }
      if (!ZUORDNUNG_IDS.has(question.id)) fail(`${vorlage}: ${question.id} ohne Erwartung in der Zuordnungstabelle`);
      const zeile =
        ZUORDNUNG.find((item) => item.vorlage === vorlage && item.id === question.id && item.urteil === "ok") ??
        ZUORDNUNG.find((item) => item.id === question.id && item.urteil === "ok");
      const token = zeile ? kerntoken(zeile.antwort) : null;
      if (token && !text.toLocaleLowerCase("de").includes(token.toLocaleLowerCase("de"))) {
        fail(`${vorlage}: ${question.id} enthält „${token}“ aus der Zuordnung nicht`);
      }
    }
  }
  if (gesehen.size < ZUORDNUNG_IDS.size / 5) {
    fail(`${vorlage}: nur ${gesehen.size} bestätigte Fragen, die Prüfliste hat ${ZUORDNUNG_IDS.size} IDs`);
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
