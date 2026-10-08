/**
 * Gesamtdokument: vier Teile nach GoBD Rz. 153, Kapitel = Modulnummer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { bereichQuestionLines } from "@/lib/bereich-chapter";
import { isKeineKontrolleValues } from "@/lib/keine-angaben";
import { catalogAnswerLine } from "@/lib/intake-catalog";
import {
  collapseRepeatedTokens,
  betriebFacts,
  hiddenQuestion,
  livedAufbewahrung,
  livedBegriffe,
  ausnahmenInDetails,
  kontrollenAbschnitt,
  kontrolleSichtbar,
  livedProzess,
  moduleHasLivedAnswers,
  redactDenied,
  rewriteChapterRefs,
  staticModulText,
  stripFalseFallbacks,
  modulNrPresent,
  type BetriebFacts,
} from "@/lib/module/aussagen";
import {
  MODULE,
  TEIL_KURZ,
  TEIL_TITEL,
  modulById,
  gruppenFragen,
} from "@/lib/module/katalog";
import type { ModulDef } from "@/lib/module/typen";
import {
  STATUS_LABEL,
  activeModules,
  effectiveModulStatus,
  isGesamt,
  vollstaendigkeitsZeilen,
} from "@/lib/module/status";
import type { ModulStatus } from "@/lib/module/typen";
import type { IntakeAnswers } from "@/lib/types";
import type { RenderedChapter } from "@/lib/delivery-templates";

type State = NonNullable<IntakeAnswers["katalog"]>;

function cell(value: string): string {
  return value.replace(/\s+/g, " ").trim().replaceAll("|", "/");
}

function hinweis(text: string): string {
  return `*Allgemeiner Hinweis: ${text.replaceAll("*", "")}*`;
}

/** Load Belegfluss chapter markdown and index "## n.m" / "# n" sections by key "n.m" or "n.0". */
function templateSections(): Map<string, string> {
  const dir = path.join(process.cwd(), "content", "delivery-templates", "chapters");
  const map = new Map<string, string>();
  const files = [
    "01-zweck-geltung.md",
    "02-unternehmen-rollen.md",
    "03-systeme-datenfluss.md",
    "04-belegarten-kanaele.md",
    "05-eingang-erechnung.md",
    "06-papier-digitalisierung.md",
    "07-ausgangsrechnungen.md",
    "08-freigabe-buchung-status.md",
    "09-ablage-aufbewahrung.md",
    "10-berechtigungen-sicherung.md",
    "11-iks.md",
    "12-versionspflege.md",
  ];
  for (const file of files) {
    let raw = "";
    try {
      raw = readFileSync(path.join(dir, file), "utf8");
    } catch {
      continue;
    }
    // Roh behalten. Platzhalter werden beim Einbetten gerendert, nicht zeilenweise verworfen.
    const parts = raw.split(/(?=^#{1,3} )/m).filter(Boolean);
    for (const part of parts) {
      const match = part.match(/^#{1,3}\s+(\d+)(?:\.(\d+))?/);
      if (!match) continue;
      const major = match[1];
      const minor = match[2] ?? "0";
      const key = `${major}.${minor}`;
      // Prefer first occurrence (some E-Rechnung variants share 5.2).
      if (!map.has(key)) map.set(key, part.trim());
      if (minor === "0" && !map.has(`${major}.0`)) map.set(`${major}.0`, part.trim());
    }
  }
  return map;
}

const TEMPLATES = templateSections();

function vorlageLookup(path: string, answers: IntakeAnswers): unknown {
  const parts = path.split(".").filter(Boolean);
  if (parts[0] !== "answers" || !parts[1]) return undefined;
  return (answers as Record<string, unknown>)[parts[1]];
}

function vorlageFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item ?? "").trim());
  return Boolean(value != null && String(value).trim());
}

function vorlageCondition(expr: string, answers: IntakeAnswers, facts: BetriebFacts): boolean {
  const contains = expr.match(/^(.+?)\s+contains\s+["']([^"']+)["']$/);
  if (contains) {
    const value = vorlageLookup(contains[1].trim(), answers);
    const blob = Array.isArray(value) ? value.map((item) => String(item)).join(" ") : String(value ?? "");
    return blob.includes(contains[2]);
  }
  const path = expr.trim();
  if (path === "answers.backup") return facts.backup;
  if (path === "answers.kontrollen") return facts.kontrollen;
  return vorlageFilled(vorlageLookup(path, answers));
}

function vorlageBlockEnd(input: string, from: number): { bodyEnd: number; tagEnd: number } {
  let depth = 1;
  let index = from;
  while (index < input.length) {
    const nextOpen = input.indexOf("{{#", index);
    const nextClose = input.indexOf("{{/", index);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      const closeBrace = input.indexOf("}}", nextOpen);
      index = closeBrace === -1 ? input.length : closeBrace + 2;
      continue;
    }
    depth -= 1;
    const closeBrace = input.indexOf("}}", nextClose);
    const tagEnd = closeBrace === -1 ? input.length : closeBrace + 2;
    if (depth === 0) return { bodyEnd: nextClose, tagEnd };
    index = tagEnd;
  }
  return { bodyEnd: input.length, tagEnd: input.length };
}

function vorlageFilters(value: unknown, filters: string[]): string {
  let current: unknown = value;
  for (const filter of filters) {
    const or = filter.match(/^or\s+["']([\s\S]*)["']$/);
    if (or) {
      if (!vorlageFilled(current)) current = or[1];
      continue;
    }
    const join = filter.match(/^join\s+["']([\s\S]*)["']$/);
    if (join) {
      current = Array.isArray(current)
        ? current.map((item) => String(item).trim()).filter(Boolean).join(join[1])
        : (current ?? "");
    }
  }
  if (Array.isArray(current)) return current.map((item) => String(item).trim()).filter(Boolean).join(", ");
  return current == null ? "" : String(current);
}

function renderVorlageValues(template: string, answers: IntakeAnswers): string {
  return template.replace(/\{\{\s*([^}#/][^}]*?)\s*\}\}/g, (_, expr: string) => {
    const pieces = expr.split("|").map((part) => part.trim());
    const path = pieces[0] ?? "";
    return vorlageFilters(vorlageLookup(path, answers), pieces.slice(1));
  });
}

function renderVorlageBlocks(template: string, answers: IntakeAnswers, facts: BetriebFacts): string {
  let output = "";
  let index = 0;
  while (index < template.length) {
    const open = template.indexOf("{{#", index);
    if (open === -1) {
      output += template.slice(index);
      break;
    }
    output += template.slice(index, open);
    const tagEnd = template.indexOf("}}", open);
    if (tagEnd === -1) {
      output += template.slice(open);
      break;
    }
    const tag = template.slice(open + 3, tagEnd).trim();
    const unless = tag.startsWith("unless");
    const expr = tag.replace(/^(if|unless)\s+/, "");
    const block = vorlageBlockEnd(template, tagEnd + 2);
    const include = unless
      ? !vorlageCondition(expr, answers, facts)
      : vorlageCondition(expr, answers, facts);
    if (include) output += renderVorlageBlocks(template.slice(tagEnd + 2, block.bodyEnd), answers, facts);
    index = block.tagEnd;
  }
  return output;
}

/**
 * Belegfluss-Vorlage für ein Modul ohne eigene Angaben.
 * Bedingungen werden ausgewertet, Platzhalter ersetzt.
 * „Kap. 14“ der Belegfluss-Vorlage ist dort der offene-Punkte-Teil, im Gesamtdokument Anhang A.
 */
function prepareVorlage(raw: string, answers: IntakeAnswers, facts: BetriebFacts): string {
  const referred = raw.replace(/Kap(?:itel)?\.?\s*14\b/gi, "Anhang A");
  let rendered = renderVorlageValues(renderVorlageBlocks(referred, answers, facts), answers).trim();
  rendered = rendered
    .split("\n")
    .filter((line) => {
      if (facts.kontrollen && /nur bestätigte Kontrollen aus Intake/.test(line)) return false;
      // Sicherung ist woanders beschrieben, das Vorlagenfeld answers.backup aber leer.
      if (/erfolgt laut Intake über:\s*\.?\s*$/.test(line.trim())) return false;
      return true;
    })
    .join("\n");
  return stripFalseFallbacks(rendered, facts);
}

function renumberTemplate(body: string, modulNr: number, subStart: number): { text: string; nextSub: number } {
  let sub = subStart;
  const text = body.replace(/^#{1,3}\s+\d+(?:\.\d+)*\s+/gm, (heading) => {
    const hashes = heading.match(/^#+/)?.[0] ?? "##";
    const title = heading.replace(/^#{1,3}\s+\d+(?:\.\d+)*\s+/, "").trim();
    const out = `${hashes} ${modulNr}.${sub} ${title}\n`;
    sub += 1;
    return out;
  });
  return { text: text.trim(), nextSub: sub };
}

function statusBlock(status: ModulStatus, detail: string): string[] {
  const lines = [`**Dokumentationsstatus:** ${STATUS_LABEL[status]}.`];
  if (detail) lines.push(detail);
  if (status === "offen") {
    lines.push(
      `Dieses Modul hat den Status „${STATUS_LABEL.offen}“ und bleibt ein offener Punkt, bis es beschrieben, durch bestehende Dokumentation abgedeckt oder als „nicht vorhanden“ gesetzt wird.`,
    );
  }
  if (status === "extern") {
    lines.push("Der Inhalt dieses Moduls ergibt sich aus der genannten bestehenden Dokumentation. Im Tool sind keine weiteren Prozessfragen beantwortet.");
  }
  return lines;
}

function renderModulChapter(modul: ModulDef, answers: IntakeAnswers): RenderedChapter {
  const eintrag = effectiveModulStatus(answers, modul.id);
  const state: State = answers.katalog ?? {};
  const facts = betriebFacts(answers);
  const wording = staticModulText(modul, facts);
  const lines: string[] = [];
  let sub = 1;
  const heading = (title: string) => {
    lines.push(`## ${modul.nr}.${sub} ${title}`, "");
    sub += 1;
  };

  lines.push(`# ${modul.nr} ${modul.titel}`, "");
  lines.push(
    `Dieses Kapitel gehört zu **${TEIL_TITEL[modul.teil]}**. Gegenstand: ${wording.kurz}`,
    "",
  );
  if (wording.inhalt.length) {
    lines.push("Im Einzelnen:", "", ...wording.inhalt.map((item) => `- ${item}`), "");
  }
  if (modul.id === "m09" && facts.kanzleiDenied) {
    lines.push(`Buchhaltung und Steuererklärungen liegen bei ${facts.rolle}.`, "");
  }

  heading("Dokumentationsstatus");
  const detail =
    eintrag.status === "extern"
      ? [eintrag.ref && `Bestehende Dokumentation: ${eintrag.ref}`, eintrag.link && `Ablage/Link: ${eintrag.link}`]
          .filter(Boolean)
          .join(" ")
      : eintrag.status === "nicht_vorhanden"
        ? `Begründung: ${eintrag.reason ?? "—"}`
        : "";
  lines.push(...statusBlock(eintrag.status, detail), "");

  if (eintrag.status !== "tool") {
    return {
      id: `modul-${modul.id}`,
      title: `${modul.nr} ${modul.titel}`,
      body: lines.join("\n").trim(),
    };
  }

  if (modul.hinweis) {
    heading("Fachlicher Rahmen");
    lines.push(hinweis(modul.hinweis), "");
  }

  // Belegfluss-Vorlagen nur ohne eigene Angaben. Fallback-Sätze nur, wenn die Angabe fehlt.
  const embedded = moduleHasLivedAnswers(modul, answers)
    ? []
    : modul.vorlagen
        .map((key) => TEMPLATES.get(key))
        .filter((item): item is string => Boolean(item))
        .map((block) => prepareVorlage(block, answers, facts))
        .filter(Boolean);
  if (embedded.length) {
    heading("Ergänzende Beschreibung");
    for (const block of embedded) {
      const { text, nextSub } = renumberTemplate(block, modul.nr, sub);
      sub = nextSub;
      if (text) lines.push(text, "");
    }
  }

  const prozess = livedProzess(modul, answers);
  if (prozess.length) {
    heading("Prozessübersicht");
    lines.push(
      "| Nr. | Schritt | Beschreibung |",
      "| --- | --- | --- |",
      ...prozess.map((step, index) => `| ${index + 1} | ${cell(step.schritt)} | ${cell(step.beschreibung)} |`),
      "",
    );
  }

  const kontrollen = kontrollenAbschnitt(modul, answers);

  for (const gruppe of modul.gruppen) {
    const check = answers.module?.check ?? {};
    if (gruppe.teil && check[gruppe.teil] === "nein") continue;
    heading(gruppe.titel);
    for (const question of gruppenFragen(gruppe)) {
      if (hiddenQuestion(question.id, facts)) continue;
      const kontrollStatus = state[question.id]?.status;
      if (
        /92$/.test(question.id) &&
        kontrollStatus !== "bestaetigt" &&
        kontrollStatus !== "nicht_zutreffend" &&
        kontrollen.zeilen.length
      ) {
        lines.push(
          `**${question.title}:** Für diesen Teil sind noch keine Kontrollen bestätigt. Siehe offene Punkte.`,
          "",
        );
        continue;
      }
      let shown = state[question.id];
      const namen = shown?.values?.kontrollen;
      if (
        /92$/.test(question.id) &&
        shown?.status === "bestaetigt" &&
        Array.isArray(namen) &&
        !isKeineKontrolleValues(shown.values)
      ) {
        shown = {
          ...shown,
          values: {
            ...shown.values,
            kontrollen: namen.filter((item) => typeof item === "string" && kontrolleSichtbar(item, answers)),
          },
        };
      }
      lines.push(...bereichQuestionLines(question, shown), "");
    }
  }

  // Catalog questions belonging to this module
  if (modul.catalogIds.length) {
    heading("Angaben aus dem Fragenkatalog");
    for (const id of modul.catalogIds) {
      if (hiddenQuestion(id, facts)) {
        if (id === "F05") {
          lines.push(`- **Externe Steuerberatung** — keine. Buchhaltung und Steuererklärungen: ${facts.rolle}.`);
        }
        continue;
      }
      const line = catalogAnswerLine(id, answers);
      if (!line) continue;
      const shown = ausnahmenInDetails(id, answers, line.details);
      const details = shown.length ? ` ${shown.map((bit) => cell(bit)).join(" · ")}` : "";
      const reason = line.reason ? ` Begründung: ${cell(line.reason)}` : "";
      lines.push(collapseRepeatedTokens(`- **${cell(line.prompt)}** — ${line.status}.${details}${reason}`));
    }
    lines.push("");
  }

  if (kontrollen.zeilen.length || kontrollen.satz) {
    heading("Kontrollen");
    if (kontrollen.satz) lines.push(kontrollen.satz, "");
    if (kontrollen.zeilen.length) {
      lines.push(
        "| Kontrolle | Zweck |",
        "| --- | --- |",
        ...kontrollen.zeilen.map((item) => `| ${cell(item.name)} | ${cell(item.zweck)} |`),
        "",
      );
    }
  }

  const fristen = livedAufbewahrung(modul, answers);
  if (fristen.length) {
    heading("Aufbewahrung");
    lines.push(
      "| Unterlage | Frist | Grundlage |",
      "| --- | --- | --- |",
      ...fristen.map((item) => `| ${cell(item.unterlage)} | ${cell(item.frist)} | ${cell(item.grundlage)} |`),
      "",
    );
  }

  const begriffe = livedBegriffe(modul, answers);
  if (begriffe.length) {
    heading("Begriffe");
    lines.push(
      "| Begriff | Bedeutung |",
      "| --- | --- |",
      ...begriffe.map(([term, meaning]) => `| ${cell(term)} | ${cell(meaning)} |`),
      "",
    );
  }

  return {
    id: `modul-${modul.id}`,
    title: `${modul.nr} ${modul.titel}`,
    body: redactDenied(lines.join("\n"), facts),
  };
}

function uebersichtChapter(answers: IntakeAnswers): RenderedChapter {
  const rows = vollstaendigkeitsZeilen(answers);
  const body = [
    "# Vollständigkeitsübersicht",
    "",
    `Ein vorhandener steuerrelevanter Bereich darf nicht stillschweigend fehlen: er hat den Status „${STATUS_LABEL.tool}“, ist ${STATUS_LABEL.extern} oder hat den Status „${STATUS_LABEL.offen}“. „Nicht vorhanden“ gilt nur für betriebsabhängige Module mit Begründung.`,
    "",
    "| Nr. | Modul | Status | Angabe |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.nr} | ${cell(row.titel)} | ${cell(row.label)} | ${cell(row.detail || "—")} |`,
    ),
    "",
    "## Aufbau dieses Dokuments",
    "",
    ...([1, 2, 3, 4] as const).map(
      (teil) => `- **${TEIL_TITEL[teil]}** — ${TEIL_KURZ[teil]}`,
    ),
  ].join("\n");
  return { id: "vollstaendigkeit", title: "Vollständigkeitsübersicht", body };
}

function teilIntro(teil: 1 | 2 | 3 | 4): RenderedChapter {
  const body = [`# ${TEIL_TITEL[teil]}`, "", TEIL_KURZ[teil]].join("\n");
  return { id: `teil-${teil}`, title: TEIL_TITEL[teil], body };
}

function anhangOffenePunkte(answers: IntakeAnswers, openPointsTable: string): RenderedChapter {
  const offen = vollstaendigkeitsZeilen(answers).filter((row) => row.status === "offen" || row.status === "extern");
  const body = [
    "# Anhang A — Offene Punkte und bestehende Dokumentationen",
    "",
    `Module mit Status „${STATUS_LABEL.offen}“ oder unvollständig verknüpfter bestehender Dokumentation:`,
    "",
    offen.length
      ? [
          "| Nr. | Modul | Status | Angabe |",
          "| --- | --- | --- | --- |",
          ...offen.map((row) => `| ${row.nr} | ${cell(row.titel)} | ${cell(row.label)} | ${cell(row.detail || "—")} |`),
        ].join("\n")
      : `Keine Module mit Status „${STATUS_LABEL.offen}“ und keine unvollständig verknüpfte bestehende Dokumentation.`,
    "",
    "## Offene Punkte aus dem Fragebogen",
    "",
    openPointsTable,
  ].join("\n");
  return { id: "anhang-a", title: "Anhang A — Offene Punkte", body };
}

function anhangProzessmatrix(answers: IntakeAnswers): RenderedChapter {
  const lines = [
    "# Anhang C — Prozessmatrix",
    "",
    `Überblick der Prozessschritte aller Module mit Status „${STATUS_LABEL.tool}“.`,
    "",
  ];
  for (const modul of activeModules(answers)) {
    if (effectiveModulStatus(answers, modul.id).status !== "tool") continue;
    const prozess = livedProzess(modul, answers);
    if (!prozess.length) continue;
    lines.push(`## Modul ${modul.nr} ${modul.titel}`, "");
    lines.push(
      "| Nr. | Schritt | Nachweis |",
      "| --- | --- | --- |",
      ...prozess.map((step, index) => `| ${index + 1} | ${cell(step.schritt)} | ${cell(step.nachweis)} |`),
      "",
    );
  }
  return { id: "anhang-c", title: "Anhang C — Prozessmatrix", body: lines.join("\n").trim() };
}

function anhangBegriffe(answers: IntakeAnswers): RenderedChapter {
  const seen = new Set<string>();
  const rows: Array<[string, string]> = [];
  for (const modul of activeModules(answers)) {
    for (const [term, meaning] of livedBegriffe(modul, answers)) {
      if (seen.has(term)) continue;
      seen.add(term);
      rows.push([term, meaning]);
    }
  }
  const body = [
    "# Anhang D — Begriffserläuterungen",
    "",
    "| Begriff | Bedeutung |",
    "| --- | --- |",
    ...rows.map(([term, meaning]) => `| ${cell(term)} | ${cell(meaning)} |`),
  ].join("\n");
  return { id: "anhang-d", title: "Anhang D — Begriffe", body };
}

/**
 * Chapters of the Gesamtdokument. Caller supplies the already-rendered open-points table.
 * Optional `onlyModul` exports a single module chapter (plus overview).
 */
export function renderGesamtChapters(
  answers: IntakeAnswers,
  openPointsTable: string,
  options: { onlyModul?: string } = {},
): RenderedChapter[] {
  if (!isGesamt(answers)) return [];
  if (options.onlyModul) {
    const modul = modulById(options.onlyModul);
    if (!modul) return [];
    return [uebersichtChapter(answers), renderModulChapter(modul, answers)];
  }

  const out: RenderedChapter[] = [uebersichtChapter(answers)];
  let lastTeil: 1 | 2 | 3 | 4 | null = null;
  for (const modul of MODULE) {
    const status = effectiveModulStatus(answers, modul.id).status;
    if (status === "nicht_vorhanden") continue;
    if (lastTeil !== modul.teil) {
      out.push(teilIntro(modul.teil));
      lastTeil = modul.teil;
    }
    out.push(renderModulChapter(modul, answers));
  }
  out.push(anhangOffenePunkte(answers, openPointsTable));
  out.push({
    id: "anhang-b",
    title: "Anhang B — Mitgeltende Unterlagen",
    body: [
      "# Anhang B — Mitgeltende Unterlagen und bestehende Dokumentationen",
      "",
      "Verweise auf bestehende Dokumentationen (Status „durch bestehende Dokumentation abgedeckt“) und sonstige Anlagen aus dem Intake:",
      "",
      ...vollstaendigkeitsZeilen(answers)
        .filter((row) => row.status === "extern")
        .map((row) => `- Modul ${row.nr} ${row.titel}: ${row.detail || "—"}`),
      "",
      answers.katalog?.I02?.status === "bestaetigt"
        ? "Weitere Anlagen siehe Frage I02 im Modul 24."
        : "Die Liste mitgeltender Unterlagen ist im Intake zu bestätigen (Modul 24).",
    ].join("\n"),
  });
  out.push(anhangProzessmatrix(answers));
  out.push(anhangBegriffe(answers));
  const present = modulNrPresent(answers);
  const facts = betriebFacts(answers);
  return out.map((chapter) => ({
    ...chapter,
    body:
      chapter.id === "vollstaendigkeit"
        ? rewriteChapterRefs(chapter.body, present)
        : redactDenied(rewriteChapterRefs(chapter.body, present), facts),
  }));
}

export function gesamtDocTitle(): string {
  return "Verfahrensdokumentation (Gesamtdokument)";
}
