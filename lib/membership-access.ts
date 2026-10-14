import type { Membership } from "@/lib/memberships";
import { emailsEqual } from "@/lib/types";

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
