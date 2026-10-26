import { NextResponse } from "next/server";
import { handlePlanAdminAction, handlePlanAdminRequest, PLAN_ADMIN_HEADERS } from "@/lib/plan-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await handlePlanAdminRequest(request);
  return NextResponse.json(result.body, { status: result.status, headers: PLAN_ADMIN_HEADERS });
}

/** Kündigung / Rücknahme per E-Mail erfassen (Kanal `email`). */
export async function POST(request: Request) {
  const result = await handlePlanAdminAction(request);
  return NextResponse.json(result.body, { status: result.status, headers: PLAN_ADMIN_HEADERS });
}
