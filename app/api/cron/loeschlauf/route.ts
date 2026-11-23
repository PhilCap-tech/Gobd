import { NextResponse } from "next/server";
import { logMeasureRetention } from "@/lib/measure-retention-run";
import { handleRetentionCron, RETENTION_HEADERS } from "@/lib/retention-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Löschlauf v3 (täglich per Vercel Cron). Bearer CRON_SECRET. `?modus=trockenlauf` zählt nur. */
export async function GET(request: Request) {
  const result = await handleRetentionCron(request);
  if (result.status === 200) await logMeasureRetention();
  return NextResponse.json(result.body, { status: result.status, headers: RETENTION_HEADERS });
}
