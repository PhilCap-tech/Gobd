import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAddonNotice } from "@/lib/plan-addon-notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };

/** Täglich: Hinweis 7 Tage vor Ende des 30-Tage-Zugangs (Versand nur mit PLAN_ADDON_NOTICE_ENABLED). */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }
  try {
    const result = await runAddonNotice();
    return NextResponse.json(result, { headers: HEADERS });
  } catch (error) {
    logError("[addon-notice] Lauf fehlgeschlagen", error);
    return NextResponse.json({ error: "failed" }, { status: 503, headers: HEADERS });
  }
}
