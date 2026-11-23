import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { logMeasureRetention } from "@/lib/measure-retention-run";
import { handleRetentionCron, RETENTION_HEADERS } from "@/lib/retention-http";
import { runScheduledSvPurge, schnellversionPurgeEnabled } from "@/lib/schnellversion-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Löschlauf v3 (täglich per Vercel Cron). Bearer CRON_SECRET. `?modus=trockenlauf` zählt nur. */
export async function GET(request: Request) {
  const result = await handleRetentionCron(request);
  if (result.status === 200) await logMeasureRetention();
  if (result.status !== 401 && schnellversionPurgeEnabled()) {
    try {
      await runScheduledSvPurge();
    } catch (error) {
      logError("[loeschlauf] Schnellversion", error);
    }
  }
  return NextResponse.json(result.body, { status: result.status, headers: RETENTION_HEADERS });
}
