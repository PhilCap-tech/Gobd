import { NextRequest } from "next/server";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { parseSchnellversionAnswers } from "@/lib/schnellversion-answers";
import { svDownloadStillOpen } from "@/lib/schnellversion-copy";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { generateStandardPdf } from "@/lib/schnellversion-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 16_000;

export async function POST(request: NextRequest): Promise<Response> {
  if (!schnellversion49Enabled()) return new Response(null, { status: 404 });
  if (parseSvArm(request.cookies.get(SV_ARM_COOKIE)?.value) !== "test") {
    return new Response(null, { status: 404 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new Response(null, { status: 400 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object") return new Response(null, { status: 400 });
  const body = parsed as Record<string, unknown>;
  const gekauftAm = typeof body.gekauftAm === "string" ? body.gekauftAm : "";
  if (gekauftAm && !svDownloadStillOpen(gekauftAm, new Date())) {
    return new Response("Der PDF-Download ist 30 Tage ab Kauf abrufbar.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  delete body.gekauftAm;
  const answers = parseSchnellversionAnswers(body);
  if (!answers) return new Response(null, { status: 400 });
  const erstelltAm = gekauftAm ? new Date(gekauftAm) : new Date();
  const buffer = await generateStandardPdf(answers, erstelltAm);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=\"standardfassung.pdf\"",
      "cache-control": "no-store",
    },
  });
}
