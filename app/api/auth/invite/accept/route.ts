import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth";
import type { Entity } from "@/lib/entities";
import { acceptInvite, INVITE_LINK_INVALID } from "@/lib/membership-invite";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { getEntity } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Annahme verbraucht den Token einmal und setzt die Sitzung auf die eingeladene Mail.
 */
export async function POST(request: Request) {
  return postAccept(request);
}

export async function postAccept(
  request: Request,
  loadEntity: (entityId: string) => Promise<Entity | null> = getEntity,
) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: INVITE_LINK_INVALID },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json(
      { ok: false, error: INVITE_LINK_INVALID },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const result = await acceptInvite(token, loadEntity);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const response = NextResponse.json(
      { ok: true, entityId: result.entityId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    applySessionCookie(response, result.email);
    return response;
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[invite] Annahme fehlgeschlagen", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { ok: false, error: INVITE_LINK_INVALID },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
