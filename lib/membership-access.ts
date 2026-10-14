import type { Membership } from "@/lib/memberships";
import { emailsEqual } from "@/lib/types";

export type FirmAccess =
  | { ok: true; via: "owner" | "membership" }
  | { ok: false; status: 403 };

/**
 * Nächster Zugriff auf genau diese Firma.
 * Der Inhaber bleibt über die eigene Mail berechtigt.
 * Eine Mitwirkende nur, solange die Mitgliedschaft dieser Firma aktiv ist.
 * Widerruf, eine fremde Firma und eine fehlende Zeile antworten 403.
 */
export function firmAccessForSession(input: {
  sessionEmail: string | null | undefined;
  entityOwnerEmail: string | null | undefined;
  entityId: string;
  memberships: ReadonlyArray<Pick<Membership, "status" | "memberEmail" | "entityId">>;
}): FirmAccess {
  const session = (input.sessionEmail ?? "").trim();
  const owner = (input.entityOwnerEmail ?? "").trim();
  const entityId = input.entityId.trim();
  if (session && owner && emailsEqual(session, owner)) {
    return { ok: true, via: "owner" };
  }
  const active = input.memberships.some(
    (row) =>
      row.status === "active" &&
      row.entityId === entityId &&
      emailsEqual(row.memberEmail, session),
  );
  if (active) return { ok: true, via: "membership" };
  return { ok: false, status: 403 };
}

/**
 * Mitwirkende können eine PDF-Fassung weder lesen noch herunterladen.
 * Die eigene Fassung der Sitzungs-Mail bleibt davon unberührt.
 * Eine Mitgliedschaft wird absichtlich nicht als Besitz gewertet.
 */
export function pdfAllowedForMembership(input: {
  sessionEmail: string | null | undefined;
  documentEmail: string | null | undefined;
  documentEntityId: string | null | undefined;
  membership: Pick<Membership, "status" | "memberEmail" | "entityId"> | null;
}): boolean {
  const session = (input.sessionEmail ?? "").trim();
  const owner = (input.documentEmail ?? "").trim();
  const entityId = (input.documentEntityId ?? "").trim();
  const membership = input.membership;
  if (
    membership &&
    membership.status === "active" &&
    membership.entityId === entityId &&
    emailsEqual(membership.memberEmail, session) &&
    !emailsEqual(session, owner)
  ) {
    return false;
  }
  return Boolean(session) && Boolean(owner) && emailsEqual(session, owner);
}
