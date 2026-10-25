import { magnetStepNumber, type MagnetId } from "@/lib/vorlagen/ids";

type MagnetBeacon =
  | { event: "magnet_view" | "magnet_calc_used" | "magnet_gate_view"; n: number }
  | { event: "magnet_submit_click"; n: number; valid: boolean }
  | { event: "magnet_submit_result"; n: number; status: "ok" | "400" | "429" | "5xx" | "timeout" }
  | { event: "magnet_doi_confirmed"; n: number; status: "ok" | "expired" }
  | { event: "consent_choice"; choice: "accept" | "reject"; n?: number };

const seen = new Set<string>();

export function magnetBeaconNumber(magnet: MagnetId): number {
  return Number(magnetStepNumber(magnet));
}

/** Beacon first. fetch keepalive covers browsers that refuse it. No storage. */
export function sendMagnetStep(event: MagnetBeacon): void {
  try {
    const payload = JSON.stringify(event);
    if (new TextEncoder().encode(payload).byteLength > 512) return;
    const url = "/api/magnet/step";
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
    // The page stays usable when the beacon cannot be sent.
  }
}

export function sendMagnetView(magnet: MagnetId): void {
  const key = `view:${magnet}`;
  if (seen.has(key)) return;
  seen.add(key);
  sendMagnetStep({ event: "magnet_view", n: magnetBeaconNumber(magnet) });
}

export function sendMagnetCalcUsed(magnet: MagnetId): void {
  const key = `calc:${magnet}`;
  if (seen.has(key)) return;
  seen.add(key);
  sendMagnetStep({ event: "magnet_calc_used", n: magnetBeaconNumber(magnet) });
}

export function sendMagnetGateView(magnet: MagnetId): void {
  const key = `gate:${magnet}`;
  if (seen.has(key)) return;
  seen.add(key);
  sendMagnetStep({ event: "magnet_gate_view", n: magnetBeaconNumber(magnet) });
}

export function sendMagnetConsentChoice(choice: "accept" | "reject"): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/vorlagen")) return;
  const n =
    path.endsWith("/kostenrechner") ? 1 : path.endsWith("/checkliste-kassen-nachschau") ? 2 : path.endsWith("/gliederung-verfahrensdoku") ? 3 : undefined;
  sendMagnetStep(n ? { event: "consent_choice", choice, n } : { event: "consent_choice", choice });
}
