import { NextResponse } from "next/server";
import { createAmpelDoiToken, decodeAmpelAnswers, normalizeAmpelEmail, sanitizeAmpelRef, scoreAmpel } from "@/lib/ampel";
import { sendAmpelConfirmationMail } from "@/lib/ampel-mail";

export const runtime = "nodejs";

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
  const token = createAmpelDoiToken({
    email,
    answers: code,
    ref: sanitizeAmpelRef(value.ref),
    consentAt: new Date().toISOString(),
  });
  if (!token) return jsonError("Bitte beantworten Sie alle Fragen.", 400);

  const mail = await sendAmpelConfirmationMail({ email, token });
  if (mail.duplicate || mail.inflight) {
    return NextResponse.json({
      ok: true,
      throttled: true,
      message:
        "Wir haben Ihnen bereits eine Bestätigungsmail gesendet. Bitte prüfen Sie Ihr Postfach. Eine weitere Mail ist in diesem Zeitraum nicht möglich.",
    });
  }
  if (!mail.sent && !mail.stub) {
    return jsonError(
      "Die Bestätigungsmail konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
      503,
    );
  }
  return NextResponse.json({ ok: true });
}
