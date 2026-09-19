/**
 * Render a sample Verfahrensdokumentation PDF from sample-intake.json.
 * Usage (from repo root): npx tsx scripts/render-sample-delivery-pdf.ts [outfile]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sample from "@/content/delivery-templates/sample-intake.json";
import { generatePdf } from "@/lib/delivery";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

const out =
  process.argv[2] ||
  path.join(process.cwd(), ".data", "sample-verfahrensdokumentation.pdf");

async function main() {
  const answers: IntakeAnswers = { ...emptyAnswers(), ...sample.answers };

  const { buffer, plan, documentId } = await generatePdf({
    answers,
    identity: sample.identity,
    documentId: "sample-delivery-v2",
    version: 1,
  });

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, buffer);

  console.log(
    JSON.stringify(
      {
        out,
        bytes: buffer.length,
        documentId,
        chapters: plan.chapters.map((chapter) => chapter.id),
        openItems: plan.openItems.length,
      },
      null,
      2,
    ),
  );
}

void main();
