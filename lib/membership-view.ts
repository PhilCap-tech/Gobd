import { getSessionEmail } from "@/lib/auth";
import {
  memberFirmView,
  type MemberFirmView,
} from "@/lib/membership-draft";
import {
  findActiveMembership,
  listMembershipsByMember,
} from "@/lib/membership-store";
import type { Membership } from "@/lib/memberships";
import { getEntity } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

/** Aktive Mitgliedschaften der Sitzung, ohne Steuernummer und ohne fremde Firmen. */
export async function loadMemberFirms(sessionEmail: string): Promise<MemberFirmView[]> {
  let rows: Awaited<ReturnType<typeof listMembershipsByMember>> = [];
  try {
    rows = await listMembershipsByMember(sessionEmail, { fresh: true });
  } catch (error) {
    console.error(
      "[account] Mitwirkung nicht geladen",
      error instanceof Error ? error.name : "error",
    );
    return [];
  }
  const cards: MemberFirmView[] = [];
  for (const row of rows) {
    if (row.status !== "active") continue;
    if (emailsEqual(row.ownerEmail, sessionEmail)) continue;
    try {
      const entity = await getEntity(row.entityId);
      if (!entity || !emailsEqual(entity.userEmail, row.ownerEmail)) continue;
      cards.push(memberFirmView(entity, row.invitedBy || row.ownerEmail));
    } catch (error) {
      console.error(
        "[account] Firma der Mitwirkung nicht geladen",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  return cards;
}

export type MitwirkungContext =
  | { kind: "anon" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "ok"; email: string; membership: Membership; firm: MemberFirmView };

/** Sicht der Mitwirkenden auf genau eine Firma. Steuernummer bleibt auf dem Server. */
export async function loadMitwirkung(entityId: string): Promise<MitwirkungContext> {
  const email = await getSessionEmail();
  if (!email) return { kind: "anon" };
  try {
    const membership = await findActiveMembership(email, entityId);
    if (!membership) return { kind: "denied" };
    const entity = await getEntity(entityId);
    if (!entity || !emailsEqual(entity.userEmail, membership.ownerEmail)) return { kind: "denied" };
    return {
      kind: "ok",
      email,
      membership,
      firm: memberFirmView(entity, membership.invitedBy || membership.ownerEmail),
    };
  } catch (error) {
    console.error(
      "[account] Mitwirkung nicht geladen",
      error instanceof Error ? error.name : "error",
    );
    return { kind: "unavailable" };
  }
}
