import { NextResponse } from "next/server";
import { enqueueDelivery } from "@/lib/delivery";
import { triggerOnboardingMail } from "@/lib/ops";
import { appendRecord } from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { toSheetRow, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

function isAnswers(value: unknown): value is IntakeAnswers {
  if (!value || typeof value !== "object") return false;
  const v = value as IntakeAnswers;
  return (
    Array.isArray(v.branchen) &&
    typeof v.rechtsform === "string" &&
    typeof v.mitarbeitende === "string" &&
    Array.isArray(v.fibu) &&
    typeof v.weitereSysteme === "string" &&
    Array.isArray(v.eingangsbelege) &&
    Array.isArray(v.ausgangsrechnungen) &&
    typeof v.archiv === "string" &&
    typeof v.hosting === "string" &&
    Array.isArray(v.backup) &&
    typeof v.zugriff === "string" &&
    typeof v.gf === "string" &&
    typeof v.buchhaltung === "string" &&
    typeof v.it === "string" &&
    typeof v.steuerberater === "string"
  );
}

export async function POST(request: Request) {
  let body: {
    sessionId?: string;
    answers?: unknown;
    email?: string;
    company?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const identity = await resolveCheckoutSession(body.sessionId);
  if ("error" in identity) {
    return NextResponse.json(
      { error: "Keine gültige Zahlungssession." },
      { status: 401 },
    );
  }

  if (identity.stub) {
    identity.email = body.email?.trim() || identity.email;
    identity.company = body.company?.trim() || identity.company;
  }

  if (!isAnswers(body.answers)) {
    return NextResponse.json({ error: "Intake unvollständig." }, { status: 400 });
  }

  const answers = body.answers;
  const delivery = await enqueueDelivery({
    sessionId: identity.stripeSessionId,
    answers,
  });

  const stored = await appendRecord(
    toSheetRow({
      identity,
      answers,
      status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
      deliveryStatus: delivery.status,
    }),
  );

  await triggerOnboardingMail({
    email: identity.email,
    company: identity.company,
    sessionId: identity.stripeSessionId,
  });

  return NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
  });
}
