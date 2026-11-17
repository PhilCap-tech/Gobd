/**
 * Rolle am Satzanfang groß, unabhängig vom Rollennamen.
 * Abkürzungen wie „z. B.“, „bzw.“ oder „Abs.“ bleiben kleingeschrieben.
 */

const ABKUERZUNG = new Set([
  "abs",
  "art",
  "bd",
  "bzw",
  "ca",
  "dr",
  "etc",
  "ggf",
  "inkl",
  "mio",
  "mrd",
  "nr",
  "rz",
  "str",
  "tel",
  "usw",
  "vgl",
  "zzgl",
]);

function afterAbbreviation(before: string): boolean {
  const word = before.match(/(\p{L}+)$/u)?.[1] ?? "";
  return word.length < 4 || ABKUERZUNG.has(word.toLowerCase());
}

/** Kundentext: „Intake“ wird „Fragebogen“. Der Fragebogen selbst bleibt unverändert. */
export function fragebogenStattIntake(text: string): string {
  return text
    .replaceAll("Kunden-Intake", "dem Fragebogen")
    .replaceAll("im Intake bestätigten", "im Fragebogen bestätigten")
    .replaceAll("im Intake bestätigte", "im Fragebogen bestätigte")
    .replaceAll("aus dem Intake", "aus dem Fragebogen")
    .replaceAll("aus Intake", "aus dem Fragebogen")
    .replaceAll("laut Intake", "laut Fragebogen")
    .replaceAll("im Intake", "im Fragebogen")
    .replaceAll("Intake", "Fragebogen");
}

export function capitalizeSentenceStart(text: string): string {
  const afterPunct = text.replace(/([.!?])(\s+)(\p{Ll})/gu, (match, punct: string, space: string, letter: string, offset: number, full: string) => {
    if (afterAbbreviation(full.slice(0, offset))) return match;
    return `${punct}${space}${letter.toUpperCase()}`;
  });
  return afterPunct.replace(/(^|\n[ \t]*\n+)(\p{Ll})/gu, (match, lead: string, _letter: string, offset: number, full: string) => {
    const word = full.slice(offset + lead.length).match(/^(\p{L}+)/u)?.[1] ?? "";
    if (word.length < 2 || ABKUERZUNG.has(word.toLowerCase())) return match;
    return `${lead}${word[0]?.toUpperCase() ?? ""}`;
  });
}
