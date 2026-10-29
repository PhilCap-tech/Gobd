/**
 * Widerspruch gegen Angebots-Mails (AGB § 12a), Ein-Klick-Abmeldung aus der
 * 7-Tage-Mail (Philip 28.10.).
 *
 * - Token: `<HMAC-ID>.<Signatur>`, beides aus MAGIC_LINK_SECRET mit eigenen
 *   Labels. Die Adresse steht weder im Link noch im Speicher.
 * - Speicher je E-Mail: Blob-Marker `offer-optout/<HMAC-ID>` (dauerhaft,
 *   nie gelöscht) plus, wenn eine Plan-Zeile passt, `offer_opt_out_at`.
 * - GET zeigt nur eine Bestätigungsseite (Link-Scanner melden nicht ab),
 *   POST (auch List-Unsubscribe-Post One-Click) trägt den Widerspruch ein.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readMarker, writeMarker } from "@/lib/blob-marker";
import { getAppUrl, getMagicLinkSecret } from "@/lib/env";
import { logError } from "@/lib/log-error";
import { listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import type { PlanRow } from "@/lib/plan";

const ID_LABEL = "gobd/offer-optout/id/v1";
const SIG_LABEL = "gobd/offer-optout/sig/v1";
export const OFFER_OPTOUT_MARKER_PREFIX = "offer-optout";
export const OFFER_OPTOUT_PAGE = "/angebote/abmelden";
export const OFFER_OPTOUT_API = "/api/angebote/abmelden";

function hmac(label: string, value: string): string {
  return createHmac("sha256", `${label}\n${getMagicLinkSecret()}`).update(value).digest("base64url");
}

/** Feste HMAC-ID je E-Mail (klein geschrieben, getrimmt). */
export function offerOptOutId(email: string): string {
  return hmac(ID_LABEL, email.trim().toLowerCase()).slice(0, 43);
}

export function offerOptOutToken(email: string): string {
  const id = offerOptOutId(email);
  return `${id}.${hmac(SIG_LABEL, id).slice(0, 43)}`;
}

/** HMAC-ID aus einem gültigen Token, sonst null. */
export function verifyOfferOptOutToken(token: string): string | null {
  const [id, sig, extra] = (token ?? "").trim().split(".");
  if (!id || !sig || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const want = Buffer.from(hmac(SIG_LABEL, id).slice(0, 43));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

export function offerOptOutUrls(email: string): { page: string; oneClick: string } {
  const token = encodeURIComponent(offerOptOutToken(email));
  return {
    page: `${getAppUrl()}${OFFER_OPTOUT_PAGE}?token=${token}`,
    oneClick: `${getAppUrl()}${OFFER_OPTOUT_API}?token=${token}`,
  };
}

export function offerOptOutHeaders(email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${offerOptOutUrls(email).oneClick}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type OptOutIo = {
  readMarker: typeof readMarker;
  writeMarker: typeof writeMarker;
  rows: () => Promise<PlanRow[]>;
  saveRow: (row: PlanRow) => Promise<void>;
};

const defaultIo: OptOutIo = { readMarker, writeMarker, rows: listPlanRowsStrict, saveRow: savePlanRow };

/** Widerspruch eintragen (idempotent). */
export async function recordOfferOptOut(
  token: string,
  now: Date = new Date(),
  io: OptOutIo = defaultIo,
): Promise<{ ok: boolean }> {
  const id = verifyOfferOptOutToken(token);
  if (!id) return { ok: false };
  const at = now.toISOString();
  if (!(await io.readMarker(OFFER_OPTOUT_MARKER_PREFIX, id))) {
    await io.writeMarker(OFFER_OPTOUT_MARKER_PREFIX, id, JSON.stringify({ at }));
  }
  try {
    for (const row of await io.rows()) {
      if (!row.offerOptOutAt && offerOptOutId(row.email) === id) {
        await io.saveRow({ ...row, offerOptOutAt: at });
      }
    }
  } catch (error) {
    // Der Marker reicht für den Cron; die Spalte ist nur Zusatz.
    logError("[angebote] Plan-Zeile nicht aktualisiert", error, { level: "warn" });
  }
  return { ok: true };
}

/** Hat diese E-Mail widersprochen (Marker oder Plan-Spalte)? */
export async function hasOfferOptOut(
  row: Pick<PlanRow, "email" | "offerOptOutAt">,
  io: Pick<OptOutIo, "readMarker"> = defaultIo,
): Promise<boolean> {
  if (row.offerOptOutAt?.trim()) return true;
  return Boolean(await io.readMarker(OFFER_OPTOUT_MARKER_PREFIX, offerOptOutId(row.email)));
}
