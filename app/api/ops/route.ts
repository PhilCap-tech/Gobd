import { NextResponse } from "next/server";
import {
  handleFailedJob,
  handleFailedPayment,
  triggerOnboardingMail,
} from "@/lib/ops";
import { logError } from "@/lib/log-error";

export const runtime = "nodejs";

/**
 * Ops-Route für bestehende Trigger (Onboarding / Failed Payment / Failed Job).
 * Versand nur, wenn Resend-Env gesetzt ist; sonst Log-Stub.
 * TODO: absichern oder entfernen, sobald echte Provider hängen.
 */
export async function POST(request: Request) {
  let body: {
    action?: "onboarding" | "failed_payment" | "failed_job";
    email?: string;
    company?: string;
    sessionId?: string;
    checkoutNames?: string[];
    reason?: string;
    audience?: "kunde" | "steuerberater";
    entityId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "onboarding":
        return NextResponse.json(
          await triggerOnboardingMail({
            email: body.email || "",
            company: body.company,
            sessionId: body.sessionId,
            checkoutNames: body.checkoutNames,
            entityId: body.entityId,
            audience: body.audience === "steuerberater" ? "steuerberater" : "kunde",
          }),
        );
      case "failed_payment":
        return NextResponse.json(
          await handleFailedPayment({
            email: body.email,
            sessionId: body.sessionId,
            reason: body.reason,
            entityId: body.entityId,
          }),
        );
      case "failed_job":
        return NextResponse.json(
          await handleFailedJob({
            email: body.email,
            sessionId: body.sessionId,
            reason: body.reason,
            entityId: body.entityId,
          }),
        );
      default:
        return NextResponse.json(
          {
            error: "Unbekannte action",
            actions: ["onboarding", "failed_payment", "failed_job"],
          },
          { status: 400 },
        );
    }
  } catch (error) {
    logError("[ops] POST fehlgeschlagen", error);
    return NextResponse.json(
      {
        error: "Ops-Stub fehlgeschlagen.",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 },
    );
  }
}
