import { NextResponse } from "next/server";
import { decodeAmpelAnswers, normalizeAmpelEmail, sanitizeAmpelRef, scoreAmpel } from "@/lib/ampel";
import { requestAmpelConfirmation } from "@/lib/ampel-confirm";
import { sendAmpelConfirmationMail } from "@/lib/ampel-mail";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { findLatestAmpelReadinessLead, upsertReadinessLead } from "@/lib/store";

export const runtime = "nodejs";

const MAIL_FAILED =
  "Die Bestätigungsmail konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.";
const THROTTLED =
  "Wir haben Ihnen bereits eine Bestätigungsmail gesendet. Bitte prüfen Sie Ihr Postfach. Eine weitere Mail ist in diesem Zeitraum nicht möglich.";

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
  if (!body || typeof body !== "object") return jsonError("Ungültige Anfrage", 400);
  const value = body as Record<string, unknown>;
  if (value.consent !== true) {
    return jsonError("Bitte willigen Sie in den Versand ein.", 400);
  }
  const email = normalizeAmpelEmail(value.email);
  if (!email) return jsonError("Bitte geben Sie eine gültige E-Mail-Adresse an.", 400);
  const code = typeof value.answers === "string" ? value.answers : "";
  const answers = decodeAmpelAnswers(code);
  if (!answers || !scoreAmpel(answers)) {
    return jsonError("Bitte beantworten Sie alle Fragen.", 400);
  }

  try {
    const result = await requestAmpelConfirmation(
      { email, answers: code, ref: sanitizeAmpelRef(value.ref) },
      {
        findLead: (leadEmail, leadAnswers) =>
          findLatestAmpelReadinessLead(leadEmail, leadAnswers, { fresh: true }),
        saveLead: async (lead) => {
          await upsertReadinessLead(lead);
        },
        sendConfirmation: sendAmpelConfirmationMail,
      },
    );
    if (!result.ok) {
      return jsonError(result.reason === "invalid" ? "Bitte beantworten Sie alle Fragen." : MAIL_FAILED, result.status);
    }
    if (result.throttled) {
      return NextResponse.json({ ok: true, throttled: true, message: THROTTLED });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[ampel] Bestätigungsmail fehlgeschlagen", error instanceof Error ? error.name : "error");
    return jsonError(MAIL_FAILED, 503);
  }
}
