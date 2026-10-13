import { NextResponse } from "next/server";
import {
  decodeAmpelAnswers,
  scoreAmpel,
  toAmpelReadinessLead,
  verifyAmpelDoiToken,
} from "@/lib/ampel";
import { sendAmpelResultMail } from "@/lib/ampel-mail";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { appendReadinessLead, findReadinessLeadById } from "@/lib/store";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function mailStatus(mail: { sent: boolean; stub: boolean; duplicate?: boolean }): string {
  if (mail.sent) return "sent";
  if (mail.duplicate) return "duplicate";
  if (mail.stub) return "stub";
  return "failed";
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
  const payload = verifyAmpelDoiToken(token);
  const answers = payload ? decodeAmpelAnswers(payload.answers) : null;
  const scored = answers ? scoreAmpel(answers) : null;
  if (!payload || !scored) {
    return jsonError("Dieser Bestätigungslink ist ungültig oder abgelaufen.", 400);
  }

  const mail = await sendAmpelResultMail(payload);
  if (!mail.sent && !mail.stub && !mail.duplicate) {
    return jsonError(
      "Das Ergebnis konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
      503,
    );
  }

  const lead = toAmpelReadinessLead({
    email: payload.email,
    answers: payload.answers,
    ref: payload.ref,
    consentAt: payload.consentAt,
    doiConfirmedAt: new Date().toISOString(),
    score: scored.score,
    light: scored.light,
    mailStatus: mailStatus(mail),
  });

  try {
    const existing = await findReadinessLeadById(lead.leadId);
    if (!existing) await appendReadinessLead(lead);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[ampel] appendReadinessLead fehlgeschlagen", error instanceof Error ? error.name : "error");
    return jsonError("Speichern fehlgeschlagen.", 500);
  }

  return NextResponse.json({ ok: true, score: scored.score, light: scored.light });
}
