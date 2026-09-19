import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { loadReadinessPdf } from "@/lib/blob";
import { normalizeQueryId } from "@/lib/query";
import {
  canAccessReadinessLead,
  readinessPdfDownloadName,
} from "@/lib/readiness";
import { findReadinessLeadById } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = normalizeQueryId(url.searchParams.get("token"));
  const sessionEmail = await getSessionEmail();
  const lead = await findReadinessLeadById(id);

  if (!lead) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }

  const allowed = canAccessReadinessLead(lead, {
    email: sessionEmail,
    token,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 401 });
  }

  try {
    const buffer = await loadReadinessPdf(lead);
    const filename = readinessPdfDownloadName(lead);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[readiness] PDF-Download fehlgeschlagen", error);
    return NextResponse.json(
      { error: "PDF konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
