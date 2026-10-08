/**
 * Aussagen im Gesamtdokument stammen aus bestätigten Angaben.
 * Katalogtexte sind nur Kandidaten: verneinte oder nicht vorhandene
 * Themen werden nicht als Kontrolle, Prozess oder Behauptung gedruckt.
 */
import { bereichQuestion, type BereichFrist, type BereichKontrolle, type BereichSchritt } from "@/lib/bereiche";
import {
  modulAufbewahrung,
  modulBegriffe,
  modulById,
  modulFragen,
  modulKontrollen,
  modulProzess,
  modulQuestion,
} from "@/lib/module/katalog";
import { effectiveModulStatus } from "@/lib/module/status";
import type { ModulDef } from "@/lib/module/typen";
import {
  isControlQuestionId,
  isKeineKontrolleValues,
  KEINE_AUSNAHMEN_SATZ,
  KEINE_KONTROLLE_SATZ,
  realControlNames,
} from "@/lib/keine-angaben";
import type { IntakeAnswers } from "@/lib/types";

type Entry = NonNullable<IntakeAnswers["katalog"]>[string];

export type BetriebFacts = {
  /** Bestätigtes Vier-Augen-Prinzip. Bei „nur ich“ nie. */
  vierAugen: boolean;
  /** Eine Kreditkarte ist benannt, nicht verneint. */
  kreditkarte: boolean;
  /** Modul Kasse ist beschrieben. */
  kasse: boolean;
  /** Modul Shop ist beschrieben. */
  shop: boolean;
  /** Modul Lohn ist beschrieben. */
  lohn: boolean;
  /** Eine Kanzlei ist bestätigt. */
  kanzlei: boolean;
  /** Betriebs-Check oder F05 sagt ausdrücklich nein. */
  kanzleiDenied: boolean;
  sichtungTurnus: string;
  /** Backup ist in G06, SN01 oder answers.backup genannt. */
  backup: boolean;
  /** Mindestens eine Kontrolle ist als heutige Praxis bestätigt. */
  kontrollen: boolean;
  /** Person der Eigenbuchhaltung, dritte Person. */
  rolle: string;
  /**
   * Bestätigte Freitexte und Tabellenzeilen aus den Angaben.
   * Auswahlen aus dem Kontrollkatalog gehören nicht dazu.
   */
  kundenTexte: readonly string[];
};

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  return "";
}

function entry(answers: IntakeAnswers, id: string): Entry | undefined {
  return answers.katalog?.[id];
}

function confirmed(answers: IntakeAnswers, id: string): boolean {
  return entry(answers, id)?.status === "bestaetigt";
}

export function kanzleiAbgelehnt(answers: IntakeAnswers): boolean {
  if (answers.module?.check?.kanzlei === "nein") return true;
  const f05 = entry(answers, "F05");
  if (!f05) return false;
  if (f05.status === "nicht_zutreffend") return true;
  if (f05.values?.kanzleiBeteiligt === "nein") return true;
  return false;
}

export function eigenbuchhaltungText(answers: IntakeAnswers): string {
  const person =
    text(entry(answers, "F01")?.values?.buchhaltung) ||
    text(answers.buchhaltung) ||
    text(entry(answers, "BU00")?.values?.verantwortlich) ||
    text(entry(answers, "A01")?.values?.gf) ||
    text(answers.gf) ||
    "dem Betrieb";
  return `${person} (Eigenbuchhaltung)`;
}

function soloBetrieb(answers: IntakeAnswers): boolean {
  const raw = `${answers.mitarbeitende} ${text(entry(answers, "A01")?.values?.mitarbeitende)}`.toLowerCase();
  return /nur ich|keine beschäftigten|ein-personen|allein/.test(raw);
}

function described(answers: IntakeAnswers, modulId: string): boolean {
  const status = effectiveModulStatus(answers, modulId).status;
  return status === "tool" || status === "extern";
}

function sichtungTurnus(answers: IntakeAnswers): string {
  const values = entry(answers, "C02")?.values;
  if (!confirmed(answers, "C02") || !values) return "";
  const direct = text(values.turnus);
  if (direct && direct !== "anders") return direct;
  if (direct === "anders") return text(values.turnusFrei);
  const detail = values.kanaeleDetail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return "";
  for (const row of Object.values(detail as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const turnus = text((row as { turnus?: unknown }).turnus);
    if (turnus === "anders") {
      const frei = text((row as { turnusFrei?: unknown }).turnusFrei);
      if (frei) return frei;
    } else if (turnus) return turnus;
  }
  return "";
}

function backupGenannt(answers: IntakeAnswers): boolean {
  if (confirmed(answers, "G06")) {
    const values = entry(answers, "G06")?.values ?? {};
    const arten = values.backupArten;
    if (Array.isArray(arten) && arten.some((item) => text(item))) return true;
    if (text(arten) || text(values.konzept) || text(values.verfahren)) return true;
  }
  if (confirmed(answers, "SN01") && text(entry(answers, "SN01")?.values?.konzept)) return true;
  return (answers.backup ?? []).some((item) => item.trim());
}

function kontrollenGenannt(answers: IntakeAnswers): boolean {
  const state = answers.katalog ?? {};
  for (const [id, item] of Object.entries(state)) {
    if (item?.status !== "bestaetigt") continue;
    if (!isControlQuestionId(id)) continue;
    if (isKeineKontrolleValues(item.values)) continue;
    if (realControlNames(item.values).length) return true;
    if (text(item.values?.details)) return true;
    if (typeof item.values?.kontrollen === "string" && text(item.values.kontrollen)) return true;
  }
  return false;
}

function hasKreditkarte(answers: IntakeAnswers): boolean {
  const blobs = [
    text(entry(answers, "BA01")?.values?.karten),
    text(entry(answers, "BA09")?.values?.ablauf),
  ];
  return blobs.some((value) => {
    if (!value) return false;
    if (/keine|nein|nicht vorhanden/i.test(value)) return false;
    return /kreditkarte|visa|mastercard|amex|firmenkarte/i.test(value);
  });
}

function kanzleiBestaetigt(answers: IntakeAnswers): boolean {
  if (kanzleiAbgelehnt(answers)) return false;
  const f05 = entry(answers, "F05");
  if (f05?.status === "bestaetigt") {
    const name = text(f05.values?.kanzleiName);
    if (name && !/keine/i.test(name)) return true;
  }
  return answers.module?.check?.kanzlei === "ja" && Boolean(text(answers.steuerberater));
}

export function betriebFacts(answers: IntakeAnswers): BetriebFacts {
  const vierAugenFeld = Object.values(answers.katalog ?? {}).some(
    (item) => item?.status === "bestaetigt" && item.values?.vierAugen === "ja",
  );
  return {
    vierAugen: vierAugenFeld && !soloBetrieb(answers),
    kreditkarte: hasKreditkarte(answers),
    kasse: described(answers, "m08"),
    shop: described(answers, "m13"),
    lohn: described(answers, "m12"),
    kanzlei: kanzleiBestaetigt(answers),
    kanzleiDenied: kanzleiAbgelehnt(answers),
    sichtungTurnus: sichtungTurnus(answers),
    backup: backupGenannt(answers),
    kontrollen: kontrollenGenannt(answers),
    rolle: eigenbuchhaltungText(answers),
    kundenTexte: kundenFreitexte(answers),
  };
}

function selectedNames(values: Record<string, unknown> | undefined): string[] {
  return realControlNames(values);
}

/**
 * Freitext, der lang genug ist, um nicht zufällig in einer Katalogzeile zu stehen.
 * Auswahlwerte (ja, nein, vorhanden) sind keine Freitexte.
 */
const MIN_KUNDENSPANN = 8;
const AUSWAHLWERT = new Set([
  "ja",
  "nein",
  "unbekannt",
  "vorhanden",
  "offen",
  "nicht_zutreffend",
  "bestaetigt",
  "geplant",
  "h",
]);

function normAnzeige(value: string): string {
  return value.replaceAll("**", "").replaceAll("→", "->").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
}

function dokumentFormen(value: string): string[] {
  const shown = normAnzeige(value);
  if (!shown || AUSWAHLWERT.has(shown.toLowerCase())) return [];
  const out = new Set<string>();
  const slashed = shown.replaceAll("|", "/");
  for (const form of shown === slashed ? [shown] : [shown, slashed]) {
    if (form.length >= MIN_KUNDENSPANN) out.add(form);
    for (const piece of splitSentences(form)) {
      const sentence = piece.trim().replace(/[.\s]+$/, "");
      if (sentence.length >= MIN_KUNDENSPANN) out.add(sentence);
    }
  }
  return [...out];
}

function collectKunde(value: unknown, found: Set<string>, key?: string) {
  if (typeof value === "string") {
    for (const form of dokumentFormen(value)) found.add(form);
    return;
  }
  if (Array.isArray(value)) {
    // Stringlisten unter „kontrollen“ sind die Auswahl aus dem Kontrollkatalog.
    if (key === "kontrollen" && value.every((item) => typeof item === "string")) return;
    for (const item of value) collectKunde(item, found);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    collectKunde(child, found, childKey);
  }
}

function enumAnzeige(value: string): string {
  if (value === "ja") return "ja";
  if (value === "nein") return "nein";
  if (value === "unbekannt") return "noch zu klären";
  return value;
}

/** „Feldlabel: Wert“ einer bestätigten Frage. Das Label gehört zur Angabe und löscht sie nicht. */
function feldSpannen(id: string, values: Record<string, unknown>, found: Set<string>) {
  const question = modulQuestion(id)?.question ?? bereichQuestion(id)?.question;
  if (!question) return;
  for (const field of question.fields) {
    const raw = values[field.key];
    let shown = "";
    if (typeof raw === "string") {
      shown = field.type === "enum" ? enumAnzeige(raw.trim()) : normAnzeige(raw);
    } else if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
      if (field.key === "kontrollen") continue;
      shown = raw.map((item) => normAnzeige(item)).filter(Boolean).join(", ");
    }
    if (!shown || !field.label) continue;
    const span = `${field.label}: ${shown}`;
    if (span.length >= MIN_KUNDENSPANN) found.add(span);
  }
}

/** Bestätigte Freitexte, Tabellenzellen und ihre Feldlabels. Herkunft ist das Feld, nicht der Wortlaut. */
function kundenFreitexte(answers: IntakeAnswers): string[] {
  const found = new Set<string>();
  for (const [id, item] of Object.entries(answers.katalog ?? {})) {
    if (item?.status !== "bestaetigt") continue;
    collectKunde(item.values, found);
    if (item.values) feldSpannen(id, item.values, found);
    if (item.reason) collectKunde(item.reason, found);
  }
  return [...found].sort((a, b) => b.length - a.length);
}

/** Satz oder Zeile enthält bestätigten Kundentext und bleibt deshalb vollständig. */
function enthaeltKundenText(value: string, facts: BetriebFacts): boolean {
  return (facts.kundenTexte ?? []).some((item) => value.includes(item));
}

/** Thema ist verneint oder nicht vorhanden und darf nicht als Tatsache stehen. */
export function mentionsDenied(value: string, facts: BetriebFacts): boolean {
  if (!facts.vierAugen && /Vier-Augen/i.test(value)) return true;
  if (!facts.kreditkarte && /Kreditkarte/i.test(value)) return true;
  if (!facts.kasse && /Kassenbelege|Kassenbons?|Kassenbuch|Kassensystem|\bKasse\b/i.test(value)) return true;
  if (!facts.shop && /\bShop\b/i.test(value)) return true;
  if (!facts.lohn && /Lohnabrechnungen|Lohnabrechnung|Lohnservice|Lohnbuchhaltung|\bLohn\b/i.test(value)) return true;
  if (facts.kanzleiDenied && /Kanzlei/i.test(value)) return true;
  return false;
}

function scrubTokens(value: string, facts: BetriebFacts): string {
  let next = value;
  if (!facts.vierAugen) next = next.replace(/Vier-Augen(?:-[A-Za-zÄÖÜäöüß-]+)*/g, "");
  if (!facts.kreditkarte) next = next.replace(/Kreditkartenabrechnungen|Kreditkartenabrechnung|Kreditkarten|Kreditkarte/g, "");
  if (!facts.kasse) next = next.replace(/Kassenbelege|Kassenbons?|Kassenbuch|Kassensystem|\bKasse\b/g, "");
  if (!facts.shop) next = next.replace(/\bShop\b/g, "");
  if (!facts.lohn) next = next.replace(/Lohnabrechnungen|Lohnabrechnung|Lohnservice|Lohnbuchhaltung|\bLohn\b/g, "");
  if (facts.kanzleiDenied) {
    next = next.replace(/Steuerkanzlei/g, "");
    next = next.replace(/\bKanzlei\b/g, "");
  }
  return next;
}

function cleanup(value: string): string {
  return value
    .replace(/\(\s*\)/g, "")
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*,/g, "(")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/:\s*,/g, ":")
    .replace(/\s+([.;:])/g, "$1")
    .replace(/\bund\s+und\b/g, "und")
    .replace(/\bund\s+(?=[.;,]|$)/g, "")
    .replace(/\s+an die\s*(?=[.;,]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;.-]+$/g, "")
    .trim();
}

function keepSentence(sentence: string, facts: BetriebFacts): string | null {
  const trimmed = sentence.trim();
  if (!trimmed) return null;
  // Label und Freitext einer bestätigten Angabe bleiben unverändert.
  if (!mentionsDenied(trimmed, facts) || enthaeltKundenText(trimmed, facts)) return trimmed;
  const list = /Gegenstand:/.test(trimmed) || ((trimmed.match(/,/g) ?? []).length >= 2 && /^\s*[-•]/.test(trimmed));
  if (!list) return null;
  const scrubbed = cleanup(scrubTokens(trimmed, facts));
  if (!scrubbed || mentionsDenied(scrubbed, facts)) return null;
  return scrubbed;
}

/** Satzgrenze, nicht „Abs. 4“ oder „z. B. Eingangs“. */
function splitSentences(line: string): string[] {
  const parts: string[] = [];
  let start = 0;
  const boundary = /[.!?](?=\s+)/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(line))) {
    const end = match.index + 1;
    const prefix = line.slice(0, end);
    if (/(?:^|[\s(])(?:Abs|Nr|Art|Rz|Satz|bzw|ggf|ca|usw|etc|Dr|z\.\s*B|u\.\s*a|d\.\s*h|vgl)\.$/i.test(prefix)) {
      continue;
    }
    const gap = line.slice(end).match(/^\s+/);
    const rest = line.slice(end + (gap?.[0].length ?? 0));
    if (!/^[A-ZÄÖÜ]/.test(rest)) continue;
    parts.push(line.slice(start, end));
    start = end + (gap?.[0].length ?? 0);
  }
  const tail = line.slice(start);
  if (tail) parts.push(tail);
  return parts;
}

/** Entfernt Katalog- und Vorlagenbehauptungen zu verneinten Themen. Kundentext bleibt vollständig. */
export function redactDenied(markdown: string, facts: BetriebFacts): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\|\s*-{3,}/.test(line)) {
      out.push(line);
      continue;
    }
    if (line.startsWith("|")) {
      if (mentionsDenied(line, facts) && !enthaeltKundenText(line, facts)) continue;
      out.push(line);
      continue;
    }
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    const kept = splitSentences(line)
      .map((piece) => keepSentence(piece, facts))
      .filter((piece): piece is string => Boolean(piece));
    if (!kept.length) continue;
    let joined = kept.join(" ");
    if (!/[.!?]$/.test(joined) && /[.!?]$/.test(line.trim())) joined += ".";
    out.push(joined);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function withTurnus(name: string, turnus: string): string {
  if (!turnus) return name;
  const freq = /\b(täglich|tägliche|tageweise|monatlich|monatliche|wöchentlich|wöchentliche|quartalsweise|jährlich|jährliche)\b/i;
  if (!freq.test(name)) return name;
  if (name.toLowerCase().includes(turnus.toLowerCase())) return name;
  return name.replace(freq, turnus);
}

function questionOf(id: string) {
  return modulQuestion(id)?.question ?? bereichQuestion(id)?.question;
}

function answerSentence(question: NonNullable<ReturnType<typeof questionOf>>, values: Record<string, unknown>): string {
  if (isControlQuestionId(question.id) && isKeineKontrolleValues(values)) return "";
  return question.fields
    .map((field) => {
      const value = values[field.key];
      if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join(", ");
      return text(value);
    })
    .filter(Boolean)
    .join(". ");
}

/** Prozessschritte, deren Frage bestätigt ist. Teilgruppen beachten nur ihre ids. */
export function livedProzess(modul: ModulDef, answers: IntakeAnswers): BereichSchritt[] {
  const seen = new Set<string>();
  const out: BereichSchritt[] = [];
  for (const step of modulProzess(modul)) {
    if (!step.frage || seen.has(step.frage)) continue;
    const item = entry(answers, step.frage);
    if (item?.status !== "bestaetigt") continue;
    const question = questionOf(step.frage);
    const beschreibung = question ? answerSentence(question, item.values ?? {}) : "";
    if (!beschreibung) continue;
    const schritt = question?.title || step.schritt;
    const nachweis = step.nachweis
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && `${schritt} ${beschreibung}`.toLowerCase().includes(part.toLowerCase()))
      .join(", ");
    seen.add(step.frage);
    out.push({ ...step, schritt, beschreibung, nachweis: nachweis || "Angabe im Intake" });
  }
  return out;
}

const KEINE_KONTROLLE = new Set(["", "keine", "keine regelmäßige kontrolle", "keine regelmaessige kontrolle"]);
const KEINE_AUSNAHME = new Set(["", "keine", "keine ausnahme", "keine ausnahmen"]);

function normAngabe(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function istKeineKontrolle(value: string): boolean {
  return KEINE_KONTROLLE.has(normAngabe(value));
}

function istKeineAusnahme(value: string): boolean {
  return KEINE_AUSNAHME.has(normAngabe(value));
}

function controlAnswerIds(modul: ModulDef): string[] {
  const ids = new Set<string>();
  for (const item of modulKontrollen(modul)) {
    if (item.frage) ids.add(item.frage);
  }
  for (const id of [...modul.catalogIds, ...modulFragen(modul).map((question) => question.id)]) {
    if (id === "H01" || /92$/.test(id) || /^KF0[1-5]$/.test(id)) ids.add(id);
  }
  return [...ids];
}

function controlTokens(values: Record<string, unknown> | undefined): string[] {
  if (isKeineKontrolleValues(values)) return ["keine"];
  const names = selectedNames(values);
  if (names.length) return names;
  const free = text(values?.kontrollen);
  return free ? [free] : [];
}

function neinOderUnbekannt(value: string): boolean {
  return /^(nein|unbekannt)$/i.test(value.trim());
}

/** Ausgewählte Katalogzeile widerspricht einer bestätigten Sachangabe. */
function widersprichtAngabe(name: string, answers: IntakeAnswers): boolean {
  const er = entry(answers, "ER02");
  if (
    er?.status === "bestaetigt" &&
    neinOderUnbekannt(text(er.values?.validierung)) &&
    /Validierung strukturierter/i.test(name)
  ) {
    return true;
  }
  const pb = entry(answers, "PB05");
  if (pb?.status === "bestaetigt" && /^nein$/i.test(text(pb.values?.vernichtung)) && /Vernichtung/i.test(name)) {
    return true;
  }
  const ww = entry(answers, "WW05");
  if (
    ww?.status === "bestaetigt" &&
    /nur zur inventur/i.test(text(ww.values?.fuehrung)) &&
    /negativ|Bestandswert|Stichprobenzählung|Bestandskorrektur/i.test(name)
  ) {
    return true;
  }
  return false;
}

/** „Shop“ streichen, wenn das Modul nicht vorhanden ist; die übrige Abstimmung bleibt. */
function zweckOhneVerneintes(name: string, zweck: string, facts: BetriebFacts): string | null {
  if (name !== "Abstimmung Vorsysteme mit Buchhaltung") {
    return mentionsDenied(`${name} ${zweck}`, facts) ? null : zweck;
  }
  const teile = [facts.kasse ? "Kasse" : "", facts.shop ? "Shop" : "", facts.lohn ? "Lohn" : ""].filter(Boolean);
  if (!teile.length) return null;
  if (teile.length === 1) return `${teile[0]} ist vollständig übernommen.`;
  if (teile.length === 2) return `${teile[0]} und ${teile[1]} sind vollständig übernommen.`;
  return `${teile[0]}, ${teile[1]} und ${teile[2]} sind vollständig übernommen.`;
}

/** Ausgewählter Kontrollname darf als durchgeführte Kontrolle im PDF stehen. */
export function kontrolleSichtbar(name: string, answers: IntakeAnswers): boolean {
  if (!name.trim() || istKeineKontrolle(name)) return false;
  if (widersprichtAngabe(name, answers)) return false;
  return !mentionsDenied(name, betriebFacts(answers));
}

/** Nur ausgewählte Kontrollen mit Status „So läuft es heute“. „Keine…“ ist keine Katalogzeile. */
export function livedKontrollen(modul: ModulDef, answers: IntakeAnswers): Array<BereichKontrolle & { frage: string }> {
  const facts = betriebFacts(answers);
  const out: Array<BereichKontrolle & { frage: string }> = [];
  for (const item of modulKontrollen(modul)) {
    if (!item.frage) continue;
    const row = entry(answers, item.frage);
    if (row?.status !== "bestaetigt") continue;
    const selected = new Set(selectedNames(row.values).filter((name) => !istKeineKontrolle(name)));
    if (!selected.has(item.name)) continue;
    if (widersprichtAngabe(item.name, answers)) continue;
    const zweck = zweckOhneVerneintes(item.name, item.zweck, facts);
    if (!zweck) continue;
    out.push({ ...item, zweck, name: withTurnus(item.name, facts.sichtungTurnus) });
  }
  if (modul.catalogIds.includes("H01") && confirmed(answers, "H01") && !isKeineKontrolleValues(entry(answers, "H01")?.values)) {
    const raw = entry(answers, "H01")?.values?.kontrollen;
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (!row || typeof row !== "object") continue;
        const name = text((row as { name?: unknown }).name);
        if (!name || istKeineKontrolle(name)) continue;
        const turnus = text((row as { turnus?: unknown }).turnus);
        const nachweis = text((row as { nachweis?: unknown }).nachweis);
        const label = turnus ? `${name} (${turnus})` : name;
        out.push({ name: label, zweck: nachweis || "bestätigt", frage: "H01" });
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

export type KontrollenAbschnitt = {
  zeilen: Array<{ name: string; zweck: string }>;
  /** Neutraler Satz, wenn die bestätigte Angabe leer oder „Keine…“ ist. */
  satz: string;
};

/**
 * Abschnitt Kontrollen im Gesamtdokument.
 * Einziger Übergang von Kontroll-Angaben in diesen PDF-Abschnitt.
 */
export function kontrollenAbschnitt(modul: ModulDef, answers: IntakeAnswers): KontrollenAbschnitt {
  const zeilen = livedKontrollen(modul, answers).map((item) => ({ name: item.name, zweck: item.zweck }));
  if (zeilen.length) return { zeilen, satz: "" };
  const confirmedIds = controlAnswerIds(modul).filter((id) => confirmed(answers, id));
  if (!confirmedIds.length) return { zeilen: [], satz: "" };
  const onlyNone = confirmedIds.every((id) => {
    const tokens = controlTokens(entry(answers, id)?.values);
    return tokens.length === 0 || tokens.every((token) => istKeineKontrolle(token));
  });
  return onlyNone
    ? { zeilen: [], satz: KEINE_KONTROLLE_SATZ }
    : { zeilen: [], satz: "" };
}

/**
 * Abschnitt Ausnahmen im Gesamtdokument.
 * Einziger Übergang von Ausnahme-Angaben in die Katalogzeile des PDFs.
 * Leere und „Keine…“-Angaben werden ein neutraler Satz, nie ein Katalogbeispiel.
 */
export function ausnahmenInDetails(id: string, answers: IntakeAnswers, details: string[]): string[] {
  const abschnitt = ausnahmenRoh(id, answers);
  if (!abschnitt) return details;
  const banned = new Set(abschnitt.rohwerte.map((item) => normAngabe(item)).filter(Boolean));
  const cleaned = details
    .map((bit) =>
      bit
        .split(", ")
        .filter((part) => {
          const token = normAngabe(part);
          if (token === normAngabe(abschnitt.satz)) return false;
          if (banned.has(token)) return false;
          return ![...banned].some((item) => token === `ausnahmen: ${item}`);
        })
        .join(", "),
    )
    .filter((bit) => bit && normAngabe(bit) !== normAngabe(abschnitt.satz));
  return [...cleaned, abschnitt.satz];
}

function ausnahmenRoh(id: string, answers: IntakeAnswers): { satz: string; rohwerte: string[] } | null {
  const item = entry(answers, id);
  if (!item || item.status !== "bestaetigt") return null;
  const values = item.values ?? {};
  if (id === "C02") {
    const detail = values.kanaeleDetail;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
    const rohwerte: string[] = [];
    const stated: string[] = [];
    for (const row of Object.values(detail as Record<string, unknown>)) {
      if (!row || typeof row !== "object") continue;
      const raw = text((row as { ausnahmen?: unknown }).ausnahmen);
      const keine = (row as { keineAusnahmen?: unknown }).keineAusnahmen === true || istKeineAusnahme(raw);
      rohwerte.push(raw);
      if (!keine) stated.push(raw);
    }
    if (!rohwerte.length) return null;
    return {
      satz: stated.length ? `Ausnahmen: ${stated.join("; ")}.` : KEINE_AUSNAHMEN_SATZ,
      rohwerte,
    };
  }
  if (id === "C03") {
    const eingang = values.eingang;
    if (!eingang || typeof eingang !== "object" || Array.isArray(eingang)) {
      if (!("ausnahmen" in values)) return null;
    }
    const source =
      eingang && typeof eingang === "object" && !Array.isArray(eingang)
        ? (eingang as { ausnahmen?: unknown; keineAusnahmen?: unknown })
        : values;
    const raw = text(source.ausnahmen);
    const keine = source.keineAusnahmen === true || istKeineAusnahme(raw);
    return {
      satz: keine ? KEINE_AUSNAHMEN_SATZ : `Ausnahmen: ${raw}.`,
      rohwerte: [raw, raw ? `Ausnahmen: ${raw}` : ""],
    };
  }
  if (!("ausnahmen" in values)) return null;
  const raw = text(values.ausnahmen);
  return {
    satz: istKeineAusnahme(raw) ? KEINE_AUSNAHMEN_SATZ : raw,
    rohwerte: [raw],
  };
}

export function livedAufbewahrung(modul: ModulDef, answers: IntakeAnswers): BereichFrist[] {
  const facts = betriebFacts(answers);
  const out: BereichFrist[] = [];
  for (const item of modulAufbewahrung(modul)) {
    if (!mentionsDenied(item.unterlage, facts)) {
      out.push(item);
      continue;
    }
    const unterlage = cleanup(scrubTokens(item.unterlage, facts));
    if (!unterlage || mentionsDenied(unterlage, facts)) continue;
    out.push({ ...item, unterlage });
  }
  return out;
}

export function livedBegriffe(modul: ModulDef, answers: IntakeAnswers): Array<[string, string]> {
  const facts = betriebFacts(answers);
  const blob = [
    ...modulFragen(modul).map((question) => {
      const item = entry(answers, question.id);
      if (item?.status !== "bestaetigt") return "";
      return answerSentence(question, item.values ?? {});
    }),
    ...modul.catalogIds.map((id) => {
      const item = entry(answers, id);
      if (item?.status !== "bestaetigt") return "";
      return Object.values(item.values ?? {}).map((value) => text(value) || (Array.isArray(value) ? value.map((part) => text(part)).join(" ") : "")).join(" ");
    }),
  ]
    .join(" ")
    .toLowerCase();
  const own = (modul.begriffe ?? []).filter(([term, meaning]) => !mentionsDenied(`${term} ${meaning}`, facts));
  const extra = modulBegriffe(modul)
    .filter(([term]) => !own.some(([kept]) => kept === term))
    .filter(([term, meaning]) => !mentionsDenied(`${term} ${meaning}`, facts) && blob.includes(term.toLowerCase()));
  return [...own, ...extra];
}

export function moduleHasLivedAnswers(modul: ModulDef, answers: IntakeAnswers): boolean {
  const ids = [...modul.catalogIds, ...modulFragen(modul).map((question) => question.id)];
  return ids.some((id) => confirmed(answers, id));
}

/** Statische Vorlagenabsätze, die eine fehlende Angabe behaupten. */
export function stripFalseFallbacks(block: string, facts: BetriebFacts): string {
  const parts = block.split(/\n\n+/);
  return parts
    .filter((part) => {
      if (facts.backup && /Backup-Verfahren ist im Intake nicht angegeben/.test(part)) return false;
      if (facts.kontrollen && /keine konkrete Kontrollroutine bestätigt/.test(part)) return false;
      if (facts.kontrollen && /nur bestätigte Kontrollen aus Intake/.test(part)) return false;
      return true;
    })
    .join("\n\n")
    .trim();
}

export function staticModulText(modul: ModulDef, facts: BetriebFacts): { kurz: string; inhalt: string[] } {
  let kurz = modul.kurz;
  let inhalt = [...modul.inhalt];
  if (facts.kanzleiDenied) {
    kurz = kurz.replace(/\s*und Übergabe an die Kanzlei/g, "").replace(/Übergabe an die Kanzlei/g, "Abschluss im Betrieb");
    inhalt = inhalt
      .filter((item) => !/Kanzlei/.test(item))
      .map((item) => item.replace(/Steuerkanzlei und Leistungsumfang/g, "Eigenbuchhaltung und Steuererklärungen"));
  }
  if (!facts.kreditkarte) {
    kurz = kurz.replace(/,?\s*Kreditkarte/g, "");
    inhalt = inhalt
      .map((item) => item.replace(/\s*und Kreditkarten/g, "").replace(/Kreditkarten/g, "").trim())
      .filter((item) => item && !/^und\b/i.test(item));
  }
  if (!facts.kasse) {
    inhalt = inhalt.filter((item) => !/Kassenbelege|Kassenbons?|Kassenbuch|Kassensystem|\bKasse\b/i.test(item));
  }
  if (!facts.lohn) {
    kurz = kurz.replace(/Buchhaltungs- und Lohnservice/g, "Buchhaltungsservice");
    inhalt = inhalt
      .map((item) => item.replace(/Buchhaltungs- und Lohnservice/g, "Buchhaltungsservice"))
      .filter((item) => !/Lohnabrechnungen|Lohnabrechnung|Lohnservice|Lohnbuchhaltung|\bLohn\b/i.test(item));
  }
  return { kurz: cleanup(kurz) || modul.titel, inhalt };
}

/** Benachbarte Wortwiederholungen („lexoffice lexoffice“) zusammenziehen. */
export function collapseRepeatedTokens(value: string): string {
  const repeated = /(^|[^\p{L}\p{N}])([\p{L}\p{N}]+)(?:\s+\2)+/giu;
  let current = value;
  let next = current.replace(repeated, "$1$2");
  while (next !== current) {
    current = next;
    next = current.replace(repeated, "$1$2");
  }
  return next;
}

export function rewriteChapterRefs(text: string, present: Set<number>): string {
  return text.replace(/Kap(?:itel)?\.?\s*(\d+)/gi, (full, raw: string) => {
    const nr = Number(raw);
    if (present.has(nr)) return full;
    return "Anhang A";
  });
}

export function groupSkipped(answers: IntakeAnswers, gruppe: { teil?: string }): boolean {
  if (!gruppe.teil) return false;
  const check = answers.module?.check ?? {};
  return check[gruppe.teil as keyof typeof check] === "nein";
}

/** Fragen, die bei verneinter Kanzlei nicht gedruckt werden. */
export function hiddenQuestion(id: string, facts: BetriebFacts): boolean {
  return facts.kanzleiDenied && (id === "BU07" || id === "F05");
}

export function modulNrPresent(answers: IntakeAnswers): Set<number> {
  const present = new Set<number>();
  for (let nr = 1; nr <= 24; nr += 1) {
    const modul = modulById(`m${String(nr).padStart(2, "0")}`);
    if (!modul) continue;
    if (effectiveModulStatus(answers, modul.id).status === "nicht_vorhanden") continue;
    present.add(modul.nr);
  }
  return present;
}
