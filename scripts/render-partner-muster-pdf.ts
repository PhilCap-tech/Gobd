/**
 * Regenerate the partner Muster PDF from the fixed fixture.
 * Same call as GET /steuerberater/muster/pdf (generatePdf).
 * Usage: npx tsx scripts/render-partner-muster-pdf.ts [outfile]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatePdf } from "@/lib/delivery";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

const out =
  process.argv[2] ||
  path.join(process.cwd(), ".data", "muster-verfahrensdokumentation.pdf");

async function main() {
  const { buffer, plan, documentId } = await generatePdf({
    answers: PARTNER_MUSTER_ANSWERS,
    identity: PARTNER_MUSTER_IDENTITY,
    documentId: PARTNER_MUSTER_DOCUMENT_ID,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
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
        openItems: plan.openItems.map((item) => ({
          id: item.id,
          severity: item.severity,
          title: item.title,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
