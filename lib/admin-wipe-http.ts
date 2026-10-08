import {
  adminTokensMatch,
  adminWipeToken,
  bearerTokenFromHeader,
  parseWipeEmail,
  resolveDryRun,
  safeErrorMessage,
} from "@/lib/admin-wipe";
import { wipeAccount } from "@/lib/admin-wipe-run";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

export function resetAdminWipeRateLimit(): void {
  hits.clear();
}

export function allowAdminWipeRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 80);
}

export type AdminWipeHttpResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export async function handleAdminWipeRequest(
  request: Request,
  deps: {
    wipe?: (input: { email: string; dryRun: boolean }) => Promise<unknown>;
  } = {},
): Promise<AdminWipeHttpResult> {
  if (request.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const expected = adminWipeToken(process.env.ADMIN_WIPE_TOKEN);
  if (!expected) {
    return { status: 404, body: { error: "Not found" } };
  }

  if (!allowAdminWipeRequest(clientKey(request))) {
    return {
      status: 429,
      body: { error: "Zu viele Anfragen." },
      headers: { "Retry-After": "60" },
    };
  }

  const provided = bearerTokenFromHeader(request.headers.get("authorization"));
  if (!provided || !adminTokensMatch(provided, expected)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  let text = "";
  try {
    text = await request.text();
  } catch {
    return { status: 400, body: { error: "Ungültige Anfrage." } };
  }
  if (text.length > 8_000) {
    return { status: 400, body: { error: "Ungültige Anfrage." } };
  }

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { status: 400, body: { error: "Ungültige Anfrage." } };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, body: { error: "Ungültige Anfrage." } };
  }

  const record = body as { email?: unknown; dryRun?: unknown };
  const email = parseWipeEmail(record.email);
  if (!email.ok) {
    if (email.reason === "forbidden") {
      return { status: 403, body: { error: "Diese E-Mail ist nicht zum Löschen freigegeben." } };
    }
    return { status: 400, body: { error: "E-Mail fehlt oder ist ungültig." } };
  }

  const dryRun = resolveDryRun(record.dryRun);
  const wipe = deps.wipe ?? wipeAccount;
  try {
    const result = await wipe({ email: email.email, dryRun });
    return { status: 200, body: result };
  } catch (error) {
    let message = safeErrorMessage(error);
    message = message.split(expected).join("[redacted]");
    console.error("[admin-wipe] fehlgeschlagen", message);
    return { status: 500, body: { error: "Löschen fehlgeschlagen.", detail: message } };
  }
}
