import { NextResponse } from "next/server";
import {
  generateInhaltGliederungPdf,
  INHALT_GLIEDERUNG_FILENAME,
} from "@/lib/lead-magnet-inhalt";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const buffer = await generateInhaltGliederungPdf();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${INHALT_GLIEDERUNG_FILENAME}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
