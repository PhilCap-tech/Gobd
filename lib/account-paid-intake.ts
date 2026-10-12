import { emailsEqual, type SheetRow } from "@/lib/types";

/** Primary action on /account when the purchase has no submitted document yet. */
export const PAID_INTAKE_LABEL = "Verfahrensdokumentation starten";

/** Intake for one paid Checkout Session. Empty when the id is not a safe token. */
export function paidIntakePath(sessionId: string): string {
  const id = sessionId.trim();
  if (!id || id.length > 200 || !/^[A-Za-z0-9_-]+$/.test(id)) return "";
  return `/intake?session_id=${encodeURIComponent(id)}`;
}

/**
 * Path into the paid intake. The session email must be the checkout owner.
 * A client-supplied id is not accepted here; the caller passes the stored row.
 */
export function paidIntakePathForOwner(input: {
  sessionEmail: string;
  ownerEmail: string;
  sessionId: string;
}): string {
  if (!emailsEqual(input.sessionEmail, input.ownerEmail)) return "";
  return paidIntakePath(input.sessionId);
}

function isPaidLike(status: string): boolean {
  const value = status.trim().toLowerCase();
  return (
    value === "paid" ||
    value.startsWith("paid") ||
    value === "intake_submitted" ||
    value === "intake_resubmitted"
  );
}

/**
 * Newest paid checkout for this owner that still has no document id.
 * Rows for another mailbox are ignored.
 */
export function undocumentedPaidSessionId(
  rows: readonly SheetRow[],
  email: string,
): string {
  if (!email.trim()) return "";
  const mine = rows.filter((row) => emailsEqual(row.email, email));
  const documented = new Set(
    mine
      .filter((row) => row.documentId.trim() && row.stripeSessionId.trim())
      .map((row) => row.stripeSessionId.trim()),
  );
  const open = mine
    .filter((row) => {
      const sessionId = row.stripeSessionId.trim();
      return (
        Boolean(sessionId) &&
        isPaidLike(row.status) &&
        !row.documentId.trim() &&
        !documented.has(sessionId)
      );
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return open[0]?.stripeSessionId.trim() ?? "";
}
