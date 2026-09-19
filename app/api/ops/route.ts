import { NextResponse } from "next/server";
import {
  handleFailedJob,
  handleFailedPayment,
  triggerOnboardingMail,
} from "@/lib/ops";

export const runtime = "nodejs";

/**
 * Ops-Stub-Route (kein Versand).
 * TODO: absichern oder entfernen, sobald echte Provider hängen.
 */
export async function POST(request: Request) {
  let body: {
    action?: "onboarding" | "failed_payment" | "failed_job";
    email?: string;
    company?: string;
    sessionId?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  switch (body.action) {
    case "onboarding":
      return NextResponse.json(
        await triggerOnboardingMail({
          email: body.email || "",
          company: body.company,
          sessionId: body.sessionId,
        }),
      );
    case "failed_payment":
      return NextResponse.json(
        await handleFailedPayment({
          email: body.email,
          sessionId: body.sessionId,
          reason: body.reason,
        }),
      );
    case "failed_job":
      return NextResponse.json(
        await handleFailedJob({
          sessionId: body.sessionId,
          reason: body.reason,
        }),
      );
    default:
      return NextResponse.json(
        { error: "Unbekannte action", actions: ["onboarding", "failed_payment", "failed_job"] },
        { status: 400 },
      );
  }
}
