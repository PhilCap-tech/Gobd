import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { KANZLEI_MERKBLATT_FILENAME } from "@/lib/kanzlei-copy";

export const runtime = "nodejs";

export async function GET() {
  const bytes = await readFile(path.join(process.cwd(), "content/kanzlei-merkblatt.pdf"));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${KANZLEI_MERKBLATT_FILENAME}"`,
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
