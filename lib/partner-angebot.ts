/**
 * Digistore24 affiliate landing at /partner-angebot.
 * Prices and customer sentences stay in pricing.ts and offer-copy.ts.
 * The affiliate brief named „198 € netto Einrichtung“. The live constants
 * are SETUP_EUR 149 and TODAY_EUR 198 (Einrichtung + erster Monat). This
 * page follows the homepage constants and does not hardcode 198 as setup.
 */

export const PARTNER_ANGEBOT_PATH = "/partner-angebot";

export const DIGISTORE24_PRODUCT_URL = "https://www.digistore24.com/product/751404";

/** Meta robots and the X-Robots-Tag header. */
export const PARTNER_ANGEBOT_ROBOTS_TAG = "noindex, nofollow";

/**
 * Visible draft next to the price and the buy buttons.
 * Marked as a placeholder so it is not a legal claim.
 */
export const PARTNER_ANGEBOT_LEGAL_NOTICE =
  "[PLATZHALTER Legal Draft: Verkauf und Vertragspartner für diese Bestellung ist Digistore24 …]";

type QueryRecord = Record<string, string | string[] | undefined>;

export type PartnerAngebotQuery = string | URLSearchParams | QueryRecord | undefined | null;

function appendParams(target: URLSearchParams, source: URLSearchParams): void {
  source.forEach((value, key) => {
    if (!key) return;
    target.append(key, value);
  });
}

function queryFromString(search: string): URLSearchParams {
  const trimmed = search.trim();
  if (!trimmed) return new URLSearchParams();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
  const query = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
  return new URLSearchParams(query);
}

function queryFromRecord(search: QueryRecord): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (!key || value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item == null) continue;
      params.append(key, item);
    }
  }
  return params;
}

/**
 * Product URL plus the incoming query, encoded by URLSearchParams.
 * An empty query stays the bare product URL. The host and path stay fixed.
 */
export function digistore24BuyHref(search: PartnerAngebotQuery): string {
  const params = new URLSearchParams();
  if (typeof search === "string") {
    appendParams(params, queryFromString(search));
  } else if (search instanceof URLSearchParams) {
    appendParams(params, search);
  } else if (search) {
    appendParams(params, queryFromRecord(search));
  }
  const url = new URL(DIGISTORE24_PRODUCT_URL);
  const query = params.toString();
  url.search = query;
  return url.toString();
}
