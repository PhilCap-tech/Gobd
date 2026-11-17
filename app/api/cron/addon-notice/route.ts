import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAddonNotice } from "@/lib/plan-addon-notice";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { runSchnellversionReminder } from "@/lib/schnellversion-reminder";
import { listAllSvPurchases } from "@/lib/schnellversion-record";

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
    // Dieselbe tägliche Route. Ohne Flag passiert nichts. Versand nur mit SCHNELLVERSION_49_REMINDER_SEND.
    if (schnellversion49Enabled()) {
      try {
        await runSchnellversionReminder(await listAllSvPurchases(), new Date(), async (mail) => {
          await sendDedupedEmail({
            dedupeKey: `sv49-reminder:${mail.to}`,
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          });
        });
      } catch (error) {
        logError("[addon-notice] Schnellversion", error);
      }
    }
    return NextResponse.json(result, { headers: HEADERS });
  } catch (error) {
    logError("[addon-notice] Lauf fehlgeschlagen", error);
    return NextResponse.json({ error: "failed" }, { status: 503, headers: HEADERS });
  }
}
