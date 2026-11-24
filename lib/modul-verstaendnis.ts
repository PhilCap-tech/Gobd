/**
 * Verständnis-Regeln für Modul 1 und den Einstieg in Modul 2.
 * Sichtbare Sätze stehen hier einmal, im formellen Sie.
 */
import type { IntakeAnswers } from "@/lib/types";
import type { CheckAntwort, CheckKey } from "@/lib/module/typen";

export const FIKTIV_TOKEN = "(fiktiv)";

export const FIKTIV_FIELD_MESSAGE = "Bitte ersetzen Sie den Beispielwert durch Ihre eigene Angabe.";

export const BEISPIELWERT_OFFEN =
  "Ein Beispielwert aus der Vorlage ist keine Angabe zum eigenen System.";

export const WW01_HILFE =
  "Nennen Sie das Programm, in dem Sie Artikel und Bestände führen, mit Namen. Wenn Sie kein eigenes Programm haben, schreiben Sie, wo Bestände geführt werden, zum Beispiel ‚in der Kasse‘ oder ‚Excel-Liste‘.";

export const WW01_SYSTEM_PLACEHOLDER = "z. B. Name Ihres Warenwirtschaftsprogramms";

export const WW01_VORGAENGE_PLACEHOLDER =
  "Wareneingang, Umlagerung, Verkauf über die Kasse, Inventur einmal jährlich";

export const AF01_PROMPT =
  "Wie legen Sie in Ihrem Betrieb fest, wie lange eine Unterlage aufbewahrt wird, und wo ist das vermerkt?";

export const AF01_HILFE =
  "Die gesetzlichen Fristen (zum Beispiel 10 Jahre für Bücher, 8 Jahre für Buchungsbelege, 6 Jahre für Geschäftsbriefe) setzt das Tool selbst in die Dokumentation ein. Hier geht es um Ihren Ablauf: Wer ordnet eine Unterlage einer Frist zu, womit (Liste, Ordnerbeschriftung, Kennzeichen im Archivprogramm) und wer prüft vor dem Löschen?";

export const AF01_PLACEHOLDER =
  "Die Buchhaltung führt eine Fristenliste je Unterlagenart. Im Archiv des Buchhaltungsprogramms ist das Aufbewahrungsende hinterlegt. Gelöscht wird erst nach Freigabe durch die Geschäftsleitung.";

export const AF01_STATUTORY_HINT =
  "Ihr Text gibt die gesetzlichen Fristen wieder. Die Fristen setzt das Tool selbst ein. Bitte beschreiben Sie, wie Sie die Frist in Ihrem Betrieb zuordnen und vermerken.";

export const VORSCHLAG_MARKE =
  "Vorschlag aus der Branchenvorlage: Bitte an Ihren Betrieb anpassen oder bestätigen.";

export const VORSCHLAG_CHECKBOX = "Das stimmt so für meinen Betrieb.";

export const VORSCHLAG_RUECKFRAGE =
  "Sie übernehmen den Vorschlag aus der Vorlage unverändert. Stimmt das genau so für Ihren Betrieb?";

export const VORSCHLAG_ANPASSEN_HINWEIS = "Bitte passen Sie dieses Feld an Ihren Betrieb an.";

/** Marke direkt am Feld, nur für diesen noch unveränderten Vorschlag. */
export function vorschlagMark(label: string): string {
  const name = label.trim();
  if (!name) return VORSCHLAG_MARKE;
  return `Vorschlag aus der Branchenvorlage für „${name}“: Bitte an Ihren Betrieb anpassen oder bestätigen.`;
}

/** Rückfrage mit den Feldnamen, die noch genau dem Vorschlag entsprechen. */
export function vorschlagRueckfrageText(labels: readonly string[]): string {
  const names = labels.map((label) => label.trim()).filter(Boolean);
  if (!names.length) return VORSCHLAG_RUECKFRAGE;
  const list =
    names.length === 1
      ? `„${names[0]}“`
      : names.length === 2
        ? `„${names[0]}“ und „${names[1]}“`
        : `${names
            .slice(0, -1)
            .map((name) => `„${name}“`)
            .join(", ")} und „${names[names.length - 1]}“`;
  return `Sie übernehmen den Vorschlag aus der Vorlage unverändert für ${list}. Stimmt das genau so für Ihren Betrieb?`;
}

export const VORSCHLAG_JA = "Ja, stimmt";

export const VORSCHLAG_ANPASSEN = "Anpassen";

export const KANZLEI_LABEL =
  "Arbeitet eine Steuerkanzlei oder ein Buchhaltungsservice für Ihren Betrieb?";

export const KANZLEI_HILFE =
  "Wählen Sie ‚Ja‘ auch dann, wenn Sie die laufende Buchhaltung selbst machen und die Kanzlei nur einen Teil übernimmt, zum Beispiel Jahresabschluss, Steuererklärungen oder Lohn.";

export const KANZLEI_WIDERSPRUCH =
  "Sie haben eine Steuerkanzlei eingetragen, beim Betriebs-Check aber ‚Nein‘ gewählt. Arbeitet die Kanzlei für Sie (auch nur für Jahresabschluss oder Steuererklärungen)?";

export const KANZLEI_JA = "Ja, Check auf Ja setzen";

export const KANZLEI_NEIN = "Nein, Kanzlei-Eintrag entfernen";

export const KANZLEI_WIDERSPRUCH_OFFEN =
  "Beteiligung einer Steuerkanzlei ist widersprüchlich angegeben.";

export const RETOUREN_HILFE =
  "Zum Beispiel Umtausch oder Rückgabe im Laden, Rücksendungen von Kunden, Gutschriften an Kunden oder Rücksendungen an Ihre Lieferanten.";

export const RETOUREN_HINWEIS =
  "Retouren beschreiben Sie in einem eigenen Abschnitt, auch ohne Onlineshop, zum Beispiel Umtausch im Laden oder Rücksendungen an Lieferanten.";

export const MODUL_SPAETER_LABEL = "Dieses Modul später ausfüllen";

export const MODUL_SPAETER_HINWEIS = "Das Modul bleibt als offene Aufgabe in Ihrem Konto.";

export const STATUS_MISSING_MESSAGE =
  "Bitte angeben, ob das heute so läuft, künftig so laufen soll oder noch zu klären ist.";

export function statusMissingSummary(count: number): string {
  return `Bei ${count} Fragen fehlt noch die Angabe, ob es heute so läuft. Sie können das Modul auch später ausfüllen.`;
}

export const ENTFAELLT_CHIP = "Gibt es bei uns nicht";

export const ENTFAELLT_GRUND = "Kommt in unserem Betrieb nicht vor.";

/** Kernfragen ohne den vierten Chip, auch wenn die allgemeine Regel zuträfe. */
const ENTFAELLT_HIDDEN = new Set(["VK01", "LE02", "LE05"]);

/**
 * Dauerhaft vorhandene Themen. Priorität niedrig oder „Gibt es“ reicht hier nicht
 * für den Chip „Gibt es bei uns nicht“.
 */
const ENTFAELLT_PERMANENT = new Set(["SN05", "PZ07", "AF05", "AW06", "SY06"]);

/** Ausdrücklich mit Chip, auch ohne niedrige Priorität und ohne „Gibt es“. */
const ENTFAELLT_FORCE = new Set(["LE01", "LE03", "LE04"]);

const SHOP_ALWAYS = new Set(["EC00", "EC91", "EC92"]);

export function valueContainsFiktiv(value: unknown): boolean {
  if (typeof value === "string") return value.includes(FIKTIV_TOKEN);
  if (Array.isArray(value)) return value.some((item) => valueContainsFiktiv(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => valueContainsFiktiv(item));
  }
  return false;
}

export function isMusterSample(answers: IntakeAnswers): boolean {
  const company = answers.katalog?.A01?.values?.company;
  return typeof company === "string" && company.includes("(Muster, fiktiv)");
}

/** Gesetzestext ohne eigenen Ablauf. Der alte AF01-Wortlaut löst den Hinweis aus. */
export function af01StatutoryHint(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const years = new Set<string>();
  for (const match of value.matchAll(/\b(10|8|6) Jahre\b/g)) {
    if (match[1]) years.add(match[1]);
  }
  const statutory = value.includes("§ 147") || years.size >= 2;
  if (!statutory) return null;
  if (/\b(wir|Buchhaltung|Geschäftsleitung|Liste|Archiv|markier|kennzeichn|prüft)\b/i.test(value)) {
    return null;
  }
  return AF01_STATUTORY_HINT;
}

export function sameSuggestion(left: unknown, right: unknown): boolean {
  return stableSuggestion(left) === stableSuggestion(right);
}

function stableSuggestion(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.trim());
  if (Array.isArray(value)) return `[${value.map((item) => stableSuggestion(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${key}:${stableSuggestion(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export type SuggestionEntry = {
  values?: Record<string, unknown>;
  vorschlag?: Record<string, unknown>;
  vorschlagOk?: string[];
  /** Feldschlüssel mit offener Rückfrage. Ein boolescher Altwert wird ignoriert. */
  vorschlagRueckfrage?: string[] | boolean;
  status?: string;
};

/** Felder, deren Wert noch genau der unveränderte Vorschlag ist und nicht bestätigt wurde. */
export function unconfirmedSuggestionKeys(entry: SuggestionEntry | undefined): string[] {
  const suggested = entry?.vorschlag ?? {};
  const ok = new Set(entry?.vorschlagOk ?? []);
  const values = entry?.values ?? {};
  return Object.keys(suggested).filter(
    (key) => sameSuggestion(suggested[key], values[key]) && !ok.has(key),
  );
}

export function suggestionConfirmed(entry: SuggestionEntry | undefined): boolean {
  const matching = Object.keys(entry?.vorschlag ?? {}).filter((key) =>
    sameSuggestion(entry?.vorschlag?.[key], entry?.values?.[key]),
  );
  if (!matching.length) return false;
  const ok = new Set(entry?.vorschlagOk ?? []);
  return matching.every((key) => ok.has(key));
}

/** Vorschlag, dessen Wert noch genau so dasteht, bestätigt oder nicht. */
export function matchingSuggestionKeys(entry: SuggestionEntry | undefined): string[] {
  const suggested = entry?.vorschlag ?? {};
  const values = entry?.values ?? {};
  return Object.keys(suggested).filter((key) => sameSuggestion(suggested[key], values[key]));
}

export function fieldIsUnconfirmedSuggestion(entry: SuggestionEntry | undefined, key: string): boolean {
  return unconfirmedSuggestionKeys(entry).includes(key);
}

/** Fokusziel für Kartenfragen ohne eigenes Feld-Element. */
export function p1SuggestionBlockId(questionId: string): string {
  return `angabe-${questionId}-karte`;
}

export function hasSuggestionMark(entry: SuggestionEntry | undefined): boolean {
  return unconfirmedSuggestionKeys(entry).length > 0;
}

/** Feldreihenfolge der Frage, nicht die Reihenfolge im gespeicherten Objekt. */
export function orderSuggestionKeys(fieldOrder: readonly string[], keys: readonly string[]): string[] {
  const rank = new Map(fieldOrder.map((key, index) => [key, index]));
  return [...keys].sort((left, right) => (rank.get(left) ?? 999) - (rank.get(right) ?? 999));
}

/** Offene Rückfrage nur für Felder, die noch unverändert sind. Boolesche Altdaten zählen nicht. */
export function openSuggestionKeys(entry: SuggestionEntry | undefined): string[] {
  const raw = entry?.vorschlagRueckfrage;
  if (!Array.isArray(raw)) return [];
  const pending = new Set(unconfirmedSuggestionKeys(entry));
  return raw.filter((key) => pending.has(key));
}

export function vorschlagOkAfterValueEdit(
  entry: SuggestionEntry | undefined,
  key: string,
  nextValue: unknown,
): string[] | undefined {
  if (sameSuggestion(entry?.vorschlag?.[key], nextValue)) return entry?.vorschlagOk;
  const next = (entry?.vorschlagOk ?? []).filter((item) => item !== key);
  return next.length ? next : undefined;
}

/** Fortschritt: ein unbestätigter Vorschlag zählt nicht als beantwortet. */
export function suggestionCountsAsAnswered(entry: SuggestionEntry | undefined): boolean {
  if (!entry) return false;
  const pending = unconfirmedSuggestionKeys(entry);
  const hasOther = Object.entries(entry.values ?? {}).some(([key, value]) => {
    if (pending.includes(key)) return false;
    return valueFilled(value);
  });
  if (entry.status === "bestaetigt" && pending.length) return false;
  if (entry.status) return true;
  return hasOther;
}

function valueFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.some((item) => valueFilled(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => valueFilled(item));
  }
  if (typeof value === "string") return value.trim() !== "";
  return value != null && value !== false;
}

export function entfaelltChipVisible(id: string, prompt: string, priority?: string): boolean {
  if (ENTFAELLT_PERMANENT.has(id)) return false;
  if (ENTFAELLT_HIDDEN.has(id)) return false;
  if (ENTFAELLT_FORCE.has(id)) return true;
  if (priority === "niedrig") return true;
  return /^Gibt es\b/.test(prompt.trim());
}

/** Gespeicherter Stand „gibt es bei uns nicht“, auch aus älteren Entwürfen. */
export function storedEntfaelltStatus(status: string | undefined): boolean {
  return status === "nicht_zutreffend" || status === "nicht_vorhanden";
}

/**
 * Der Chip bleibt sichtbar, wenn ein Entwurf ihn schon gespeichert hat.
 * Sonst gilt die Ausschlussliste.
 */
export function entfaelltChipShown(
  id: string,
  prompt: string,
  priority: string | undefined,
  storedStatus: string | undefined,
): boolean {
  if (storedEntfaelltStatus(storedStatus)) return true;
  return entfaelltChipVisible(id, prompt, priority);
}

/** Begründung bleibt freiwillig, auch wenn der Chip für neue Antworten fehlt. */
export function entfaelltReasonOptional(id: string, allowEntfaellt: boolean | undefined): boolean {
  return allowEntfaellt === true || ENTFAELLT_PERMANENT.has(id);
}

export function questionCheckTeil(
  modulId: string,
  questionId: string,
  gruppeTeil?: string,
): CheckKey | undefined {
  if (
    modulId === "m13" &&
    questionId.startsWith("EC") &&
    !SHOP_ALWAYS.has(questionId)
  ) {
    return "online";
  }
  if (gruppeTeil === "online" || gruppeTeil === "personal" || gruppeTeil === "retouren" || gruppeTeil === "zeiterfassung") {
    return gruppeTeil;
  }
  return undefined;
}

export function shopQuestionWhenOffline(questionId: string, online: CheckAntwort | undefined): boolean {
  if (!questionId.startsWith("EC") || SHOP_ALWAYS.has(questionId)) return false;
  return online === "nein";
}

export function narrowedModuleTitle(
  modulId: string,
  check: Partial<Record<CheckKey, CheckAntwort>>,
): string | null {
  if (modulId === "m13" && check.online === "nein" && check.retouren === "ja") {
    return "Modul 13: Retouren und Erstattungen";
  }
  if (modulId === "m12" && check.personal === "nein" && check.zeiterfassung === "ja") {
    return "Modul 12: Zeiterfassung";
  }
  return null;
}

export function retourenHinweis(check: Partial<Record<CheckKey, CheckAntwort>>): string | null {
  if (check.retouren === "ja" && check.online === "nein") return RETOUREN_HINWEIS;
  return null;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function kanzleiWiderspruch(answers: IntakeAnswers): boolean {
  if (answers.module?.check?.kanzlei !== "nein") return false;
  if (textOf(answers.module?.stammdaten?.kanzlei)) return true;
  if (textOf(answers.steuerberater)) return true;
  if (textOf(answers.katalog?.F05?.values?.kanzleiName)) return true;
  const duties = textOf(answers.katalog?.UO03?.values?.zustaendigkeiten);
  return /^Steuerkanzlei:\s*\S/m.test(duties) || /\nSteuerkanzlei:\s*\S/.test(`\n${duties}`);
}

export function selectedActivities(answers: IntakeAnswers, katalogBranchen?: unknown): string[] {
  const fromAnswers = Array.isArray(answers.branchen) ? answers.branchen.map((item) => String(item)) : [];
  const raw = katalogBranchen ?? answers.katalog?.A01?.values?.branchen;
  const fromCatalog = Array.isArray(raw) ? raw.map((item) => String(item)) : [];
  return [...new Set([...fromAnswers, ...fromCatalog])];
}

export function activitySelected(activities: readonly string[], name: string): boolean {
  return activities.includes(name);
}
