import { NextResponse } from "next/server";
import { handleAmpelStatsRequest } from "@/lib/ampel-admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await handleAmpelStatsRequest(request);
  const response = NextResponse.json(result.body, { status: result.status });
  for (const [key, value] of Object.entries(result.headers)) {
    response.headers.set(key, value);
  }
  return response;
}
