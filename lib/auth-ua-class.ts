/**
 * Grobe Einordnung der Browserkennung für den Anmeldelink.
 * Nur die Zeichenkette, kein IP-Feld und kein IP-Bereich.
 * Leer oder unbekannt bleibt `unknown` und gilt als Person.
 */

export const AUTH_UA_CLASSES = [
  "browser",
  "outlook-safelinks",
  "proofpoint",
  "mimecast",
  "sophos",
  "other-bot",
  "unknown",
] as const;

export type AuthUaClass = (typeof AUTH_UA_CLASSES)[number];

const RULES: Array<{ uaClass: AuthUaClass; pattern: RegExp }> = [
  {
    uaClass: "outlook-safelinks",
    pattern:
      /safelinks|bingpreview|microsoft\s+office|microsoft\s+outlook|outlook-ios|outlook-android|outlookmobile|office365|ms-office|\boutlook\b/i,
  },
  { uaClass: "proofpoint", pattern: /proofpoint|urldefense/i },
  { uaClass: "mimecast", pattern: /mimecast/i },
  { uaClass: "sophos", pattern: /sophos/i },
  {
    uaClass: "other-bot",
    pattern:
      /barracuda|googleimageproxy|google-image-proxy|headlesschrome|crawler|spider|preview|\bbot\b|bot\/|curl\/|wget\/|python-requests|python-urllib|^python\/|libwww|httpie\/|go-http-client|okhttp|scrapy|phantomjs|selenium/i,
  },
];

const BROWSER = /mozilla\/|chrome\/|safari\/|firefox\/|edg\/|opera\/|samsungbrowser/i;

export function classifyAuthUserAgent(value: string | null | undefined): AuthUaClass {
  const ua = (value ?? "").trim();
  if (!ua) return "unknown";
  for (const rule of RULES) {
    if (rule.pattern.test(ua)) return rule.uaClass;
  }
  if (BROWSER.test(ua)) return "browser";
  return "unknown";
}

/** HEAD oder eine erkannte Scanner-Klasse. `browser` und `unknown` sind Personen. */
export function authCallIsScanner(input: { method: string; uaClass: AuthUaClass }): boolean {
  if (input.method.toUpperCase() === "HEAD") return true;
  return input.uaClass !== "browser" && input.uaClass !== "unknown";
}
