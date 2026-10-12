import { NextResponse } from "next/server";
import { runLifecycleJob } from "@/lib/kuendigung-apply";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  try {
    const result = await runLifecycleJob(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[kuendigung] Lauf fehlgeschlagen", error);
    return NextResponse.json({ error: "Lauf fehlgeschlagen." }, { status: 500 });
  }
}
