/**
 * Idempotent POST /api/intake.
 *
 * The client sends one `submitId` per submit (reused by every retry). The
 * server derives the document id from it with an HMAC over the owner email,
 * keyed with the existing MAGIC_LINK_SECRET. A retry therefore lands on the
 * same document id: an existing row is answered again instead of written
 * twice, and the mail keys `delivery:<doc>:<version>` / owner notice
 * `doc:<doc>:<version>` stay the same, so the mail ledger sends each once.
 *
 * A Blob claim (`allowOverwrite: false`) keeps two parallel requests with the
 * same id from both writing. It is marked released (overwritten, never
 * deleted) when the request fails before the row is stored, and kept
 * afterwards (it carries the mail plan for a replay). A claim may be taken
 * over only once CLAIM_STALE_MS has passed, which is longer than the route's
 * maxDuration, so the request that held it can no longer be running. The
 * route checks for an existing row before every appendRecord anyway.
 * Markers older than MARKER_TTL_MS (7 days) are treated as absent.
 */
import { createHmac } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import { createMarker, markerExpired, readMarker, writeMarker } from "@/lib/blob-marker";

const PREFIX = "intake-submit";
/** Must match `export const maxDuration` in app/api/intake/route.ts (check:intake-idempotent). */
export const INTAKE_ROUTE_MAX_DURATION_S = 60;
/** Function runtime plus a minute of margin: the holder is gone by then. */
export const CLAIM_STALE_MS = (INTAKE_ROUTE_MAX_DURATION_S + 60) * 1000;

const SUBMIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client submit id is a UUID. Anything else is ignored (old behaviour). */
export function normalizeSubmitId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim().toLowerCase();
  return SUBMIT_ID.test(id) ? id : "";
}

/** Server-side document id for one submit of one owner. UUID-shaped. */
export function submitDocumentId(ownerEmail: string, submitId: string): string {
  const hex = createHmac("sha256", getMagicLinkSecret())
    .update(`intake-submit:v1:${ownerEmail.trim().toLowerCase()}:${submitId}`)
    .digest("hex");
  const variant = ((parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export type SubmitClaim = "claimed" | "busy";

/**
 * What the first request decided after the commit. No address or company:
 * a replay takes those from the stored row.
 */
export type SubmitPlan = {
  deliveryMail: boolean;
  /** Owner notice „Doku abgeschlossen“; null for a test company. */
  notice: { mode: "live" | "test"; access: string } | null;
  firstDelivery: boolean;
  stub: boolean;
};

type ClaimBody = {
  documentId: string;
  at: string;
  plan?: SubmitPlan;
  /** The append failed and nobody knows whether the row landed. */
  unsure?: boolean;
  /** Failed before any row: free to claim again. */
  released?: boolean;
};

/** Parsed marker, or null when missing, unreadable or older than 7 days. */
function parseClaim(raw: string | null, now = Date.now()): ClaimBody | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClaimBody;
    if (!parsed || typeof parsed !== "object") return null;
    return markerExpired(parsed.at, now) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Claim one document id. The marker stays after the row is stored, so a
 * replay can read the plan; it is marked released when the request fails first.
 */
export async function claimIntakeSubmit(
  documentId: string,
  plan: SubmitPlan,
  now = Date.now(),
): Promise<SubmitClaim> {
  const body = JSON.stringify({ documentId, at: new Date(now).toISOString(), plan });
  if ((await createMarker(PREFIX, documentId, body)) === "created") return "claimed";
  const existing = parseClaim(await readMarker(PREFIX, documentId), now);
  const at = Date.parse(existing?.at ?? "");
  // Released / unsure / expired: no request holds it any more. Otherwise only
  // after the holder's maxDuration has certainly run out.
  const free = !existing || existing.unsure || existing.released;
  if (!free && Number.isFinite(at) && now - at < CLAIM_STALE_MS) return "busy";
  await writeMarker(PREFIX, documentId, body);
  return "claimed";
}

/** The append threw and the row could not be checked: keep the id, free the claim. */
export async function markSubmitUnsure(documentId: string, plan: SubmitPlan, now = Date.now()): Promise<void> {
  await writeMarker(
    PREFIX,
    documentId,
    JSON.stringify({ documentId, at: new Date(now).toISOString(), plan, unsure: true }),
  );
}

export async function readSubmitPlan(documentId: string, now = Date.now()): Promise<SubmitPlan | null> {
  const claim = parseClaim(await readMarker(PREFIX, documentId), now);
  if (!claim || claim.released) return null;
  return claim.plan ?? null;
}

/** Failure before the row: mark free. The marker is overwritten, not deleted. */
export async function releaseIntakeSubmit(documentId: string, now = Date.now()): Promise<void> {
  await writeMarker(
    PREFIX,
    documentId,
    JSON.stringify({ documentId, at: new Date(now).toISOString(), released: true }),
  );
}
