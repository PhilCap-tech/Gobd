import { NextRequest, NextResponse } from "next/server";
import { checkoutReturnBaseUrl } from "@/lib/env";
import { abandonCreditCheckout } from "@/lib/schnellversion-credit-sessions";
import { releaseSvCreditHold } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Abbruch des Upgrade-Checkouts. Die offene Reservierung fällt, der Hinweis bleibt bis zur Zahlung. */
export async function GET(request: NextRequest): Promise<Response> {
  const purchase = new URL(request.url).searchParams.get("purchase")?.trim() ?? "";
  if (purchase) {
    await abandonCreditCheckout(purchase);
    await releaseSvCreditHold(purchase);
  }
  return NextResponse.redirect(`${checkoutReturnBaseUrl()}/checkout`, 303);
}
