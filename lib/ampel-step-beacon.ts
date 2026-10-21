import {
  ampelSubmitResultStatus,
  isKnownAmpelStepVariant,
  type AmpelStepResultStatus,
} from "@/lib/ampel-step-event";
import { sanitizeVariantValue } from "@/lib/campaign-params";

export type AmpelStepClientEvent =
  | { event: "ampel_q_view"; n: number }
  | { event: "ampel_q_answer"; n: number }
  | { event: "ampel_email_view" }
  | { event: "ampel_submit_click"; valid: boolean }
  | { event: "ampel_submit_result"; status: AmpelStepResultStatus }
  | { event: "consent_choice"; choice: "accept" | "reject" };

const seenQuestionViews = new Set<number>();
let emailViewArmed = true;

function variantField(): { v: string } | Record<string, never> {
  if (typeof window === "undefined") return {};
  const variant = sanitizeVariantValue(new URLSearchParams(window.location.search).get("v"));
  if (!variant || !isKnownAmpelStepVariant(variant)) return {};
  return { v: variant };
}

/** Beacon first. fetch keepalive covers browsers that refuse the beacon. */
export function sendAmpelStep(event: AmpelStepClientEvent): void {
  try {
    const payload = JSON.stringify({ ...event, ...variantField() });
    const url = "/api/ampel/step";
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The Ampel check continues when the beacon cannot be sent.
  }
}

/** One view per question for this page load. A plain in-memory set, no storage. */
export function sendAmpelQuestionView(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 10 || seenQuestionViews.has(n)) return;
  seenQuestionViews.add(n);
  sendAmpelStep({ event: "ampel_q_view", n });
}

export function sendAmpelEmailView(): void {
  if (!emailViewArmed) return;
  emailViewArmed = false;
  sendAmpelStep({ event: "ampel_email_view" });
}

export function armAmpelEmailView(): void {
  emailViewArmed = true;
}

export function noteAmpelSubmitResult(status: number, pending = false, timedOut = false): void {
  const mapped = ampelSubmitResultStatus({ status, pending, timedOut });
  if (!mapped) return;
  sendAmpelStep({ event: "ampel_submit_result", status: mapped });
}

export function sendAmpelConsentChoice(choice: "accept" | "reject"): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/ampel-check") return;
  sendAmpelStep({ event: "consent_choice", choice });
}
