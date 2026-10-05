import {
  bereichById,
  bereichChapterId,
  bereichIdOf,
  isBelegfluss,
  type BereichField,
  type BereichQuestion,
} from "@/lib/bereiche";
import type { IntakeAnswers } from "@/lib/types";

type Entry = NonNullable<IntakeAnswers["katalog"]>[string];

function clean(value: string): string {
  return value.replaceAll("**", "").replace(/\s+/g, " ").trim();
}

function shown(field: BereichField, value: unknown): string {
  if (Array.isArray(value)) {
    return clean(value.map((item) => String(item)).filter(Boolean).join(", "));
  }
  if (typeof value !== "string") return "";
  const text = clean(value);
  if (field.type === "enum") {
    if (text === "ja") return "ja";
    if (text === "nein") return "nein";
    if (text === "unbekannt") return "noch zu klären";
  }
  return text;
}

/** One question as PDF lines. Only `bestaetigt` is written as present-tense practice. */
export function bereichQuestionLines(question: BereichQuestion, entry: Entry | undefined): string[] {
  const status = entry?.status;
  const head = `**${question.title}:**`;
  if (status === "bestaetigt") {
    const parts = question.fields
      .map((field) => {
        const value = shown(field, entry?.values?.[field.key]);
        return value ? `${field.label}: ${value}` : "";
      })
      .filter(Boolean);
    if (!parts.length) return [`${head} bestätigt, ohne nähere Angabe.`];
    return [`${head} ${parts.join(". ")}.`];
  }
  if (status === "geplant") {
    return [`${head} vorgesehen, aber noch nicht gelebte Praxis. Siehe offene Punkte.`];
  }
  if (status === "nicht_zutreffend") {
    const reason = clean(entry?.reason ?? "");
    return [`${head} entfällt${reason ? `. Grund: ${reason}` : ""}.`];
  }
  return [`${head} noch zu klären. Siehe offene Punkte.`];
}

/** Lived responsibility of the area (xx00), only when bestätigt. */
export function bereichVerantwortung(answers: IntakeAnswers): { verantwortlich: string; vertretung: string } {
  const bereich = bereichById(bereichIdOf(answers));
  const lead = bereich.questions[0];
  const entry = lead ? answers.katalog?.[lead.id] : undefined;
  if (!lead || entry?.status !== "bestaetigt") return { verantwortlich: "", vertretung: "" };
  const values = entry.values ?? {};
  return {
    verantwortlich: typeof values.verantwortlich === "string" ? clean(values.verantwortlich) : "",
    vertretung: typeof values.vertretung === "string" ? clean(values.vertretung) : "",
  };
}

/** Markdown for the area chapter. Empty for Belegfluss. */
export function renderBereichChapterMarkdown(answers: IntakeAnswers, number: number): string {
  if (isBelegfluss(answers)) return "";
  const bereich = bereichById(bereichIdOf(answers));
  const state = answers.katalog ?? {};
  const byId = new Map(bereich.questions.map((question) => [question.id, question]));
  const lines: string[] = [];
  lines.push(`# ${number} ${bereich.titel}: Abläufe`, "");
  lines.push(
    `Dieses Kapitel beschreibt den Bereich ${bereich.label}: ${bereich.kurz} Aussagen im Präsens stehen nur dort, wo die Angabe im Intake als heutige Praxis bestätigt ist. Allgemeine Hinweise beschreiben die Rechtslage und bestätigen nicht die betriebliche Umsetzung.`,
    "",
  );
  let sub = 1;
  const lead = bereich.questions[0];
  if (lead) {
    lines.push(`## ${number}.${sub} Verantwortung`, "");
    lines.push(...bereichQuestionLines(lead, state[lead.id]), "");
    sub += 1;
  }
  for (const section of bereich.sections) {
    lines.push(`## ${number}.${sub} ${section.title}`, "");
    if (section.hinweis) lines.push(`*Allgemeiner Hinweis: ${section.hinweis.replaceAll("*", "")}*`, "");
    for (const id of section.questions) {
      const question = byId.get(id);
      if (!question) continue;
      lines.push(...bereichQuestionLines(question, state[id]), "");
    }
    sub += 1;
  }
  if (bereich.aufbewahrung.length) {
    lines.push(`## ${number}.${sub} Aufbewahrung im Bereich`, "");
    lines.push(
      "Allgemeine Hinweise zu den typischen Unterlagen dieses Bereichs. Die Frist richtet sich nach der Unterlagenart; Fristbeginn ist der Schluss des Kalenderjahres. Vor einer Löschung werden Ablaufhemmungen geprüft.",
      "",
    );
    for (const item of bereich.aufbewahrung) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function bereichChapter(
  answers: IntakeAnswers,
  number: number,
): { id: string; title: string; body: string } | null {
  if (isBelegfluss(answers)) return null;
  const bereich = bereichById(bereichIdOf(answers));
  return {
    id: bereichChapterId(bereich.id),
    title: `${number} ${bereich.titel}: Abläufe`,
    body: renderBereichChapterMarkdown(answers, number),
  };
}

/**
 * Renumber shared chapters for an area document. Belegfluss chapters 4–8 are
 * omitted, the area chapter becomes 4 and the shared chapters 9–14 follow as 5–10.
 */
export function renumberHeadings(body: string, map: Map<number, number>): string {
  return body
    .replace(/^(#{1,3}\s+)(\d+)((?:\.\d+)*)(\s)/gm, (match, hashes: string, num: string, rest: string, space: string) => {
      const next = map.get(Number(num));
      return next == null ? match : `${hashes}${next}${rest}${space}`;
    })
    .replace(/\b(Kapitel|Kap\.)\s+(\d+)\b/g, (match, word: string, num: string) => {
      const next = map.get(Number(num));
      return next == null ? match : `${word} ${next}`;
    });
}
