import { ampelApiResponse, ampelSubmitResponse } from "@/lib/ampel-api-response";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import { ampelSendTokenPresent } from "@/lib/ampel-send-token";
import { completeAmpelResult } from "@/lib/ampel-result-send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, { kind: "skip", reason: "request" });
  }
  if (!body || typeof body !== "object") {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, { kind: "skip", reason: "request" });
  }
  const value = body as Record<string, unknown>;
  if (!ampelSendTokenPresent(value.send_token)) {
    return ampelApiResponse({ error: AMPEL_RESULT_MAIL.sendUnauthorized }, 403, { kind: "skip", reason: "token" });
  }
  const result = await completeAmpelResult({
    email: value.email,
    answers: value.answers,
    ref: value.ref,
    marketing: value.marketing,
    honeypot: value.fax_number,
    ip: client.ip,
    ipSource: client.source,
    sendToken: value.send_token,
  });
  return ampelSubmitResponse(result);
}
