import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import type { Entity } from "@/lib/entities";
import { revokeMitwirkende } from "@/lib/membership-invite";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { getOwnedEntity } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevokeIo = {
  sessionEmail: (request: Request) => Promise<string | null>;
  ownedEntity: (entityId: string, email: string) => Promise<Entity | null>;
  revoke: typeof revokeMitwirkende;
};

const defaults: RevokeIo = {
  sessionEmail: sessionEmailFromRequest,
  ownedEntity: getOwnedEntity,
  revoke: revokeMitwirkende,
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Widerruf durch den Inhaber. Die Antwort enthält keinen Token.
 */
export async function POST(request: Request) {
  return postRevoke(request);
}

export async function postRevoke(request: Request, io: RevokeIo = defaults) {
  const email = await io.sessionEmail(request);
  if (!email) return jsonError("Bitte anmelden.", 401);

  let body: { entityId?: string; membershipId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.", 400);
  }

  const entityId = body.entityId?.trim() ?? "";
  const membershipId = body.membershipId?.trim() ?? "";
  if (!entityId || !membershipId) return jsonError("Angaben fehlen.", 400);

  try {
    const entity = await io.ownedEntity(entityId, email);
    if (!entity) return jsonError("Kein Zugriff.", 403);
    const result = await io.revoke({
      ownerEmail: email,
      entity,
      membershipId,
    });
    if (!result.ok) {
      const status = result.code === "entity" ? 403 : 404;
      return jsonError(result.error, status);
    }
    return NextResponse.json(
      {
        ok: true,
        membershipId: result.membershipId,
        mailed: result.mailed,
        already: result.already,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[invite] Widerruf fehlgeschlagen", error instanceof Error ? error.name : "error");
    return jsonError(
      "Der Zugriff konnte nicht entzogen werden. Bitte versuchen Sie es erneut.",
      500,
    );
  }
}
