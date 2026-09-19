import { NextResponse } from "next/server";
import { enqueueDelivery } from "@/lib/delivery";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Plan-Preview (Kapitel + offene Punkte). Das PDF entsteht beim Intake-Submit.
 */
export async function POST(request: Request) {
  let body: { sessionId?: string; answers?: Partial<IntakeAnswers> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const plan = await enqueueDelivery({
    sessionId: body.sessionId || "manual",
    answers: { ...emptyAnswers(), ...body.answers },
  });

  return NextResponse.json({
    ok: true,
    delivery: plan,
  });
}
