import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  EntityLimitError,
  MAX_ENTITIES_PER_ACCOUNT,
  normalizeEntityInput,
} from "@/lib/entities";
import { createEntity } from "@/lib/store";

export const runtime = "nodejs";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(extra ? { error, ...extra } : { error }, { status });
}

export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
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

  const input = normalizeEntityInput({
    name: body.name ?? "",
    street: body.street,
    zip: body.zip,
    city: body.city,
    stnr: body.stnr,
    ustId: body.ustId,
  });
  if (!input.name) {
    return jsonError("Bitte einen Firmennamen angeben.", 400);
  }

  try {
    const stored = await createEntity(email, input);
    return NextResponse.json({
      ok: true,
      store: stored.backend,
      entity: stored.entity,
    });
  } catch (error) {
    if (error instanceof EntityLimitError) {
      return jsonError(error.message, 409, {
        code: error.code,
        max: MAX_ENTITIES_PER_ACCOUNT,
        count: error.count,
      });
    }
    console.error("[entities] Anlegen fehlgeschlagen", error);
    return jsonError(
      error instanceof Error && error.message
        ? error.message
        : "Firma konnte nicht angelegt werden.",
      500,
    );
  }
}
