import { NextResponse } from "next/server";
import { ampelRateResponseHeader, type AmpelRateTrace } from "@/lib/ampel-rate-limit";
import type { SubmitAmpelOutcome } from "@/lib/ampel-result-send";

const unchecked: AmpelRateTrace = { kind: "skip", reason: "unchecked" };

/** Temporary Prod diagnostic. The header names the rate path, never the IP header. */
export function ampelApiResponse(body: unknown, status: number, trace: AmpelRateTrace) {
  return NextResponse.json(body, {
    status,
    headers: { "x-ampel-rl": ampelRateResponseHeader(trace) },
  });
}

export function ampelSubmitResponse(result: SubmitAmpelOutcome) {
  const trace = result.trace ?? unchecked;
  if (!result.ok) {
    return ampelApiResponse({ error: result.error }, result.status, trace);
  }
  if ("honeypot" in result) {
    return ampelApiResponse({ ok: true, honeypot: true }, 200, trace);
  }
  if (result.limited) {
    return ampelApiResponse(
      { ok: true, mailed: false, duplicate: false, notice: result.notice, scope: result.limited },
      429,
      trace,
    );
  }
  return ampelApiResponse(
    {
      ok: true,
      duplicate: result.duplicate,
      marketing: result.marketing,
      mailed: result.mailed,
      ...(result.pending ? { pending: true } : {}),
      ...(result.pending && result.token ? { token: result.token } : {}),
      ...(result.notice ? { notice: result.notice } : {}),
    },
    200,
    trace,
  );
}
