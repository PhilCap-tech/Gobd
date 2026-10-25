import { timingSafeEqual } from "node:crypto";
import { runKanzleiToolboxRetention } from "@/lib/kanzlei-toolbox-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily retention for the Kanzlei register. Vercel calls this with
 * `Authorization: Bearer <CRON_SECRET>` when that variable is set.
 * The variable is not set by this draft. With the sheet switch off the
 * handler does not read or write the sheet.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runKanzleiToolboxRetention();
    return Response.json({
      ok: true,
      active: result.active,
      skipped: result.skipped,
      deleted: result.deleted.map((row) => ({ date: row.date, kind: row.kind, n: row.n })),
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
