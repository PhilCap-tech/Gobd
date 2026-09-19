import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyReadinessPlaceholders,
  brancheLabel,
  firmaPlaceholder,
  formatReadinessDate,
  normalizeReadinessBranche,
  pdfTitleForBranche,
  type ReadinessAnswers,
  type ReadinessBrancheId,
} from "@/lib/readiness";

function readModuleFile(id: ReadinessBrancheId): string {
  switch (id) {
    case "handwerk":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/handwerk.md"),
        "utf8",
      );
    case "handel":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/handel.md"),
        "utf8",
      );
    case "praxis":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/praxis.md"),
        "utf8",
      );
    case "gastronomie":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/gastronomie.md"),
        "utf8",
      );
    case "dienstleistung":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/dienstleistung.md"),
        "utf8",
      );
    case "allgemein":
      return readFileSync(
        path.join(process.cwd(), "content/readiness/allgemein.md"),
        "utf8",
      );
  }
}

export function renderReadinessMarkdown(answers: ReadinessAnswers): {
  title: string;
  markdown: string;
} {
  const branche = normalizeReadinessBranche(answers.branche);
  const title = pdfTitleForBranche(branche);
  let source: string;
  try {
    source = readModuleFile(branche);
  } catch (error) {
    if (branche !== "allgemein") {
      console.warn(
        "[readiness] Modul fehlt, falle auf allgemein zurück",
        branche,
        error,
      );
      source = readModuleFile("allgemein");
    } else {
      throw error;
    }
  }
  const markdown = applyReadinessPlaceholders(source, {
    Branche: brancheLabel(branche),
    Firma: firmaPlaceholder(answers.company, answers.name),
    Datum: formatReadinessDate(),
  });
  return { title, markdown };
}
