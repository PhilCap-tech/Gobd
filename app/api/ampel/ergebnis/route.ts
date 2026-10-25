import { ampelApiResponse, ampelSubmitResponse } from "@/lib/ampel-api-response";
import { readAmpelClientIp, withAmpelRateIdentity } from "@/lib/ampel-rate-limit";
import { submitAmpelResult } from "@/lib/ampel-result-send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ampelApiResponse(
      { error: "Ungültige Anfrage" },
      400,
      withAmpelRateIdentity({ kind: "skip", reason: "request" }, client.ip, client.source),
    );
  }
  if (!body || typeof body !== "object") {
    return ampelApiResponse(
      { error: "Ungültige Anfrage" },
      400,
      withAmpelRateIdentity({ kind: "skip", reason: "request" }, client.ip, client.source),
    );
  }
  const value = body as Record<string, unknown>;
  const result = await submitAmpelResult(
    {
      email: value.email,
      answers: value.answers,
      ref: value.ref,
      marketing: value.marketing,
      honeypot: value.fax_number,
      utmSource: value.utm_source,
      utmCampaign: value.utm_campaign,
      src: value.src,
      variant: value.v,
      kanzlei: value.kanzlei,
      ip: client.ip,
      ipSource: client.source,
    },
    { handoff: true },
  );
  return ampelSubmitResponse(result);
}
