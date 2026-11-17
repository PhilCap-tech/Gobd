import { NextRequest } from "next/server";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { startSchnellversionCheckout } from "@/lib/schnellversion-checkout";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!schnellversion49Enabled()) return new Response(null, { status: 404 });
  if (parseSvArm(request.cookies.get(SV_ARM_COOKIE)?.value) !== "test") {
    return Response.json({ ready: false });
  }
  const result = await startSchnellversionCheckout();
  return Response.json(result);
}
