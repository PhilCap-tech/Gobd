import { NextResponse } from "next/server";
import {
  LOGIN_LINK_FAILED_NOTICE,
  LOGIN_LINK_GENERIC_OK,
  deliverLoginLink,
} from "@/lib/login-mail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Bitte eine gültige E-Mail angeben." }, { status: 400 });
  }

  const status = await deliverLoginLink(email, body.next);
  if (status === "failed") {
    return NextResponse.json(
      { ok: false, error: LOGIN_LINK_FAILED_NOTICE },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, message: LOGIN_LINK_GENERIC_OK });
}
