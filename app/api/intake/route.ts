import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { applySessionCookie, magicLinkUrl } from "@/lib/auth";
import { storePdf } from "@/lib/blob";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import { getAppUrl } from "@/lib/env";
import { sendDeliveryMail } from "@/lib/ops";
import { appendRecord } from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { toSheetRow, type IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

function isAnswers(value: unknown): value is IntakeAnswers {
  if (!value || typeof value !== "object") return false;
  const v = value as IntakeAnswers;
  return (
    Array.isArray(v.branchen) &&
    typeof v.rechtsform === "string" &&
    typeof v.mitarbeitende === "string" &&
    Array.isArray(v.fibu) &&
    typeof v.weitereSysteme === "string" &&
    Array.isArray(v.eingangsbelege) &&
    Array.isArray(v.ausgangsrechnungen) &&
    typeof v.archiv === "string" &&
    typeof v.hosting === "string" &&
    Array.isArray(v.backup) &&
    typeof v.zugriff === "string" &&
    typeof v.gf === "string" &&
    typeof v.buchhaltung === "string" &&
    typeof v.it === "string" &&
    typeof v.steuerberater === "string"
  );
}

async function handleIntake(request: Request) {
  let body: {
    sessionId?: string;
    answers?: unknown;
    email?: string;
    company?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const identity = await resolveCheckoutSession(body.sessionId);
  if ("error" in identity) {
    const message =
      identity.error === "missing"
        ? "Checkout-Session fehlt."
        : identity.error === "not_paid"
          ? "Zahlung noch nicht bestätigt."
          : "Session konnte nicht geprüft werden. Bitte erneut versuchen.";
    return NextResponse.json(
      { error: message, reason: identity.error },
      { status: identity.error === "lookup_failed" ? 503 : 401 },
    );
  }

  if (identity.stub) {
    identity.email = body.email?.trim() || identity.email;
    identity.company = body.company?.trim() || identity.company;
  }

  if (!isAnswers(body.answers)) {
    return jsonError("Intake unvollständig.", 400);
  }

  const answers = body.answers;
  const documentId = randomUUID();
  let delivery: DeliveryPlan;
  let pdfUrl = "";

  try {
    const generated = await generatePdf({ answers, identity, documentId });
    const storedPdf = await storePdf(documentId, generated.buffer);
    pdfUrl = storedPdf.url || storedPdf.pathname;
    delivery = {
      ...generated.plan,
      status: "ready",
      pdf: {
        version: 1,
        documentId,
        url: storedPdf.url,
        pathname: storedPdf.pathname,
        backend: storedPdf.backend,
      },
    };
  } catch (error) {
    console.error("[intake] PDF-Erzeugung fehlgeschlagen", error);
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  let stored;
  try {
    stored = await appendRecord(
      toSheetRow({
        identity,
        answers,
        status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
        deliveryStatus: delivery.status,
        documentId,
        pdfUrl,
        version: "1",
      }),
    );
  } catch (error) {
    console.error("[intake] appendRecord fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }

  const appUrl = getAppUrl();
  const downloadUrl = `${appUrl}/api/docs/${documentId}/download?session_id=${encodeURIComponent(identity.stripeSessionId)}`;
  const successUrl = `${appUrl}/success?session_id=${encodeURIComponent(identity.stripeSessionId)}&document_id=${encodeURIComponent(documentId)}`;
  const magicUrl = identity.email ? magicLinkUrl(identity.email) : undefined;

  try {
    await sendDeliveryMail({
      email: identity.email,
      company: identity.company,
      downloadUrl,
      magicLinkUrl: magicUrl,
      successUrl,
    });
  } catch (error) {
    console.error("[intake] delivery mail fehlgeschlagen", error);
  }

  const response = NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
    documentId,
    pdfUrl: downloadUrl,
  });
  if (identity.email) {
    applySessionCookie(response, identity.email);
  }
  return response;
}

export async function POST(request: Request) {
  try {
    return await handleIntake(request);
  } catch (error) {
    console.error("[intake] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
