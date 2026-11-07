import { classifyMeasureChannel, type MeasureChannel } from "@/lib/measure-channel";
import { isMeasureTestReferrer } from "@/lib/measure-test";

export type MeasurePageHints = {
  channel: MeasureChannel;
  signal?: "grokbot";
};

/**
 * Channel class for this page view, held only in the request body.
 * Nothing is written on the device. The click id and the raw referrer
 * are not included.
 */
export function measurePageHints(): MeasurePageHints {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { channel: "unknown" };
  }
  const referrer = typeof document.referrer === "string" ? document.referrer : "";
  const search = typeof window.location?.search === "string" ? window.location.search : "";
  const channel = classifyMeasureChannel({ referrer, search });
  if (isMeasureTestReferrer(referrer)) return { channel, signal: "grokbot" };
  return { channel };
}
