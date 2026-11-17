import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { schnellversion49Enabled, schnellversionCheckoutPlan } from "@/lib/schnellversion-flag";
import { openSchnellversionCheckout } from "@/lib/schnellversion-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!schnellversion49Enabled()) return new Response(null, { status: 404 });
  if (schnellversionCheckoutPlan() === "refuse") return Response.json({ ready: false });
  if (parseSvArm(request.cookies.get(SV_ARM_COOKIE)?.value) !== "test") {
    return Response.json({ ready: false });
  }
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = (await sessionEmailFromRequest(request)) ?? "";
  const opened = await openSchnellversionCheckout({
    answers: record.answers,
    unternehmer: record.unternehmer === true,
    bewusst: record.bewusst === true,
    email,
  });
  if (!opened.ok) return new Response(null, { status: opened.status });
  return Response.json({ ready: true, url: opened.url, consentAt: true });
}
