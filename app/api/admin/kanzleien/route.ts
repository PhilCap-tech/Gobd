import { NextResponse } from "next/server";
import { adminTokensMatch, bearerTokenFromHeader } from "@/lib/admin-wipe";
import { adminStatsToken } from "@/lib/ampel-admin";
import { setKanzleiBlocked, setKanzleiVerified } from "@/lib/kanzlei-toolbox-flow";
import { listKanzleiRecords, readKanzleiToolbox } from "@/lib/kanzlei-toolbox-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(): Response {
  return new Response(null, { status: 404 });
}

export async function GET(request: Request) {
  const expected = adminStatsToken(process.env.ADMIN_TOKEN);
  const provided = bearerTokenFromHeader(request.headers.get("authorization"));
  if (!expected || !provided || !adminTokensMatch(provided, expected)) return denied();
  const file = await readKanzleiToolbox();
  const records = listKanzleiRecords(file).map((record) => ({
    kanzleiId: record.kanzleiId,
    slug: record.slug,
    displayName: record.displayName,
    email: record.email,
    website: record.website,
    city: record.city,
    status: record.status,
    test: record.test,
    reportOptIn: record.reportOptIn,
    verzeichnisChecked: record.verification.verzeichnisChecked,
    nameInImpressum: record.verification.nameInImpressum,
    note: record.verification.note,
  }));
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const expected = adminStatsToken(process.env.ADMIN_TOKEN);
  const provided = bearerTokenFromHeader(request.headers.get("authorization"));
  if (!expected || !provided || !adminTokensMatch(provided, expected)) return denied();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });
  const value = body as Record<string, unknown>;
  const kanzleiId = typeof value.kanzleiId === "string" ? value.kanzleiId : "";
  if (value.action === "verify") {
    const ok = await setKanzleiVerified(kanzleiId, {
      verzeichnis: value.verzeichnis === true,
      impressumManual: value.impressumManual === true,
    });
    return NextResponse.json({ ok });
  }
  if (value.action === "block") {
    const reason = typeof value.reason === "string" ? value.reason : "";
    const ok = await setKanzleiBlocked(kanzleiId, reason);
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
