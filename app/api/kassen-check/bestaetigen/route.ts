import { NextResponse } from "next/server";
import { confirmAmpelDoi } from "@/lib/ampel-confirm";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { sendKassenDoiAckMail } from "@/lib/kassen-check-mail";
import { findReadinessLeadById, upsertReadinessLead } from "@/lib/store";
import { sheetsOutageResponse } from "@/lib/sheets-http";

export const runtime = "nodejs";

const INVALID_LINK = "Dieser Bestätigungslink ist ungültig oder abgelaufen.";
const MAIL_FAILED = "Die Bestätigung konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es später erneut.";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : "";
  if (!token) return jsonError(INVALID_LINK, 400);

  try {
    const result = await confirmAmpelDoi(token, {
      findLead: (leadId) => findReadinessLeadById(leadId, { fresh: true }),
      saveLead: async (lead) => {
        if (automatedRunForbidsLiveWrites()) return;
        await upsertReadinessLead(lead);
      },
      sendResult: sendKassenDoiAckMail,
    });
    if (!result.ok) {
      return jsonError(result.reason === "invalid" ? INVALID_LINK : MAIL_FAILED, result.status);
    }
    return NextResponse.json({ ok: true, light: result.light });
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[kassen] Bestätigung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return jsonError(MAIL_FAILED, 503);
  }
}
