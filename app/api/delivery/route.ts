import { NextResponse } from "next/server";
import { checkoutGrantFromRequest, sessionEmailFromRequest } from "@/lib/auth";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { enqueueDelivery } from "@/lib/delivery";
import {
  authorizeDeliveredWrite,
  lookupDeliveredRows,
  type DeliveryLookup,
} from "@/lib/session-write";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
} from "@/lib/store";
import { intakeCheckoutStatus, resolveCheckoutSession } from "@/lib/stripe";
import { emptyAnswers, type IntakeAnswers, type SheetRow } from "@/lib/types";

export const runtime = "nodejs";

const lookup: DeliveryLookup = {
  findDocumentById,
  listDocumentFamily,
  findLatestDocumentByStripeSessionId,
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Kapitelplan. PDF entsteht beim Intake.
 * Ohne Login oder Checkout-Nachweis 401. Nach der ersten Lieferung gilt
 * dieselbe Inhaber-Regel wie bei den anderen Schreibzugriffen.
 */
export async function POST(request: Request) {
  let body: { sessionId?: string; answers?: Partial<IntakeAnswers> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sessionEmail = sessionEmailFromRequest(request);
  const grant = checkoutGrantFromRequest(request);
  const bodySessionId = body.sessionId?.trim() ?? "";
  const denied = await deliveryDenied({
    sessionEmail,
    grant: Boolean(grant),
    sessionId: bodySessionId,
  });
  if (denied) return denied;

  const plan = await enqueueDelivery({
    sessionId: bodySessionId || grant?.sessionId || "session",
    answers: { ...emptyAnswers(), ...body.answers },
  });

  return NextResponse.json({
    ok: true,
    delivery: plan,
  });
}

async function deliveryDenied(input: {
  sessionEmail: string | null;
  grant: boolean;
  sessionId: string;
}): Promise<NextResponse | null> {
  const { sessionEmail, grant, sessionId } = input;

  if (sessionId) {
    let rows: SheetRow[] | null = null;
    try {
      rows = await lookupDeliveredRows({ sessionId }, lookup);
    } catch (error) {
      console.error(
        "[delivery] Nachweis nicht geprüft",
        error instanceof Error ? error.name : "error",
      );
      rows = null;
    }
    if (rows && rows.length > 0) {
      const write = authorizeDeliveredWrite({ sessionEmail, rows });
      if (!write.ok) return jsonError(write.error, write.status);
      return null;
    }
    if (rows === null && !sessionEmail && !grant) {
      return jsonError("Bitte anmelden.", 401);
    }
  }

  if (sessionEmail || grant) return null;

  if (sessionId) {
    const resolved = await resolveCheckoutSession(sessionId);
    if ("error" in resolved) {
      return jsonError(
        resolved.error === "not_paid"
          ? "Zahlung noch nicht bestätigt."
          : resolved.error === "invalid"
            ? "Checkout-Session ist ungültig."
            : "Bitte anmelden.",
        intakeCheckoutStatus(resolved.error),
      );
    }
    if (resolved.stub && !devCheckoutStubAllowed()) {
      return jsonError("Bitte anmelden.", 401);
    }
    return null;
  }

  return jsonError("Bitte anmelden.", 401);
}
