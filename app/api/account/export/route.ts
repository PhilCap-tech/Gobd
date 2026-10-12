import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  loadDocumentPdf,
  pdfDownloadName,
  readCustomerUpload,
  resolveIntakePayload,
} from "@/lib/blob";
import { formatBerlinDate } from "@/lib/kuendigung";
import { subscriptionDownloadDenial } from "@/lib/kuendigung-access";
import { buildStoredZip, collectUploadLocators, zipEntryName } from "@/lib/kuendigung-zip";
import { listDocumentsByEmail } from "@/lib/store";
import type { SheetRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 40_000_000;

function inhaltLine(row: SheetRow): string {
  const from = row.validFrom || "—";
  return [
    row.company || "Ohne Firma",
    `Version ${row.version || "1"}`,
    `Gültig von ${from}`,
    row.documentId,
  ].join("\t");
}

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json(
      { error: "Bitte melden Sie sich an." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const closed = await subscriptionDownloadDenial(email);
  if (closed) {
    return NextResponse.json({ error: closed }, { status: 403 });
  }

  const documents = (await listDocumentsByEmail(email)).filter((row) => row.documentId);
  const entries: { name: string; data: Buffer }[] = [];
  const lines = ["Firma\tVersion\tGültig von\tDokument-ID"];
  let total = 0;
  const seenUploads = new Set<string>();

  for (const row of documents) {
    if (row.pdfUrl) {
      try {
        const pdf = await loadDocumentPdf(row);
        total += pdf.length;
        if (total > MAX_BYTES) {
          return NextResponse.json(
            {
              error:
                "Das Archiv ist zu groß für einen Download. Laden Sie die PDF-Versionen einzeln herunter.",
            },
            { status: 413 },
          );
        }
        const name = zipEntryName(`pdf/${row.documentId}-${pdfDownloadName(row)}`);
        entries.push({ name, data: pdf });
        lines.push(inhaltLine(row));
      } catch (error) {
        console.error("[kuendigung] PDF fehlt im ZIP", row.documentId, error);
        lines.push(`${inhaltLine(row)}\tPDF nicht lesbar`);
      }
    }
    try {
      const raw = await resolveIntakePayload(row.fragen);
      const parsed = raw.trim().startsWith("{") || raw.trim().startsWith("[")
        ? (JSON.parse(raw) as unknown)
        : null;
      const locators = new Set<string>();
      collectUploadLocators(parsed, locators);
      for (const locator of locators) {
        if (seenUploads.has(locator)) continue;
        seenUploads.add(locator);
        const file = await readCustomerUpload(locator);
        if (!file) continue;
        total += file.buffer.length;
        if (total > MAX_BYTES) {
          return NextResponse.json(
            {
              error:
                "Das Archiv ist zu groß für einen Download. Laden Sie die PDF-Versionen einzeln herunter.",
            },
            { status: 413 },
          );
        }
        entries.push({
          name: zipEntryName(`uploads/${file.filename}`),
          data: file.buffer,
        });
        lines.push(`Upload\t${file.filename}\t\t${row.documentId}`);
      }
    } catch (error) {
      console.error("[kuendigung] Upload nicht gelesen", row.documentId, error);
    }
  }

  if (entries.length === 0) {
    lines.push("Es liegen noch keine PDF-Versionen vor.");
  }

  lines.push("");
  lines.push("Die Aufbewahrung dieser Unterlagen bleibt Ihre Pflicht.");
  const manifest = Buffer.from(`${lines.join("\n")}\n`, "utf8");
  const zip = buildStoredZip([
    ...entries,
    { name: "inhalt.txt", data: manifest },
  ]);
  const stamp = formatBerlinDate(new Date().toISOString()).replaceAll(".", "-") || "export";
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dokumente-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
