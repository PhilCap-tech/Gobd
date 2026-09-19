import { NextResponse } from "next/server";
import { enqueueDelivery } from "@/lib/delivery";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Delivery-Stub-Route.
 * TODO: nur intern / authentifiziert aufrufen, wenn der echte Generator existiert.
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
    stub: true,
    // TODO: echter Job-Status statt Sofort-Plan
    delivery: plan,
  });
}
