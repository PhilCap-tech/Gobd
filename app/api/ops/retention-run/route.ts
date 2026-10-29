import { NextResponse } from "next/server";
import { handleRetentionRunRequest, PLAN_ADMIN_HEADERS } from "@/lib/plan-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lösch-Lauf: immer Trockenlauf (zählt nur). Bearer RETENTION_RUN_TOKEN. */
export async function POST(request: Request) {
  const result = await handleRetentionRunRequest(request);
  return NextResponse.json(result.body, { status: result.status, headers: PLAN_ADMIN_HEADERS });
}
