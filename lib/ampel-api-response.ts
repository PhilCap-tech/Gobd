import { NextResponse } from "next/server";
import {
  AMPEL_IP_WINDOW_MS,
  ampelRateResponseHeader,
  ampelRateWindowId,
  type AmpelRateTrace,
} from "@/lib/ampel-rate-limit";
import type { SubmitAmpelOutcome } from "@/lib/ampel-result-send";

/** Temporary Prod diagnostic. Remove once the IP limit is confirmed on Prod. */
export function ampelApiResponse(
  body: unknown,
  status: number,
  source: string,
  trace?: AmpelRateTrace,
  now = Date.now(),
) {
  const header = trace
    ? ampelRateResponseHeader(trace.src, trace.slot, trace.win)
    : ampelRateResponseHeader(source, 0, ampelRateWindowId(now, AMPEL_IP_WINDOW_MS));
  return NextResponse.json(body, {
    status,
    headers: { "x-ampel-rl": header },
  });
}

export function ampelSubmitResponse(result: SubmitAmpelOutcome, source: string, now = Date.now()) {
  if (!result.ok) {
    return ampelApiResponse({ error: result.error }, result.status, source, result.trace, now);
  }
  if ("honeypot" in result) {
    return ampelApiResponse({ ok: true, honeypot: true }, 200, source, result.trace, now);
  }
  if (result.limited) {
    return ampelApiResponse(
      { ok: true, mailed: false, duplicate: false, notice: result.notice, scope: result.limited },
      429,
      source,
      result.trace,
      now,
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
    source,
    result.trace,
    now,
  );
}
