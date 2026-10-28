import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import type { Entity } from "@/lib/entities";
import { inviteMitwirkende } from "@/lib/membership-invite";
import { planInviteDenial } from "@/lib/plan-access";
import { v3InvitePrepayDenial } from "@/lib/v3-firm-limit";
import { parseModuleIds } from "@/lib/memberships";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { getOwnedEntity } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InviteIo = {
  sessionEmail: (request: Request) => Promise<string | null>;
  ownedEntity: (entityId: string, email: string) => Promise<Entity | null>;
  invite: typeof inviteMitwirkende;
  /** Neues Preismodell: nach Tag 30 (Option 1) keine Einladungen. */
  planDenial?: (email: string) => Promise<string | null>;
};

const defaults: InviteIo = {
  sessionEmail: sessionEmailFromRequest,
  ownedEntity: getOwnedEntity,
  invite: inviteMitwirkende,
  // Neues Modell (CoS 28.10.): erst nach bezahlter Bestellung, danach Sperre nach Tag 30 wie bisher.
  planDenial: async (email) => (await v3InvitePrepayDenial(email)) ?? (await planInviteDenial(email)),
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function statusFor(code: "email" | "self" | "limit" | "active" | "mail" | "entity"): number {
  if (code === "limit" || code === "active") return 409;
  if (code === "entity") return 403;
  if (code === "mail") return 502;
  return 400;
}

/**
 * Einladung durch den Inhaber. Die Antwort enthält den Link nicht.
 */
export async function POST(request: Request) {
  return postInvite(request);
}

export async function postInvite(request: Request, io: InviteIo = defaults) {
  const email = await io.sessionEmail(request);
  if (!email) return jsonError("Bitte anmelden.", 401);

  let body: { entityId?: string; memberEmail?: string; moduleIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.", 400);
  }

  const entityId = body.entityId?.trim() ?? "";
  if (!entityId) return jsonError("Firma fehlt.", 400);
  const moduleIds = parseModuleIds(body.moduleIds ?? []);
  if (!moduleIds) return jsonError("Bitte wählen Sie gültige Module.", 400);

  try {
    const planDenied = io.planDenial ? await io.planDenial(email) : null;
    if (planDenied) return jsonError(planDenied, 403);
    const entity = await io.ownedEntity(entityId, email);
    if (!entity) return jsonError("Kein Zugriff.", 403);
    const result = await io.invite({
      ownerEmail: email,
      entity,
      memberEmail: body.memberEmail ?? "",
      moduleIds,
    });
    if (!result.ok) return jsonError(result.error, statusFor(result.code));
    return NextResponse.json(
      { ok: true, membershipId: result.membershipId, throttled: result.throttled },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[invite] Einladung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return jsonError(
      "Die Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
      500,
    );
  }
}
