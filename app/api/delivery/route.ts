import { NextResponse } from "next/server";
import { enqueueDelivery } from "@/lib/delivery";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Delivery-Stub-Route.
 * TODO: nur intern / authentifiziert aufrufen, wenn der echte Generator existiert.
 */
export async function POST(request: Request) {
  try {
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
  } catch (error) {
    console.error("[delivery] POST fehlgeschlagen", error);
    return NextResponse.json(
      {
        error: "Delivery-Stub fehlgeschlagen.",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 },
    );
  }
}
