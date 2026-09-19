import { NextResponse } from "next/server";
import { resolveCheckoutSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? undefined;
  const result = await resolveCheckoutSession(sessionId);

  if ("error" in result) {
    const status =
      result.error === "lookup_failed"
        ? 503
        : result.error === "not_paid"
          ? 403
          : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
