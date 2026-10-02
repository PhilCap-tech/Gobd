import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { normalizeProfileName, ProfileNameError } from "@/lib/profile";
import { upsertAccountProfile } from "@/lib/store";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return jsonError("Bitte anmelden.", 401);
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  if (typeof body.name !== "string") {
    return jsonError("Bitte einen Namen angeben.", 400);
  }

  let name: string;
  try {
    name = normalizeProfileName(body.name);
  } catch (error) {
    if (error instanceof ProfileNameError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  try {
    const stored = await upsertAccountProfile(email, name);
    return NextResponse.json({
      ok: true,
      store: stored.backend,
      profile: {
        email: stored.profile.email,
        name: stored.profile.name,
      },
    });
  } catch (error) {
    console.error("[profile] Speichern fehlgeschlagen", error);
    return jsonError(
      error instanceof Error && error.message
        ? error.message
        : "Name konnte nicht gespeichert werden.",
      500,
    );
  }
}
