import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { deleteStoredBlob, persistIntakePayload, resolveIntakePayload, storePdf } from "@/lib/blob";
import { intakePayloadLocator } from "@/lib/intake-payload";
import { generatePdf } from "@/lib/delivery";
import {
  isMailConfigured,
  isSheetsConfigured,
  isStripeConfigured,
  isStripeSecretConfigured,
} from "@/lib/env";
import { appendRecord } from "@/lib/store";
import { emptyAnswers, toSheetRow, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Preview-build only. The postbuild child sets GOBD_BLOB_SMOKE=1 and strips
 * Sheets, Stripe and mail. A real preview or production process still has
 * those credentials, so this route stays closed there and cannot write
 * customer rows or send mail.
 */
const SMOKE_EMAIL = "pdf-blob-smoke@example.com";

export function blobSmokeEnabled(): boolean {
  if (process.env.GOBD_BLOB_SMOKE !== "1") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (isSheetsConfigured() || isMailConfigured()) return false;
  if (isStripeConfigured() || isStripeSecretConfigured()) return false;
  return true;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function smokeAnswers(): IntakeAnswers {
  const answers = emptyAnswers();
  answers.branchen = ["Handel"];
  answers.rechtsform = "GmbH";
  answers.mitarbeitende = "3";
  answers.fibu = ["lexoffice"];
  answers.eingangsbelege = ["mail"];
  answers.ausgangsrechnungen = ["tool"];
  answers.archiv = "cloud";
  answers.hosting = "vercel";
  answers.backup = ["taeglich"];
  answers.zugriff = "gf";
  answers.gf = "Ada Beispiel";
  answers.buchhaltung = "intern";
  answers.it = "extern";
  answers.steuerberater = "Kanzlei Nord";
  return answers;
}

function smokePathAllowed(pathname: string): boolean {
  if (!pathname.startsWith("gobd/") || pathname.includes("..") || pathname.includes("\\")) {
    return false;
  }
  if (pathname.startsWith("gobd/uploads/pdf-blob-smokeexamplecom/")) return true;
  if (/^gobd\/smoke-[A-Za-z0-9-]+\/[A-Za-z0-9-]+\/v\d+-answers\.json$/.test(pathname)) {
    return true;
  }
  return /^gobd\/smoke-[A-Za-z0-9-]+\/v\d+\.pdf$/.test(pathname);
}

async function createSmokePdf(email: string) {
  const documentId = randomUUID();
  const familyId = `smoke-${documentId}`;
  const identity = {
    email,
    company: "Smoke GmbH",
    stripeSessionId: "",
    stripeCustomerId: "",
    stub: true,
  };
  const generated = await generatePdf({
    answers: smokeAnswers(),
    identity,
    documentId,
    version: 1,
  });
  const stored = await storePdf({
    familyId,
    documentId,
    version: 1,
    buffer: generated.buffer,
  });
  const legacyUrl = `https://smokestore.public.blob.vercel-storage.com/${stored.pathname}`;
  await appendRecord(
    toSheetRow({
      identity,
      answers: smokeAnswers(),
      status: "blob_smoke",
      deliveryStatus: "ready",
      documentId,
      parentDocumentId: familyId,
      pdfUrl: legacyUrl,
      version: "1",
    }),
  );
  return {
    ok: true as const,
    backend: stored.backend,
    documentId,
    pathname: stored.pathname,
    reference: "legacy-url" as const,
    sha256: createHash("sha256").update(generated.buffer).digest("hex"),
  };
}

async function roundtripSmokeAnswers() {
  const documentId = randomUUID();
  const familyId = `smoke-${documentId}`;
  const marker = "ANTWORT-ANFANG";
  const end = "ANTWORT-ENDE";
  const json = JSON.stringify({
    katalog: {
      B01: {
        status: "bestaetigt",
        values: {
          a: `${marker}${"A".repeat(20_000)}`,
          b: `${"B".repeat(20_000)}${end}`,
          c: "C".repeat(12_000),
        },
      },
    },
  });
  if (json.length <= 50_000) {
    throw new Error("Antwort-Fixture ist zu kurz");
  }
  const stored = await persistIntakePayload(
    { familyId, documentId, version: 1, json },
    undefined,
    { requireBlob: true },
  );
  const loaded = await resolveIntakePayload(stored);
  if (loaded !== json) {
    throw new Error("Antwort-Roundtrip weicht ab");
  }
  const ref = intakePayloadLocator(stored);
  if (!ref?.locator.endsWith("-answers.json")) {
    throw new Error("Antwort-Pfad fehlt");
  }
  return {
    ok: true as const,
    pathname: ref.locator,
    chars: json.length,
    sha256: createHash("sha256").update(json).digest("hex"),
  };
}

export async function POST(request: Request) {
  if (!blobSmokeEnabled()) {
    return jsonError("Nicht gefunden.", 404);
  }
  const sessionEmail = (await getSessionEmail())?.trim().toLowerCase() ?? "";
  if (!sessionEmail) return jsonError("Kein Zugriff.", 401);
  if (sessionEmail !== SMOKE_EMAIL) return jsonError("Kein Zugriff.", 403);

  let body: { action?: string; pathnames?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  if (body.action === "delete") {
    const pathnames = Array.isArray(body.pathnames)
      ? body.pathnames.filter((item): item is string => typeof item === "string")
      : [];
    if (pathnames.length === 0 || pathnames.some((item) => !smokePathAllowed(item))) {
      return jsonError("Pfad nicht erlaubt.", 400);
    }
    for (const pathname of pathnames) {
      await deleteStoredBlob(pathname);
    }
    return NextResponse.json({ ok: true, deleted: pathnames.length });
  }

  if (body.action === "answers") {
    try {
      const created = await roundtripSmokeAnswers();
      return NextResponse.json(created);
    } catch (error) {
      console.error(
        "[blob-smoke] Antworten fehlgeschlagen",
        error instanceof Error ? error.name : "Unknown",
      );
      return jsonError("Antworten konnten nicht gespeichert werden.", 503);
    }
  }

  if (body.action === "pdf") {
    try {
      const created = await createSmokePdf(sessionEmail);
      return NextResponse.json(created);
    } catch (error) {
      console.error(
        "[blob-smoke] PDF fehlgeschlagen",
        error instanceof Error ? error.name : "Unknown",
      );
      return jsonError("PDF konnte nicht gespeichert werden.", 503);
    }
  }

  return jsonError("Unbekannte Aktion.", 400);
}
