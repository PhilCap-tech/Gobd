import { NextResponse } from "next/server";
import { isBereichId } from "@/lib/bereiche";
import { gesamtMusterPdfPath, BEREICH_ZU_VORLAGE } from "@/lib/module-muster";

export async function GET(_request: Request, { params }: { params: Promise<{ bereich: string }> }) {
  const { bereich } = await params;
  if (!isBereichId(bereich)) {
    return NextResponse.redirect(new URL("/muster", process.env.NEXT_PUBLIC_APP_URL || "https://www.gobd-doku-erstellen.de"));
  }
  const vorlage = BEREICH_ZU_VORLAGE[bereich] ?? "dienstleister";
  return NextResponse.redirect(new URL(gesamtMusterPdfPath(vorlage), process.env.NEXT_PUBLIC_APP_URL || "https://www.gobd-doku-erstellen.de"), 308);
}
