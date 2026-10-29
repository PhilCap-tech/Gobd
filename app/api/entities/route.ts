import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { firmaAnlegenAllowed } from "@/lib/comp-access";
import {
  EntityLimitError,
  MAX_ENTITIES_PER_ACCOUNT,
  customerFacingSaveError,
  normalizeEntityInput,
} from "@/lib/entities";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { createEntity, getEntity, listEntitiesByEmail, updateEntity } from "@/lib/store";
import { v3OwnerLockDenial } from "@/lib/plan-access";
import { isPricingV2 } from "@/lib/pricing-model";
import { v3FirmDenial } from "@/lib/v3-firm-limit";
import { logError } from "@/lib/log-error";

export const runtime = "nodejs";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(extra ? { error, ...extra } : { error }, { status });
}

function parseEntityBody(body: {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  stnr?: string;
  ustId?: string;
}) {
  return normalizeEntityInput({
    name: body.name ?? "",
    street: body.street,
    zip: body.zip,
    city: body.city,
    stnr: body.stnr,
    ustId: body.ustId,
  });
}

export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!firmaAnlegenAllowed(email)) {
    return jsonError("Bitte anmelden.", 401);
  }

  let body: {
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
    stnr?: string;
    ustId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const input = parseEntityBody(body);
  if (!input.name) {
    return jsonError("Bitte einen Firmennamen angeben.", 400);
  }

  // Neues Modell: gesperrtes Konto (Tag 30 / erstattet) legt keine Firma an (vor dem Firmenlimit).
  try {
    const locked = await v3OwnerLockDenial(email);
    if (locked) return jsonError(locked, 403);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    throw error;
  }

  // Neues Modell (Philip 28.10.): eine Firma je v3-Konto.
  if (isPricingV2()) {
    try {
      const denial = await v3FirmDenial(email, (await listEntitiesByEmail(email)).length);
      if (denial) return jsonError(denial, 409);
    } catch (error) {
      logError("[firma] Firmenanzahl nicht geprüft", error, { level: "warn" });
    }
  }

  try {
    const stored = await createEntity(email, input, { checkoutPrefill: "done" });
    return NextResponse.json({
      ok: true,
      store: stored.backend,
      entity: stored.entity,
    });
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    if (error instanceof EntityLimitError) {
      return jsonError(error.message, 409, {
        code: error.code,
        max: MAX_ENTITIES_PER_ACCOUNT,
        count: error.count,
      });
    }
    logError("[entities] Anlegen fehlgeschlagen", error);
    return jsonError(
      customerFacingSaveError(
        error,
        "Die Firma konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
      ),
      500,
    );
  }
}

export async function PATCH(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return jsonError("Bitte anmelden.", 401);
  }

  let body: {
    entityId?: string;
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
    stnr?: string;
    ustId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const entityId = body.entityId?.trim() ?? "";
  if (!entityId) {
    return jsonError("Firma fehlt.", 400);
  }

  const input = parseEntityBody(body);
  if (!input.name) {
    return jsonError("Bitte einen Firmennamen angeben.", 400);
  }

  try {
    // Neues Modell: Stammdaten nur bei offenem Plan des Firmen-Inhabers.
    if (isPricingV2()) {
      const current = await getEntity(entityId);
      if (current) {
        const locked = await v3OwnerLockDenial(current.userEmail);
        if (locked) return jsonError(locked, 403);
      }
    }
    const entity = await updateEntity(entityId, input, email, { checkoutPrefill: "done" });
    if (!entity) {
      return jsonError("Firma nicht gefunden.", 404);
    }
    return NextResponse.json({
      ok: true,
      entity,
    });
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    logError("[entities] Speichern fehlgeschlagen", error);
    return jsonError(
      customerFacingSaveError(
        error,
        "Die Firma konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      ),
      500,
    );
  }
}
