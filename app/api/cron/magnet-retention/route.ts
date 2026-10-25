import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { runProductionMagnetRetention } from "@/lib/vorlagen/retention-sheet";
import {
  berlinRetentionDate,
  cronAuthorized,
  magnetRetentionLog,
  type MagnetRetentionCounts,
} from "@/lib/vorlagen/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZEROS: MagnetRetentionCounts = {
  deletedUnconfirmed: 0,
  deletedConfirmed: 0,
  deletedMarketingProof: 0,
  clearedCalc: 0,
  deletedSteps: 0,
};

function noStore(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function handleMagnetRetentionRequest(
  request: Request,
  env: {
    authorization: string | null;
    cronSecret: string | undefined;
    vercelEnv: string | undefined;
    automated: boolean;
    now: number;
  },
  run: (now: number) => Promise<MagnetRetentionCounts | null> = runProductionMagnetRetention,
): Promise<Response> {
  if (!cronAuthorized(env.authorization, env.cronSecret)) return noStore("Unauthorized", 401);
  const date = berlinRetentionDate(env.now);
  const skipped = env.vercelEnv === "preview" ? "preview" : env.automated ? "automated" : env.vercelEnv === "production" ? "" : "not-production";
  if (skipped) {
    console.info(magnetRetentionLog({ date, ...ZEROS, skipped }));
    return Response.json({ ok: true, skipped });
  }
  try {
    const counts = await run(env.now);
    if (!counts) {
      console.info(magnetRetentionLog({ date, ...ZEROS, skipped: "not-production" }));
      return Response.json({ ok: true, skipped: "not-production" });
    }
    console.info(magnetRetentionLog({ date, ...counts }));
    return Response.json({ ok: true, ...counts });
  } catch {
    return noStore("Fehler", 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleMagnetRetentionRequest(request, {
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
    vercelEnv: process.env.VERCEL_ENV,
    automated: automatedRunForbidsLiveWrites(),
    now: Date.now(),
  });
}
