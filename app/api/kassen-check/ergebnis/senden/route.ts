import { ampelApiResponse, ampelSubmitResponse } from "@/lib/ampel-api-response";
import { AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import { readAmpelClientIp, withAmpelRateIdentity } from "@/lib/ampel-rate-limit";
import { ampelSendTokenPresent } from "@/lib/ampel-send-token";
import { KASSEN_RATE_SCOPE } from "@/lib/kassen-check-questions";
import { scheduleAmpelAfterResponse } from "@/lib/ampel-result-send";
import { completeKassenResult } from "@/lib/kassen-check-send";

export const runtime = "nodejs";

function trace(reason: string, ip: string, source: string) {
  return withAmpelRateIdentity({ kind: "skip", reason }, ip, source, KASSEN_RATE_SCOPE);
}

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, trace("request", client.ip, client.source));
  }
  if (!body || typeof body !== "object") {
    return ampelApiResponse({ error: "Ungültige Anfrage" }, 400, trace("request", client.ip, client.source));
  }
  const value = body as Record<string, unknown>;
  if (!ampelSendTokenPresent(value.send_token)) {
    return ampelApiResponse(
      { error: AMPEL_RESULT_MAIL.sendUnauthorized },
      403,
      trace("token", client.ip, client.source),
    );
  }
  const result = await completeKassenResult(
    {
      email: value.email,
      answers: value.answers,
      ref: value.ref,
      marketing: value.marketing,
      honeypot: value.fax_number,
      ip: client.ip,
      ipSource: client.source,
      sendToken: value.send_token,
    },
    { scheduleAfterSend: scheduleAmpelAfterResponse },
  );
  return ampelSubmitResponse(result);
}
