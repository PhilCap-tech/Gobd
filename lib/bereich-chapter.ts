import {
  bereichById,
  bereichChapterId,
  bereichIdOf,
  bereichMatrixChapterId,
  isBelegfluss,
  type Bereich,
  type BereichField,
  type BereichQuestion,
} from "@/lib/bereiche";
import type { IntakeAnswers } from "@/lib/types";

type Entry = NonNullable<IntakeAnswers["katalog"]>[string];
type State = NonNullable<IntakeAnswers["katalog"]>;

function clean(value: string): string {
  return value.replaceAll("**", "").replaceAll("→", "->").replace(/\s+/g, " ").trim();
}

/** Value inside a sentence: no trailing period, the sentence adds its own. */
function inline(value: string): string {
  return value.replace(/[.\s]+$/, "");
}

function cell(value: string): string {
  return clean(value).replaceAll("|", "/");
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
export function bereichQuestionLines(
  question: BereichQuestion,
  entry: Entry | undefined,
  options: { skip?: string[]; title?: string } = {},
): string[] {
  const status = entry?.status;
  const head = `**${options.title ?? question.title}:**`;
  if (status === "bestaetigt") {
    const parts = question.fields
      .filter((field) => !options.skip?.includes(field.key))
      .map((field) => {
        const value = inline(shown(field, entry?.values?.[field.key]));
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

function statusLabel(entry: Entry | undefined): string {
  switch (entry?.status) {
    case "bestaetigt":
      return "bestätigt";
    case "geplant":
      return "vorgesehen";
    case "nicht_zutreffend":
      return "entfällt";
    default:
      return "zu klären";
  }
}

/** Confirmed string value of `QID.key`, empty otherwise. */
function confirmedValue(state: State, ref: string | undefined): string {
  if (!ref) return "";
  const [id, key] = ref.split(".");
  const entry = state[id];
  if (entry?.status !== "bestaetigt") return "";
  const value = entry.values?.[key];
  return typeof value === "string" ? clean(value) : "";
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

function rahmen(bereich: Bereich, suffix: string): BereichQuestion | undefined {
  return bereich.questions.find((question) => question.rahmen && question.id.endsWith(suffix));
}

function hinweis(text: string): string {
  return `*Allgemeiner Hinweis: ${text.replaceAll("*", "")}*`;
}

function roleRows(bereich: Bereich, state: State, lead: { verantwortlich: string; vertretung: string }): string[] {
  const rows: Array<[string, string]> = [
    ["Verantwortung für den Bereich", lead.verantwortlich || "zu benennen"],
    ["Vertretung", lead.vertretung || "zu benennen"],
  ];
  const seen = new Set(rows.map(([task]) => task));
  for (const step of bereich.prozess) {
    if (!step.rolle || seen.has(step.schritt)) continue;
    seen.add(step.schritt);
    rows.push([step.schritt, confirmedValue(state, step.rolle) || "zu benennen"]);
  }
  const aenderung = rahmen(bereich, "94");
  if (aenderung) {
    rows.push(["Freigabe von Änderungen", confirmedValue(state, `${aenderung.id}.freigabe`) || "zu benennen"]);
  }
  const archiv = rahmen(bereich, "96");
  if (archiv) {
    rows.push(["Freigabe von Löschungen", confirmedValue(state, `${archiv.id}.loeschung`) || "zu benennen"]);
  }
  return [
    "| Aufgabe | Person oder Rolle |",
    "| --- | --- |",
    ...rows.map(([task, who]) => `| ${cell(task)} | ${cell(who)} |`),
  ];
}

/** Markdown for the area chapter. Empty for Belegfluss. */
export function renderBereichChapterMarkdown(answers: IntakeAnswers, number: number): string {
  if (isBelegfluss(answers)) return "";
  const bereich = bereichById(bereichIdOf(answers));
  const state: State = answers.katalog ?? {};
  const byId = new Map(bereich.questions.map((question) => [question.id, question]));
  const lead = bereichVerantwortung(answers);
  const ablage = number + 1;
  const iks = number + 3;
  const versionspflege = number + 4;
  const offen = number + 6;
  const lines: string[] = [];
  let sub = 1;
  const heading = (title: string) => {
    lines.push(`## ${number}.${sub} ${title}`, "");
    sub += 1;
  };
  const question = (q: BereichQuestion | undefined, options?: { skip?: string[]; title?: string }) => {
    if (q) lines.push(...bereichQuestionLines(q, state[q.id], options), "");
  };

  lines.push(`# ${number} ${bereich.titel}: Abläufe`, "");
  lines.push(
    `Dieses Kapitel beschreibt den Bereich ${bereich.label}: ${bereich.kurz} Aussagen im Präsens stehen nur dort, wo die Angabe im Intake als heutige Praxis bestätigt ist. Vorgesehene oder ungeklärte Angaben sind als solche gekennzeichnet und stehen zusätzlich in Kapitel ${offen}. Allgemeine Hinweise beschreiben die Rechtslage und bestätigen nicht die betriebliche Umsetzung.`,
    "",
  );

  heading("Umfang und Abgrenzung");
  if (bereich.abgrenzung) lines.push(hinweis(bereich.abgrenzung), "");
  question(rahmen(bereich, "90"));

  heading("Verantwortung und Rollen");
  question(bereich.questions[0]);
  lines.push(
    "Die folgende Übersicht nennt die Personen oder Rollen je Prozessschritt. „zu benennen“ bedeutet, dass die Angabe im Intake nicht als heutige Praxis bestätigt ist.",
    "",
    ...roleRows(bereich, state, lead),
    "",
  );

  heading("Systeme und Schnittstellen");
  lines.push(
    hinweis(
      "Für jedes DV-System, in dem steuerrelevante Daten entstehen oder verarbeitet werden, ist eine übersichtlich gegliederte Verfahrensdokumentation vorzuhalten (GoBD Rz. 151). Schnittstellen werden mit Richtung, Format und Turnus beschrieben, damit der Weg der Daten vom Entstehen bis zur Buchung nachvollziehbar bleibt.",
    ),
    "",
  );
  question(rahmen(bereich, "91"));

  if (bereich.prozess.length) {
    heading("Prozessübersicht");
    lines.push(
      "Gliederung des Bereichs in Prozessschritte. Ob ein Schritt so gelebt wird, ergibt sich aus den folgenden Abschnitten und aus Anhang A.",
      "",
      "| Nr. | Schritt | Beschreibung |",
      "| --- | --- | --- |",
      ...bereich.prozess.map((step, index) => `| ${index + 1} | ${cell(step.schritt)} | ${cell(step.beschreibung)} |`),
      "",
    );
  }

  for (const section of bereich.sections) {
    heading(section.title);
    if (section.hinweis) lines.push(hinweis(section.hinweis), "");
    for (const id of section.questions) question(byId.get(id));
  }

  const kontrollFrage = rahmen(bereich, "92");
  heading("Kontrollen im Bereich");
  lines.push(
    hinweis(
      `Das interne Kontrollsystem soll Vollständigkeit, Richtigkeit und Zeitgerechtheit der Aufzeichnungen sichern. Die Tabelle nennt typische Kontrollen dieses Bereichs. Als durchgeführt gilt eine Kontrolle nur, wenn sie im Intake als heutige Praxis bestätigt ist. Das übergreifende Kontrollsystem beschreibt Kapitel ${iks}.`,
    ),
    "",
  );
  if (bereich.kontrollen.length) {
    const entry = kontrollFrage ? state[kontrollFrage.id] : undefined;
    const raw = entry?.values?.kontrollen;
    const chosen = new Set(Array.isArray(raw) ? raw.map((item) => String(item)) : []);
    const stand = (name: string) => {
      if (!chosen.has(name)) return "nicht bestätigt";
      if (entry?.status === "bestaetigt") return "durchgeführt";
      if (entry?.status === "geplant") return "vorgesehen";
      return "zu klären";
    };
    lines.push(
      "| Kontrolle | Zweck | Stand im Intake |",
      "| --- | --- | --- |",
      ...bereich.kontrollen.map((item) => `| ${cell(item.name)} | ${cell(item.zweck)} | ${stand(item.name)} |`),
      "",
    );
  }
  question(kontrollFrage, { skip: ["kontrollen"], title: "Turnus, Person und Nachweis" });

  heading("Datenzugriff der Finanzverwaltung");
  lines.push(
    hinweis(
      "Bei einer Außenprüfung kann die Finanzverwaltung Einsicht in die gespeicherten Daten nehmen und das System dazu nutzen (Z1, unmittelbarer Zugriff), die Daten nach ihren Vorgaben maschinell auswerten lassen (Z2, mittelbarer Zugriff) oder die Überlassung der Daten in einem maschinell auswertbaren Format verlangen (Z3, Datenträgerüberlassung) (§ 147 Abs. 6 AO). Die Daten müssen während der Aufbewahrungsfrist verfügbar, unverzüglich lesbar und maschinell auswertbar sein.",
    ),
    "",
  );
  question(rahmen(bereich, "93"));

  heading("Änderungsmanagement");
  lines.push(
    hinweis(
      `Änderungen an Systemen, Einstellungen, Schnittstellen und Stammdaten können die Ordnungsmäßigkeit berühren. Sie werden vor dem Einsatz freigegeben und mit Datum dokumentiert. Wesentliche Änderungen lösen eine neue Fassung dieser Verfahrensdokumentation aus (Kapitel ${versionspflege}).`,
    ),
    "",
  );
  question(rahmen(bereich, "94"));

  heading("Ausfall und Notbetrieb");
  lines.push(
    hinweis(
      "Auch während eines Systemausfalls sind Geschäftsvorfälle vollständig und nachvollziehbar festzuhalten. Ersatzaufzeichnungen werden aufbewahrt und nach dem Wiederanlauf nacherfasst oder zugeordnet.",
    ),
    "",
  );
  question(rahmen(bereich, "95"));

  heading("Aufbewahrung und Archiv");
  lines.push(
    `Allgemeine Hinweise zu den typischen Unterlagen dieses Bereichs. Die Frist richtet sich nach der Unterlagenart und beginnt mit dem Schluss des Kalenderjahres, in dem die Unterlage entstanden ist (§ 147 Abs. 4 AO). Vor einer Löschung werden Ablaufhemmungen geprüft (§ 147 Abs. 3 AO). Übergreifende Regeln zu Ablage, Fristen und Löschung stehen in Kapitel ${ablage}.`,
    "",
    "| Unterlage | Frist | Grundlage |",
    "| --- | --- | --- |",
    ...bereich.aufbewahrung.map((item) => `| ${cell(item.unterlage)} | ${cell(item.frist)} | ${cell(item.grundlage)} |`),
    "",
  );
  question(rahmen(bereich, "96"));

  if (bereich.begriffe.length) {
    heading("Begriffe im Bereich");
    lines.push(
      "| Begriff | Bedeutung |",
      "| --- | --- |",
      ...bereich.begriffe.map(([term, meaning]) => `| ${cell(term)} | ${cell(meaning)} |`),
      "",
    );
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

/** Anhang A for an area document: process matrix with confirmed responsibilities. */
export function bereichMatrixChapter(answers: IntakeAnswers): { id: string; title: string; body: string } | null {
  if (isBelegfluss(answers)) return null;
  const bereich = bereichById(bereichIdOf(answers));
  if (!bereich.prozess.length) return null;
  const state: State = answers.katalog ?? {};
  const lead = bereichVerantwortung(answers);
  const title = `Anhang A — Prozessmatrix ${bereich.label}`;
  const rows = bereich.prozess.map((step, index) => {
    const who = confirmedValue(state, step.rolle) || (lead.verantwortlich ? `${lead.verantwortlich} (Bereichsverantwortung)` : "zu benennen");
    return `| ${index + 1} | ${cell(step.schritt)} | ${cell(who)} | ${cell(step.nachweis)} | ${statusLabel(state[step.frage])} |`;
  });
  const body = [
    `# ${title}`,
    "",
    "Die Matrix ordnet jedem Prozessschritt die verantwortliche Person oder Rolle und den erwarteten Nachweis zu. „Stand“ zeigt, ob die zugehörige Angabe im Intake als heutige Praxis bestätigt ist. Ohne bestätigte Einzelangabe steht die Bereichsverantwortung.",
    "",
    "| Nr. | Schritt | Verantwortlich | Nachweis | Stand im Intake |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  return { id: bereichMatrixChapterId(bereich.id), title, body };
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
