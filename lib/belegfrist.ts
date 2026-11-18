/**
 * Gemeinsame Erkennung der alten Buchungsbeleg-Frist.
 * Quelle-Scan (check:belegfrist) und Bestand-Zählung nutzen dieselben Sätze.
 * Verneinungen und der gesetzliche Dreiklang sind kein Treffer.
 * „10 Jahren“, „nach 10 Jahren“ und „zehnjährig“ sind ein Treffer.
 */

const TEN = /(?<![\p{L}\d])(?:(?:10|zehn)[\s-]*jährig\w*|(?:10|zehn)\s+Jahren?)(?![\p{L}])/iu;
const EIGHT = /(?<![\p{L}\d])(?:(?:8|acht)[\s-]*jährig\w*|(?:8|acht)\s+Jahren?)(?![\p{L}])/iu;
const BELEG = /Buchungsbeleg\w*/u;

function mentionsBeleg(text: string): boolean {
  return BELEG.test(text);
}

const ABBREVIATIONS = ["z. B.", "z.B.", "d. h.", "d.h.", "u. a.", "u.a.", "i. d.", "i.d.", "Abs.", "Nr.", "Rz.", "Art.", "bzw.", "ggf.", "ca.", "Dr.", "Bd."];

function maskAbbr(line: string): string {
  let masked = line;
  for (const abbr of ABBREVIATIONS) masked = masked.replaceAll(abbr, abbr.replaceAll(".", "·"));
  return masked;
}

export function sentences(line: string): string[] {
  return maskAbbr(line)
    .split(/[.!?]+/)
    .map((part) => part.replaceAll("·", ".").trim())
    .filter((part) => part.length > 0);
}

/** Historie bis 2024, Institutsausnahme und ausdrücklich verneinte Pauschalfrist. */
function statedAsPastOrException(sentence: string): boolean {
  if (/≠\s+pauschal\s+10\s+Jahre/u.test(sentence)) return true;
  if (/31\. Dezember 2024/.test(sentence) || /Dezember 2024 standen Buchungsbelege/.test(sentence)) return true;
  if (/noch mit zehn Jahren angesetzt/.test(sentence)) return true;
  if (/bleiben dort also bei zehn Jahren/.test(sentence)) return true;
  if (/demselben Kreis/.test(sentence) && /§\s*257\b|\bHGB\b/u.test(sentence)) return true;
  return false;
}

/**
 * Einfache Verneinung, auch ohne „sondern“:
 * „nicht/keine (mehr/länger) 10 Jahre“. „8 statt 10“ ebenfalls.
 * „10 statt 8“ bleibt ein Treffer und wird davor geprüft.
 */
function belegTenIsNegated(sentence: string): boolean {
  if (/(?:8|acht)\s+statt\s+(?:10|zehn)\s+Jahren?/iu.test(sentence)) return true;
  if (
    /\b(?:nicht|keine)\s+(?:(?:mehr|länger|laenger)\s+)?(?:(?:10|zehn)[\s-]*jährig\w*|(?:10|zehn)\s+Jahren?)/iu.test(
      sentence,
    )
  ) {
    return true;
  }
  return false;
}

/** Kommas und „und“ in Klammern bleiben in derselben Klausel. „(z. B. Eingangs- und …)“ zerreißt die Frist nicht. */
function clausesOf(sentence: string): { text: string; before: string }[] {
  const masked = sentence.replace(/(?<![\p{L}\d])\([^)]*\)/gu, (paren) =>
    paren.replace(/[,;]/g, "\u0001").replace(/\sund\s/giu, " \u0002 "),
  );
  const parts = masked.split(/([,;]|\sund\s)/u);
  const clauses: { text: string; before: string }[] = [];
  let before = "";
  for (const part of parts) {
    if (part === "," || part === ";" || /^\sund\s$/u.test(part)) {
      before = part.trim();
      continue;
    }
    const text = part.replaceAll("\u0001", ",").replaceAll("\u0002", "und").trim();
    if (text) clauses.push({ text, before });
    before = "";
  }
  return clauses;
}

/** „ist kein Buchungsbeleg“ verneint den Beleg. „Kein Buchungsbeleg darf … 10 Jahre“ bleibt die Frist. */
function deniesBeleg(clause: string): boolean {
  return (
    /\b(?:ist|sind|war|waren)\s+kein(?:e|en|er)?\s+Buchungsbeleg/iu.test(clause) ||
    /\bkein(?:e|en|er)?\s+Buchungsbelege?\s+(?:ist|sind|war|waren)\b/iu.test(clause)
  );
}

function statesTenInsteadOfEight(text: string): boolean {
  return /(?:10|zehn)\s+statt\s+(?:8|acht)\s+Jahren?/iu.test(text);
}

/** Die Verneinung gilt nur für die Klausel, in der der Buchungsbeleg steht. */
function clauseStatesOldBelegPeriod(clause: string, previous: string, next: string, nextSep: string): boolean {
  if (!mentionsBeleg(clause)) return false;
  if (deniesBeleg(clause)) return false;
  if (statesTenInsteadOfEight(clause)) return true;
  if (belegTenIsNegated(clause) || statedAsPastOrException(clause)) return false;
  if (EIGHT.test(clause)) return false;
  if (TEN.test(clause)) return true;
  if (nextSep === "und" && TEN.test(next) && !EIGHT.test(next) && !belegTenIsNegated(next)) return true;
  if (statesTenInsteadOfEight(previous)) return true;
  if (belegTenIsNegated(previous) || statedAsPastOrException(previous)) return false;
  if (EIGHT.test(previous) && !TEN.test(previous)) return false;
  return TEN.test(previous);
}

/** Treffer, wenn der Buchungsbeleg in seiner Klausel an der alten Zehnjahresfrist hängt. */
export function belegfristHit(sentence: string): string | null {
  if (!mentionsBeleg(sentence)) return null;
  if (!TEN.test(sentence) && !statesTenInsteadOfEight(sentence)) return null;
  const clauses = clausesOf(sentence);
  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index]?.text ?? "";
    const previous = index > 0 ? clauses[index - 1]?.text ?? "" : "";
    const next = clauses[index + 1]?.text ?? "";
    const nextSep = clauses[index + 1]?.before ?? "";
    if (clauseStatesOldBelegPeriod(clause, previous, next, nextSep)) {
      return `alte Frist bei Buchungsbeleg: ${sentence.trim()}`;
    }
    if (
      !mentionsBeleg(clause) &&
      mentionsBeleg(clauses[index - 1]?.text ?? "") &&
      /\bsondern\b/iu.test(clause) &&
      TEN.test(clause) &&
      !EIGHT.test(clause) &&
      !belegTenIsNegated(previous)
    ) {
      return `alte Frist bei Buchungsbeleg: ${sentence.trim()}`;
    }
  }
  return null;
}

function endsSentence(line: string): boolean {
  return /[.!?]["')\]]*$/.test(maskAbbr(line).trim());
}

function proseContinuation(current: string, next: string): boolean {
  const following = next.trim();
  const last = current.trim();
  if (!last || !following) return false;
  if (endsSentence(last)) return false;
  if (/^(?:[|#>]|[-*]\s|\d+\.\s|```)/.test(following) || /^(?:[|#>]|[-*]\s|\d+\.\s|```)/.test(last)) return false;
  return true;
}

function sentenceHits(chunk: string): string[] {
  const found: string[] = [];
  for (const sentence of sentences(chunk)) {
    const hit = belegfristHit(sentence);
    if (hit) found.push(hit);
  }
  return found;
}

function joinContinued(lines: string[], start: number, width: number): string | null {
  if (start + width > lines.length) return null;
  let acc = lines[start] ?? "";
  for (let step = 1; step < width; step += 1) {
    const next = lines[start + step] ?? "";
    if (!proseContinuation(acc, next)) return null;
    acc = `${acc.trim()} ${next.trim()}`;
  }
  return acc;
}

function spanHits(lines: string[], start: number, width: number): string[] {
  const joined = joinContinued(lines, start, width);
  if (!joined) return [];
  const alone = new Set<string>();
  for (let step = 0; step < width; step += 1) {
    for (const hit of sentenceHits(lines[start + step] ?? "")) alone.add(hit);
  }
  for (let smaller = 2; smaller < width; smaller += 1) {
    const part = joinContinued(lines, start, smaller);
    if (!part) continue;
    for (const hit of sentenceHits(part)) alone.add(hit);
  }
  return sentenceHits(joined).filter((hit) => !alone.has(hit));
}

export function locatedHits(text: string): { line: number; hit: string }[] {
  const lines = text.split("\n");
  const found: { line: number; hit: string }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!joinContinued(lines, index, 2)) {
      for (const hit of sentenceHits(lines[index] ?? "")) found.push({ line: index + 1, hit });
    }
    for (const width of [2, 3]) {
      if (width < 3 && joinContinued(lines, index, width + 1)) continue;
      for (const hit of spanHits(lines, index, width)) found.push({ line: index + 1, hit });
    }
  }
  return found;
}

/** Einzelsätze und Sätze, die über bis zu zwei Folgezeilen weitergehen. */
export function hitsIn(text: string): string[] {
  return locatedHits(text).map((item) => item.hit);
}
