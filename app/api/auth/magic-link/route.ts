import { NextResponse } from "next/server";
import { magicLinkUrl } from "@/lib/auth";
import { isMailConfigured } from "@/lib/env";
import { sendMagicLinkMail } from "@/lib/ops";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Bitte eine gültige E-Mail angeben." }, { status: 400 });
  }

  const verifyUrl = magicLinkUrl(email);
  const mail = await sendMagicLinkMail({ email, magicLinkUrl: verifyUrl });
  const mailReady = isMailConfigured();

  return NextResponse.json({
    ok: true,
    sent: mail.sent,
    stub: mail.stub || !mailReady,
    verifyUrl: mailReady ? undefined : verifyUrl,
  });
}
