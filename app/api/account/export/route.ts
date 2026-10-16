import { getSessionEmail } from "@/lib/auth";
import {
  loadDocumentPdf,
  pdfDownloadName,
  readCustomerUpload,
  resolveIntakePayload,
} from "@/lib/blob";
import { formatBerlinDate } from "@/lib/kuendigung";
import { subscriptionDownloadDenial } from "@/lib/kuendigung-access";
import {
  collectUploadLocators,
  documentsForOwnerZip,
  zipCentralDirectory,
  zipEntryName,
  zipEntryParts,
  type ZipEntry,
  type ZipPartMeta,
} from "@/lib/kuendigung-zip";
import { listDocumentsByEmail } from "@/lib/store";
import { isTestEntity } from "@/lib/test-entities";
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

function jsonError(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return jsonError("Bitte melden Sie sich an.", 401);
  }
  const closed = await subscriptionDownloadDenial(email);
  if (closed) {
    return jsonError(closed, 403);
  }

  const documents = documentsForOwnerZip(
    email,
    (await listDocumentsByEmail(email)).filter((row) => row.documentId),
    "owner",
  );
  const stamp = formatBerlinDate(new Date().toISOString()).replaceAll(".", "-") || "export";
  const at = new Date();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const metas: ZipPartMeta[] = [];
      const lines = ["Firma\tVersion\tGültig von\tDokument-ID"];
      let total = 0;
      let offset = 0;
      const seenUploads = new Set<string>();
      let wrotePdf = false;

      const push = (entry: ZipEntry) => {
        const part = zipEntryParts(entry, at);
        controller.enqueue(new Uint8Array(part.local));
        controller.enqueue(new Uint8Array(part.data));
        metas.push({ name: part.name, crc: part.crc, size: part.size, offset });
        offset += part.local.length + part.data.length;
        total += part.size;
      };

      try {
        for (const row of documents) {
          if (isTestEntity(row.entityId)) {
            lines.push(inhaltLine(row));
            continue;
          }
          if (row.pdfUrl) {
            try {
              const pdf = await loadDocumentPdf(row);
              if (total + pdf.length > MAX_BYTES) {
                lines.push(`${inhaltLine(row)}\tPDF wegen Größe nicht im ZIP`);
              } else {
                push({
                  name: zipEntryName(`pdf/${row.documentId}-${pdfDownloadName(row)}`),
                  data: pdf,
                });
                lines.push(inhaltLine(row));
                wrotePdf = true;
              }
            } catch (error) {
              console.error("[kuendigung] PDF fehlt im ZIP", row.documentId, error);
              lines.push(`${inhaltLine(row)}\tPDF nicht lesbar`);
            }
          }
          try {
            const raw = await resolveIntakePayload(row.fragen);
            const parsed =
              raw.trim().startsWith("{") || raw.trim().startsWith("[")
                ? (JSON.parse(raw) as unknown)
                : null;
            const locators = new Set<string>();
            collectUploadLocators(parsed, locators);
            for (const locator of locators) {
              if (seenUploads.has(locator)) continue;
              seenUploads.add(locator);
              const file = await readCustomerUpload(locator);
              if (!file) continue;
              if (total + file.buffer.length > MAX_BYTES) {
                lines.push(`Upload\t${file.filename}\tGröße\t${row.documentId}`);
                continue;
              }
              push({
                name: zipEntryName(`uploads/${file.filename}`),
                data: file.buffer,
              });
              lines.push(`Upload\t${file.filename}\t\t${row.documentId}`);
            }
          } catch (error) {
            console.error("[kuendigung] Upload nicht gelesen", row.documentId, error);
          }
        }

        if (!wrotePdf) {
          lines.push("Es liegen noch keine PDF-Versionen vor.");
        }
        lines.push("");
        lines.push("Die Aufbewahrung dieser Unterlagen bleibt Ihre Pflicht.");
        push({ name: "inhalt.txt", data: Buffer.from(`${lines.join("\n")}\n`, "utf8") });
        controller.enqueue(new Uint8Array(zipCentralDirectory(metas, at)));
        controller.close();
      } catch (error) {
        console.error("[kuendigung] ZIP-Strom fehlgeschlagen", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pdf-versionen-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
