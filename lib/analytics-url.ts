import { urlMentionsTestEntity } from "@/lib/test-entities";

type AnalyticsEvent = {
  type: string;
  url: string;
};

const SENSITIVE_KEYS = new Set([
  "token",
  "email",
  "e-mail",
  "mail",
  "session_id",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "api_key",
  "apikey",
]);

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const NESTED_SECRET =
  /(?:^|[?&#])(token|email|e-mail|mail|session_id|access_token|refresh_token|id_token|secret|api_key|apikey)=/i;

function decodeRepeated(value: string): string {
  let current = value;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(current.replace(/\+/g, " "));
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function isSensitive(key: string, value: string): boolean {
  if (SENSITIVE_KEYS.has(key.toLowerCase()) || EMAIL.test(key)) return true;
  const decoded = decodeRepeated(value);
  return EMAIL.test(value) || EMAIL.test(decoded) || NESTED_SECRET.test(decoded);
}

/** Page URL for Vercel Web Analytics, without query secrets or a fragment. */
export function sanitizeAnalyticsUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hashless = trimmed.split("#")[0] ?? "";
  let url: URL;
  try {
    url = new URL(hashless, "https://www.gobd-doku-erstellen.de");
  } catch {
    return null;
  }
  for (const key of [...url.searchParams.keys()]) {
    const values = url.searchParams.getAll(key);
    if (values.some((value) => isSensitive(key, value))) url.searchParams.delete(key);
  }
  url.hash = "";
  const absolute = /^https?:\/\//i.test(trimmed);
  const result = absolute ? `${url.origin}${url.pathname}${url.search}` : `${url.pathname}${url.search}`;
  if (EMAIL.test(decodeRepeated(result)) || NESTED_SECRET.test(result)) return null;
  return result;
}

/** Drops custom events and strips tokens or email addresses from the page URL. */
export function sanitizeAnalyticsEvent<T extends AnalyticsEvent>(event: T): T | null {
  if (event.type !== "pageview") return null;
  if (urlMentionsTestEntity(event.url)) return null;
  const url = sanitizeAnalyticsUrl(event.url);
  if (!url) return null;
  return { ...event, url };
}
