import { NextResponse } from "next/server";
import { handlePlanAdminRequest, PLAN_ADMIN_HEADERS } from "@/lib/plan-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await handlePlanAdminRequest(request);
  return NextResponse.json(result.body, { status: result.status, headers: PLAN_ADMIN_HEADERS });
}
