import { NextResponse } from "next/server";
import { readAuditPage } from "@/lib/audit-store";
import { sessionEmailFromRequest } from "@/lib/auth";
import { AUDIT_UNAVAILABLE } from "@/lib/membership-copy";
import { getOwnedEntity } from "@/lib/store";
import { sheetsOutageResponse } from "@/lib/sheets-http";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function getFirmAudit(
  request: Request,
  owned: (entityId: string, email: string) => Promise<boolean> = async (entityId, email) =>
    Boolean(await getOwnedEntity(entityId, email)),
) {
  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId")?.trim() ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  if (!entityId) return jsonError("Kein Zugriff.", 403);
  const email = await sessionEmailFromRequest(request);
  if (!email) return jsonError("Kein Zugriff.", 401);
  let allowed = false;
  try {
    allowed = await owned(entityId, email);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    throw error;
  }
  if (!allowed) return jsonError("Kein Zugriff.", 403);
  try {
    const page = await readAuditPage(entityId, Number.isFinite(offset) ? offset : 0);
    return NextResponse.json(page);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[audit] Liste nicht geladen", error instanceof Error ? error.name : "error");
    return jsonError(AUDIT_UNAVAILABLE, 503);
  }
}

export function GET(request: Request) {
  return getFirmAudit(request);
}
