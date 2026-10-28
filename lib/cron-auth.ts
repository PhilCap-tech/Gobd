import { timingSafeEqual } from "node:crypto";

/** Vercel-Cron sendet `Authorization: Bearer <CRON_SECRET>`. Ohne Secret: zu (fail closed). */
export function cronAuthorized(request: Request, secret = process.env.CRON_SECRET?.trim() ?? ""): boolean {
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

