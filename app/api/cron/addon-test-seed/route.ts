import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAddonTestSeed } from "@/lib/addon-test-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };

/** Einmalig (30.10. 05:30 UTC): zwei Testzeilen für den 7-Tage-Hinweis anhängen. Entfernung per Folge-PR. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }
  try {
    const result = await runAddonTestSeed();
    console.log("addon-test-seed", JSON.stringify(result));
    return NextResponse.json(result, { headers: HEADERS });
  } catch (error) {
    logError("[addon-test-seed] Lauf fehlgeschlagen", error);
    return NextResponse.json({ error: "failed" }, { status: 503, headers: HEADERS });
  }
}
