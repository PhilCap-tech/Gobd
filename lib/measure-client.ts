import { classifyMeasureChannel, type MeasureChannel } from "@/lib/measure-channel";
import { isMeasureTestReferrer, searchHasExplicitTest } from "@/lib/measure-test";

export type MeasurePageHints = {
  channel: MeasureChannel;
  signal?: "grokbot";
  gobd_test?: "1";
};

/**
 * Once this document has seen `?gobd_test=1`, later calls on the same
 * page keep sending it. A URL replace must not drop the marker. This is
 * a variable in the running page, not a cookie and not device storage.
 * It can only add the test flag.
 */
let explicitTestSeen = false;

/** Checks start from a clean page. */
export function resetMeasurePageHintsForTest(): void {
  explicitTestSeen = false;
}

/**
 * Channel class and optional test flag for this page view, held only in
 * the request body. Nothing is written on the device. The click id and
 * the raw referrer are not included.
 */
export function measurePageHints(): MeasurePageHints {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { channel: "unknown" };
  }
  const referrer = typeof document.referrer === "string" ? document.referrer : "";
  const search = typeof window.location?.search === "string" ? window.location.search : "";
  if (searchHasExplicitTest(search)) explicitTestSeen = true;
  const channel = classifyMeasureChannel({ referrer, search });
  const hints: MeasurePageHints = { channel };
  if (isMeasureTestReferrer(referrer)) hints.signal = "grokbot";
  if (explicitTestSeen) hints.gobd_test = "1";
  return hints;
}
