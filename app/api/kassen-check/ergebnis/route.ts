import { ampelApiResponse, ampelSubmitResponse } from "@/lib/ampel-api-response";
import { readAmpelClientIp, withAmpelRateIdentity } from "@/lib/ampel-rate-limit";
import { KASSEN_RATE_SCOPE } from "@/lib/kassen-check-questions";
import { submitKassenResult } from "@/lib/kassen-check-send";

export const runtime = "nodejs";

function trace(kind: { kind: "skip"; reason: string }, ip: string, source: string) {
  return withAmpelRateIdentity(kind, ip, source, KASSEN_RATE_SCOPE);
}

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, trace({ kind: "skip", reason: "request" }, client.ip, client.source));
  }
  if (!body || typeof body !== "object") {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, trace({ kind: "skip", reason: "request" }, client.ip, client.source));
  }
  const value = body as Record<string, unknown>;
  const result = await submitKassenResult(
    {
      email: value.email,
      answers: value.answers,
      ref: value.ref,
      marketing: value.marketing,
      honeypot: value.fax_number,
      ip: client.ip,
      ipSource: client.source,
    },
    { handoff: true },
  );
  return ampelSubmitResponse(result);
}
