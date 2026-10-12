import { NextResponse } from "next/server";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
import { ownerEmailForLoginNext } from "@/lib/checkout-session";
import {
  LOGIN_LINK_FAILED_NOTICE,
  LOGIN_LINK_GENERIC_OK,
  deliverLoginLink,
  type LoginMailStatus,
} from "@/lib/login-mail";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
} from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function completeMagicLinkRequest(
  body: { email?: string; next?: string },
  deps: {
    deliver: (email: string, next?: string | null) => Promise<LoginMailStatus>;
    resolveOwner: (next: string | null | undefined) => Promise<string>;
  },
): Promise<NextResponse> {
  const typed = body.email?.trim().toLowerCase() ?? "";
  const email = typed || (await deps.resolveOwner(body.next)).trim().toLowerCase();
  if (!email || !email.includes("@") || /\s/.test(email)) {
    return NextResponse.json({ error: "Bitte eine gültige E-Mail angeben." }, { status: 400 });
  }

  const status = await deps.deliver(email, body.next);
  if (status === "failed") {
    return NextResponse.json(
      { ok: false, error: LOGIN_LINK_FAILED_NOTICE },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, message: LOGIN_LINK_GENERIC_OK });
}

async function resolveOwnerFromNext(next: string | null | undefined): Promise<string> {
  return ownerEmailForLoginNext(next, {
    findDocumentById,
    findLatestBySession: findLatestDocumentByStripeSessionId,
    resolveCheckout: resolveCheckoutSession,
    grantEmail: async (sessionId) => (await checkoutSessionGrant(sessionId))?.email ?? null,
  });
}

export async function POST(request: Request) {
  let body: { email?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  return completeMagicLinkRequest(body, {
    deliver: deliverLoginLink,
    resolveOwner: resolveOwnerFromNext,
  });
}
