import { NextResponse } from "next/server";
import { handleRetentionCron, RETENTION_HEADERS } from "@/lib/retention-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Löschlauf v3 (täglich per Vercel Cron). Bearer CRON_SECRET. `?modus=trockenlauf` zählt nur. */
export async function GET(request: Request) {
  const result = await handleRetentionCron(request);
  return NextResponse.json(result.body, { status: result.status, headers: RETENTION_HEADERS });
}
