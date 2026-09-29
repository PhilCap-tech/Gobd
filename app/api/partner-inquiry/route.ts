import { NextResponse } from "next/server";
import { parsePartnerInquiry } from "@/lib/partner-inquiry";
import { sendPartnerInquiryMail } from "@/lib/ops";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.", 400);
  }

  const parsed = parsePartnerInquiry(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  if (parsed.honeypot) {
    console.info("[partner-inquiry] honeypot — kein Versand");
    return NextResponse.json({ ok: true, mailStatus: "skipped" });
  }

  try {
    const mail = await sendPartnerInquiryMail(parsed.inquiry);
    if (!mail.sent && !mail.stub) {
      return jsonError(
        "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@gobd-doku-erstellen.de.",
        502,
      );
    }
    return NextResponse.json({
      ok: true,
      mailStatus: mail.sent ? "sent" : "stub",
    });
  } catch (error) {
    console.error("[partner-inquiry] Versand fehlgeschlagen", error);
    return jsonError(
      "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@gobd-doku-erstellen.de.",
      502,
    );
  }
}
