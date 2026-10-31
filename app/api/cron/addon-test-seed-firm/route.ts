import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAddonTestSeedFirm } from "@/lib/addon-test-seed-firm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };

/** Einmalig (01.11. 05:30 UTC): Testzeilen +lu7/+lu7n mit Firma für den 7-Tage-Hinweis. Entfernung per Folge-PR. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }
  try {
    const result = await runAddonTestSeedFirm();
    console.log("addon-test-seed-firm", JSON.stringify(result));
    return NextResponse.json(result, { headers: HEADERS });
  } catch (error) {
    logError("[addon-test-seed-firm] Lauf fehlgeschlagen", error);
    return NextResponse.json({ error: "failed" }, { status: 503, headers: HEADERS });
  }
}
