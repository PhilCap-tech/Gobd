import { NextResponse } from "next/server";
import { generateLeadMagnetPdf, LEAD_MAGNET_FILENAME } from "@/lib/lead-magnet";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const buffer = await generateLeadMagnetPdf();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${LEAD_MAGNET_FILENAME}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
