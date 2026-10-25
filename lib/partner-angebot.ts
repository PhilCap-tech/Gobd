/**
 * Digistore24 affiliate landing at /partner-angebot.
 * Prices and customer sentences stay in pricing.ts and offer-copy.ts.
 * The affiliate brief named „198 € netto Einrichtung“. The live constants
 * are SETUP_EUR 149 and TODAY_EUR 198 (Einrichtung + erster Monat). This
 * page follows the homepage constants and does not hardcode 198 as setup.
 */

export const PARTNER_ANGEBOT_PATH = "/partner-angebot";

/** Digistore24 product on this sales page. The promocode snippet uses this id. */
export const DIGISTORE24_PRODUCT_ID = 751404;

export const DIGISTORE24_PRODUCT_URL = `https://www.digistore24.com/product/${DIGISTORE24_PRODUCT_ID}`;

/** Meta robots and the X-Robots-Tag header. */
export const PARTNER_ANGEBOT_ROBOTS_TAG = "noindex, nofollow";

/** Partner-page notice, Fassung 3, next to the buy buttons. "AGB (§ 9a)" links to /agb. */
export const PARTNER_ANGEBOT_NOTICE_BEFORE = "Der Kauf läuft über Digistore24 (die jeweils nach Ihrem Land zuständige Digistore24-Gesellschaft, für Käufer aus Deutschland die Digistore24 GmbH, Hildesheim): Digistore24 ist als Wiederverkäufer Ihr Vertragspartner für Kauf, Zahlung und Rechnung, es gelten die im Bestellformular verlinkten Käufer-AGB und die Datenschutzerklärung von Digistore24, die Leistung erbringt die IKAT GmbH nach unseren ";
export const PARTNER_ANGEBOT_NOTICE_LINK = "AGB (§ 9a)";
export const PARTNER_ANGEBOT_NOTICE_AFTER = ". Das Angebot gilt ausschließlich für Unternehmer im Sinne von § 14 BGB; eine Bestellung ist nur als Unternehmen mit Angabe des Firmennamens möglich, Verbraucher sind ausgeschlossen. 198 € zum Start (Einrichtung 149 € + 1. Monat 49 €), danach 49 €/Monat, jeweils zzgl. USt, bis zu 5 Firmen, monatlich über Digistore24 kündbar, 14-Tage-Zufriedenheitsgarantie nach § 9a AGB mit Erstattung über Digistore24.";
export const PARTNER_ANGEBOT_NOTICE_HREF = "/agb";
export const PARTNER_ANGEBOT_LEGAL_NOTICE =
  PARTNER_ANGEBOT_NOTICE_BEFORE + PARTNER_ANGEBOT_NOTICE_LINK + PARTNER_ANGEBOT_NOTICE_AFTER;

type QueryRecord = Record<string, string | string[] | undefined>;

export type PartnerAngebotQuery = string | URLSearchParams | QueryRecord | undefined | null;

/**
 * Query keys copied onto the Digistore24 product link.
 * `aff` is the affiliate id (digistore.js `affiliate_key`; the promocode reads it).
 * `cam` is the campaign key (digistore.js `campaignkey_key`; Digistore24 documents `cam=`).
 * UTM parameters, click ids, and every other key stay off the link, as does any fragment.
 */
export const DIGISTORE24_FORWARDED_PARAMS = ["aff", "cam"] as const;

const DIGISTORE24_FORWARDED_PARAM_SET = new Set<string>(DIGISTORE24_FORWARDED_PARAMS);

function appendParams(target: URLSearchParams, source: URLSearchParams): void {
  source.forEach((value, key) => {
    if (!DIGISTORE24_FORWARDED_PARAM_SET.has(key)) return;
    target.append(key, value);
  });
}

function withoutFragment(value: string): string {
  const hashAt = value.indexOf("#");
  return hashAt === -1 ? value : value.slice(0, hashAt);
}

function queryFromString(search: string): URLSearchParams {
  const trimmed = withoutFragment(search.trim());
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
 * Product URL plus the allowlisted query, encoded by URLSearchParams.
 * An empty or fully dropped query stays the bare product URL.
 * The host, path, and encoding of kept values stay as before.
 * The fragment is never copied.
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
  url.search = params.toString();
  url.hash = "";
  return url.toString();
}
