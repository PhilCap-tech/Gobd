/**
 * Gesamtdokument: vier Teile nach GoBD Rz. 153, Kapitel = Modulnummer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { bereichQuestionLines } from "@/lib/bereich-chapter";
import { catalogAnswerLine } from "@/lib/intake-catalog";
import {
  MODULE,
  TEIL_KURZ,
  TEIL_TITEL,
  modulAufbewahrung,
  modulBegriffe,
  modulById,
  modulKontrollen,
  modulProzess,
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
    // Strip handlebars for Gesamt embedding — lived facts come from questions.
    // Keep static paragraphs; drop {{...}} blocks crudely by removing lines with {{.
    const cleaned = raw
      .split("\n")
      .filter((line) => !line.includes("{{") && !line.includes("}}"))
      .join("\n");
    const parts = cleaned.split(/(?=^#{1,3} )/m).filter(Boolean);
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
    lines.push("Dieses Modul ist ein offener Punkt und muss noch beschrieben oder durch bestehende Dokumentation abgedeckt werden.");
  }
  if (status === "extern") {
    lines.push("Der Inhalt dieses Moduls ergibt sich aus der genannten bestehenden Dokumentation. Im Tool sind keine weiteren Prozessfragen beantwortet.");
  }
  return lines;
}

function renderModulChapter(modul: ModulDef, answers: IntakeAnswers): RenderedChapter {
  const eintrag = effectiveModulStatus(answers, modul.id);
  const state: State = answers.katalog ?? {};
  const lines: string[] = [];
  let sub = 1;
  const heading = (title: string) => {
    lines.push(`## ${modul.nr}.${sub} ${title}`, "");
    sub += 1;
  };

  lines.push(`# ${modul.nr} ${modul.titel}`, "");
  lines.push(
    `Dieses Kapitel gehört zu **${TEIL_TITEL[modul.teil]}**. Gegenstand: ${modul.kurz}`,
    "",
  );
  if (modul.inhalt.length) {
    lines.push("Im Einzelnen:", "", ...modul.inhalt.map((item) => `- ${item}`), "");
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

  // Embedded Belegfluss template sections (static text only).
  const embedded = modul.vorlagen
    .map((key) => TEMPLATES.get(key))
    .filter((item): item is string => Boolean(item));
  if (embedded.length) {
    heading("Allgemeine Beschreibung (Vorlage)");
    for (const block of embedded) {
      const { text, nextSub } = renumberTemplate(block, modul.nr, sub);
      sub = nextSub;
      lines.push(text, "");
    }
  }

  const prozess = modulProzess(modul);
  if (prozess.length) {
    heading("Prozessübersicht");
    lines.push(
      "| Nr. | Schritt | Beschreibung |",
      "| --- | --- | --- |",
      ...prozess.map((step, index) => `| ${index + 1} | ${cell(step.schritt)} | ${cell(step.beschreibung)} |`),
      "",
    );
  }

  for (const gruppe of modul.gruppen) {
    const check = answers.module?.check ?? {};
    if (gruppe.teil && check[gruppe.teil] === "nein") continue;
    heading(gruppe.titel);
    for (const question of gruppenFragen(gruppe)) {
      lines.push(...bereichQuestionLines(question, state[question.id]), "");
    }
  }

  // Catalog questions belonging to this module
  if (modul.catalogIds.length) {
    heading("Angaben aus dem Fragenkatalog");
    for (const id of modul.catalogIds) {
      const line = catalogAnswerLine(id, answers);
      if (!line) continue;
      const details = line.details.length ? ` ${line.details.map((bit) => cell(bit)).join(" · ")}` : "";
      const reason = line.reason ? ` Begründung: ${cell(line.reason)}` : "";
      lines.push(`- **${cell(line.prompt)}** — ${line.status}.${details}${reason}`);
    }
    lines.push("");
  }

  const kontrollen = modulKontrollen(modul);
  if (kontrollen.length) {
    heading("Kontrollen");
    lines.push(
      "| Kontrolle | Zweck |",
      "| --- | --- |",
      ...kontrollen.map((item) => `| ${cell(item.name)} | ${cell(item.zweck)} |`),
      "",
    );
  }

  const fristen = modulAufbewahrung(modul);
  if (fristen.length) {
    heading("Aufbewahrung");
    lines.push(
      "| Unterlage | Frist | Grundlage |",
      "| --- | --- | --- |",
      ...fristen.map((item) => `| ${cell(item.unterlage)} | ${cell(item.frist)} | ${cell(item.grundlage)} |`),
      "",
    );
  }

  const begriffe = modulBegriffe(modul);
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
    body: lines.join("\n").trim(),
  };
}

function uebersichtChapter(answers: IntakeAnswers): RenderedChapter {
  const rows = vollstaendigkeitsZeilen(answers);
  const body = [
    "# Vollständigkeitsübersicht",
    "",
    `Ein vorhandener steuerrelevanter Bereich darf nicht stillschweigend fehlen: er ist ${STATUS_LABEL.tool}, ${STATUS_LABEL.extern} oder als „${STATUS_LABEL.offen}“ ausgewiesen. „Nicht vorhanden“ gilt nur für betriebsabhängige Module mit Begründung.`,
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
    "Module mit Status „noch nicht dokumentiert“ oder unvollständig verknüpfter bestehender Dokumentation:",
    "",
    offen.length
      ? [
          "| Nr. | Modul | Status | Angabe |",
          "| --- | --- | --- | --- |",
          ...offen.map((row) => `| ${row.nr} | ${cell(row.titel)} | ${cell(row.label)} | ${cell(row.detail || "—")} |`),
        ].join("\n")
      : "Keine Module mit offenem oder externem Status.",
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
    const prozess = modulProzess(modul);
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
    for (const [term, meaning] of modulBegriffe(modul)) {
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
  return out;
}

export function gesamtDocTitle(): string {
  return "Verfahrensdokumentation (Gesamtdokument)";
}
