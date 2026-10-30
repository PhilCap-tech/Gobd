// Public legal pages read these files. A leading blockquote is internal
// and is stripped at render time.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ampelNoEmailEnvEnabled } from "@/lib/ampel-v2-flag";
import { extraFirmsEnabled, isPricingV2, retentionDeleteEnabled } from "@/lib/pricing-model";

/**
 * Bedingte Abschnitte (Preismodell v2): `<!-- if:NAME -->…<!-- endif -->`.
 * NAME: `v2`, `legacy`, `retention-delete` (RETENTION_DELETE_ENABLED),
 * `retention-delete-off`, `extra-firms` / `extra-firms-off` (PRICING_EXTRA_FIRMS_ENABLED:
 * § 12c-Abrechnung nach aktiven Firmen, wartet auf Philips Freigabe; aus = freigegebene Fassung 14:24).
 * `ampel-email` / `ampel-no-email` (AMPEL_NO_EMAIL_ENABLED, nur Env): alter Ampel-Ablauf mit E-Mail-Gate
 * bzw. Ampel ohne E-Mail aktiv. Die Cookie-Zeile gobd_ampel_shown steht nur bei ausgeschaltetem Flag (Freigabe 30.10. 18:57).
 * Nicht verschachteln: jeder Block steht für sich.
 * Ohne Schalter bleibt der bisherige Text wörtlich (nur die Marker fallen weg).
 */
export type LegalFlags = {
  v2: boolean;
  legacy: boolean;
  "retention-delete": boolean;
  "retention-delete-off": boolean;
  "extra-firms": boolean;
  "extra-firms-off": boolean;
  "ampel-email": boolean;
  "ampel-no-email": boolean;
};

export function legalFlagsFor(v2: boolean, retentionDelete: boolean, extraFirms = false, ampelNoEmail = false): LegalFlags {
  return {
    v2,
    legacy: !v2,
    "retention-delete": retentionDelete,
    "retention-delete-off": !retentionDelete,
    "extra-firms": extraFirms,
    "extra-firms-off": !extraFirms,
    "ampel-email": !ampelNoEmail,
    "ampel-no-email": ampelNoEmail,
  };
}

export function legalFlags(): LegalFlags {
  return legalFlagsFor(isPricingV2(), retentionDeleteEnabled(), extraFirmsEnabled(), ampelNoEmailEnvEnabled());
}

export function applyLegalConditions(markdown: string, flags: LegalFlags): string {
  return markdown.replace(
    /<!-- if:([a-z0-9-]+) -->([\s\S]*?)<!-- endif -->/g,
    (_match, name: string, body: string) =>
      (flags as Record<string, boolean>)[name] === true ? body : "",
  );
}

export function readContentWithConditions(...segments: string[]): string {
  return applyLegalConditions(
    readFileSync(path.join(process.cwd(), "content", ...segments), "utf8"),
    legalFlags(),
  );
}

function readLegal(filename: string): string {
  return readContentWithConditions("legal", filename);
}

export const impressumMarkdown = readLegal("impressum.md");
/** Neues Preismodell (28.10.): Legal v3 (1:1); Legacy unverändert. */
export const datenschutzMarkdown = readLegal(isPricingV2() ? "datenschutz-v3.md" : "datenschutz.md");
/** Preismodell v2: AGB-Fassung von Legal (26.10., Stand 30.10.2026) als eigene Datei; die bisherige bleibt wörtlich. */
export const agbMarkdown = readLegal(isPricingV2() ? "agb-v3.md" : "agb.md");
export const cookiesMarkdown = readLegal(isPricingV2() ? "cookies-v3.md" : "cookies.md");
export const produktDisclaimerMarkdown = readLegal("produkt-disclaimer.md");
