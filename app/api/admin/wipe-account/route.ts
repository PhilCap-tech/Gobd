import { NextResponse } from "next/server";
import { handleAdminWipeRequest } from "@/lib/admin-wipe-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/wipe-account
 * Deletes one allowlisted test account. No GET. Does not send mail.
 */
export async function POST(request: Request) {
  const result = await handleAdminWipeRequest(request);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
      ...result.headers,
    },
  });
}
