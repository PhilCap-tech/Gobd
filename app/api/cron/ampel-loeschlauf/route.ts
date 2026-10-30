import { NextResponse } from "next/server";
import { AMPEL_RETENTION_HEADERS, handleAmpelJob } from "@/lib/ampel-retention-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bearer CRON_SECRET. `?modus=trockenlauf` zählt nur. Schalter siehe lib/ampel-retention-rules.ts (Default AUS). */
export async function GET(request: Request) {
  const result = await handleAmpelJob(request, "retention");
  return NextResponse.json(result.body, { status: result.status, headers: AMPEL_RETENTION_HEADERS });
}
