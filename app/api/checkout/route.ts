import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    email?: string;
    company?: string;
    acceptedDisclaimer?: boolean;
    entrepreneur?: boolean;
    entityId?: string;
    audience?: "kunde" | "steuerberater";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const company = body.company?.trim() ?? "";
  const entityId = body.entityId?.trim() ?? "";

  if (!company || !email) {
    return NextResponse.json(
      { error: "Bitte Firma und E-Mail angeben." },
      { status: 400 },
    );
  }

  const partner = body.audience === "steuerberater";

  if (body.entrepreneur !== true) {
    return NextResponse.json(
      {
        error: partner
          ? "Bitte bestätigen Sie, dass Sie als Unternehmer bestellen."
          : "Bitte bestätige, dass du als Unternehmer bestellst.",
      },
      { status: 400 },
    );
  }

  if (!body.acceptedDisclaimer) {
    return NextResponse.json(
      {
        error:
          "Bitte bestätigen: keine Steuerberatung und keine Rechtsberatung.",
      },
      { status: 400 },
    );
  }

  try {
    const session = await createCheckoutSession({
      email,
      company,
      entityId: entityId || undefined,
      audience: body.audience === "steuerberater" ? "steuerberater" : "kunde",
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json(
      { error: "Checkout konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}
