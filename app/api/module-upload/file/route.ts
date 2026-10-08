import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  BlobStorageError,
  blobFailureClass,
  canAccessCustomerUpload,
  readCustomerUpload,
} from "@/lib/blob";
import { normalizeQueryId } from "@/lib/query";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Authenticated download for a customer upload.
 * `ref` is a `gobd/uploads/...` pathname, a legacy public Blob URL, or a
 * local demo path. The Blob host is never contacted from the browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref")?.trim() ?? "";
  const sessionId = normalizeQueryId(url.searchParams.get("session_id"));
  const sessionEmail = await getSessionEmail();
  if (!ref) return jsonError("Datei fehlt.", 400);

  const access = await canAccessCustomerUpload(ref, { sessionEmail, sessionId });
  if (access === "anonymous") return jsonError("Kein Zugriff.", 401);
  if (access === "forbidden") return jsonError("Kein Zugriff.", 403);

  try {
    const file = await readCustomerUpload(ref);
    if (!file) return jsonError("Datei nicht gefunden.", 404);
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[upload] Lesen fehlgeschlagen", blobFailureClass(error));
    return jsonError(
      "Datei konnte nicht geladen werden.",
      error instanceof BlobStorageError ? 503 : 500,
    );
  }
}
