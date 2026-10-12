import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { subscriptionWriteDenial } from "@/lib/kuendigung-access";
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
import { intakeCheckoutStatus, resolveCheckoutSession, type CheckoutResolveError } from "@/lib/stripe";
import { emailsEqual, emptyAnswers, type CheckoutIdentity, type IntakeAnswers, type SheetRow } from "@/lib/types";

export const runtime = "nodejs";

const lookup: DeliveryLookup = {
  findDocumentById,
  listDocumentFamily,
  findLatestDocumentByStripeSessionId,
};

export type DeliveryAuthIo = {
  lookup: DeliveryLookup;
  resolveCheckout: (
    sessionId: string | undefined,
  ) => Promise<CheckoutIdentity | { error: CheckoutResolveError }>;
};

const defaultIo: DeliveryAuthIo = {
  lookup,
  resolveCheckout: resolveCheckoutSession,
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Kapitelplan. PDF entsteht beim Intake.
 * Ohne Sitzung immer 401. Eine fremde Mailbox immer 403,
 * auch wenn zur Checkout-Session noch kein Dokument liegt.
 */
export async function postDelivery(
  request: Request,
  io: DeliveryAuthIo = defaultIo,
) {
  let body: { sessionId?: string; answers?: Partial<IntakeAnswers> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sessionEmail = await sessionEmailFromRequest(request);
  const closed = await subscriptionWriteDenial(sessionEmail);
  if (closed) {
    return NextResponse.json(
      { error: closed },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const bodySessionId = body.sessionId?.trim() ?? "";
  const denied = await deliveryDenied(
    { sessionEmail, sessionId: bodySessionId },
    io,
  );
  if (denied) return denied;

  const plan = await enqueueDelivery({
    sessionId: bodySessionId || "session",
    answers: { ...emptyAnswers(), ...body.answers },
  });

  return NextResponse.json({
    ok: true,
    delivery: plan,
  });
}

export function POST(request: Request) {
  return postDelivery(request);
}

async function deliveryDenied(
  input: { sessionEmail: string | null; sessionId: string },
  io: DeliveryAuthIo,
): Promise<NextResponse | null> {
  const { sessionEmail, sessionId } = input;
  if (!sessionEmail) return jsonError("Bitte anmelden.", 401);
  if (!sessionId) return null;

  let rows: SheetRow[] | null = null;
  try {
    rows = await lookupDeliveredRows({ sessionId }, io.lookup);
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

  const resolved = await io.resolveCheckout(sessionId);
  if ("error" in resolved) {
    if (resolved.error === "lookup_failed") {
      return jsonError("Session konnte nicht geprüft werden. Bitte erneut versuchen.", 503);
    }
    return jsonError(
      resolved.error === "not_paid"
        ? "Zahlung noch nicht bestätigt."
        : resolved.error === "invalid"
          ? "Checkout-Session ist ungültig."
          : "Kein Zugriff.",
      intakeCheckoutStatus(resolved.error),
    );
  }
  const owner = resolved.email.trim();
  if (!owner || !emailsEqual(sessionEmail, owner)) {
    return jsonError("Kein Zugriff.", 403);
  }
  if (resolved.stub && !devCheckoutStubAllowed()) {
    return jsonError("Bitte anmelden.", 401);
  }
  return null;
}
