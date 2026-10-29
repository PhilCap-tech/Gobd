/**
 * GET /api/cron/loeschlauf (Vercel Cron, täglich). Bearer CRON_SECRET.
 * - `?modus=trockenlauf`: immer nur zählen (auf Abruf, unabhängig von Schaltern).
 * - sonst: RETENTION_DRY_RUN_ENABLED -> nur zählen (gewinnt immer, auch wenn EXECUTE gesetzt ist);
 *   nur RETENTION_EXECUTE_ENABLED -> ausführen; beides aus -> nichts.
 * Antwort und Log: nur Zähler, keine IDs, keine Adressen.
 */
import { cronAuthorized } from "@/lib/cron-auth";
import { logError } from "@/lib/log-error";
import { retentionDryRunEnabled, retentionExecuteEnabled } from "@/lib/pricing-model";
import { retentionLogLine, runRetention, type RetentionIo } from "@/lib/retention-run";

export const RETENTION_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function handleRetentionCron(
  request: Request,
  deps: { secret?: string; io?: () => RetentionIo | Promise<RetentionIo>; now?: Date } = {},
): Promise<{ status: number; body: unknown }> {
  const secret = (deps.secret ?? process.env.CRON_SECRET ?? "").trim();
  if (!cronAuthorized(request, secret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const url = new URL(request.url);
  const forcedDry = url.searchParams.get("modus") === "trockenlauf";
  const switches = { dryRun: retentionDryRunEnabled(), execute: retentionExecuteEnabled() };
  // Trockenlauf gewinnt immer: auch bei Fehlkonfiguration (beide Schalter an) wird nie gelöscht.
  const execute = !forcedDry && !switches.dryRun && switches.execute;
  if (!forcedDry && !execute && !switches.dryRun) {
    return { status: 200, body: { mode: "off", switches } };
  }
  try {
    const io = deps.io ? await deps.io() : (await import("@/lib/retention-io")).defaultRetentionIo();
    const report = await runRetention(io, { execute, now: deps.now });
    console.info("[loeschlauf]", retentionLogLine(report));
    return { status: 200, body: { ...report, switches } };
  } catch (error) {
    logError("[loeschlauf] Lauf abgebrochen", error);
    return { status: 503, body: { error: "unavailable", switches } };
  }
}
