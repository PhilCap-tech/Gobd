import { ampelApiResponse, ampelSubmitResponse } from "@/lib/ampel-api-response";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { submitAmpelResult } from "@/lib/ampel-result-send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, client.source);
  }
  if (!body || typeof body !== "object") {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, client.source);
  }
  const value = body as Record<string, unknown>;
  const result = await submitAmpelResult(
    {
      email: value.email,
      answers: value.answers,
      ref: value.ref,
      marketing: value.marketing,
      honeypot: value.fax_number,
      ip: client.ip,
      ipSource: client.source,
      utmSource: typeof value.utm_source === "string" ? value.utm_source : "",
    },
    { handoff: true },
  );
  return ampelSubmitResponse(result, client.source);
}
