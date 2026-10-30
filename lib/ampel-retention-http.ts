/**
 * GET /api/cron/ampel-loeschlauf (Vercel Cron, täglich) und GET /api/cron/ampel-altdaten (einmalig, ohne Cron).
 * Bearer CRON_SECRET. `?modus=trockenlauf` zählt immer nur. Sonst: Trockenlauf-Schalter gewinnt,
 * Ausführen nur mit Execute-Schalter, beides aus -> nichts. Antwort: nur Zähler.
 */
import { cronAuthorized } from "@/lib/cron-auth";
import { logError } from "@/lib/log-error";
import { ampelSwitch, resolveRunMode } from "@/lib/ampel-retention-rules";
import type { AmpelRetentionIo } from "@/lib/ampel-retention-job";

export const AMPEL_RETENTION_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function handleAmpelJob(
  request: Request,
  job: "retention" | "cleanup",
  deps: { secret?: string; io?: () => AmpelRetentionIo; now?: number } = {},
): Promise<{ status: number; body: unknown }> {
  const secret = (deps.secret ?? process.env.CRON_SECRET ?? "").trim();
  if (!cronAuthorized(request, secret)) return { status: 401, body: { error: "unauthorized" } };
  const forcedDry = new URL(request.url).searchParams.get("modus") === "trockenlauf";
  const switches =
    job === "retention"
      ? { dryRun: ampelSwitch("dryRun"), execute: ampelSwitch("execute") }
      : { dryRun: ampelSwitch("cleanupDryRun"), execute: ampelSwitch("cleanupExecute") };
  const mode = resolveRunMode({ forcedDry, ...switches });
  if (mode === "off") return { status: 200, body: { mode: "off", switches } };
  try {
    const jobs = await import("@/lib/ampel-retention-job");
    const io = deps.io ? deps.io() : jobs.defaultAmpelRetentionIo();
    const execute = mode === "execute";
    const report =
      job === "retention"
        ? await jobs.runAmpelRetention(io, { execute, now: deps.now })
        : await jobs.runAmpelCleanup(io, { execute, now: deps.now });
    console.info(job === "retention" ? "[ampel-loeschlauf]" : "[ampel-altdaten]", JSON.stringify(report));
    return { status: 200, body: { ...report, switches } };
  } catch (error) {
    logError(job === "retention" ? "[ampel-loeschlauf] abgebrochen" : "[ampel-altdaten] abgebrochen", error);
    return { status: 503, body: { error: "unavailable", switches } };
  }
}
