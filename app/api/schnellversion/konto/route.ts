import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { parseSchnellversionAnswers } from "@/lib/schnellversion-answers";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { generateStandardPdf } from "@/lib/schnellversion-pdf";
import { saveSvPurchase } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legt das PDF im Konto ab, wenn eine Sitzung besteht. Sonst bleibt der Sofort-Download auf der Danke-Seite. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!schnellversion49Enabled()) return new Response(null, { status: 404 });
  if (parseSvArm(request.cookies.get(SV_ARM_COOKIE)?.value) !== "test") {
    return Response.json({ ok: false });
  }
  const email = await sessionEmailFromRequest(request);
  if (!email) return Response.json({ ok: false, login: true });
  let parsed: unknown;
  try {
    parsed = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object") return new Response(null, { status: 400 });
  const body = parsed as Record<string, unknown>;
  const gekauftAm = typeof body.gekauftAm === "string" ? body.gekauftAm : new Date().toISOString();
  const bought = Date.parse(gekauftAm);
  if (!Number.isFinite(bought) || bought > Date.now() + 60_000) return new Response(null, { status: 400 });
  delete body.gekauftAm;
  const answers = parseSchnellversionAnswers(body);
  if (!answers) return new Response(null, { status: 400 });
  const pdf = await generateStandardPdf(answers, new Date(bought));
  const row = await saveSvPurchase({
    email,
    company: answers.firma,
    purchasedAt: new Date(bought).toISOString(),
    pdf,
  });
  return Response.json({ ok: true, id: row.id });
}
