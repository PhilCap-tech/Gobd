// Public legal pages read these files. A leading blockquote is internal
// and is stripped at render time.
import { readFileSync } from "node:fs";
import path from "node:path";
import { isPricingV2, retentionDeleteEnabled } from "@/lib/pricing-model";

/**
 * Bedingte Abschnitte (Preismodell v2): `<!-- if:NAME -->…<!-- endif -->`.
 * NAME: `v2`, `legacy`, `retention-delete` (RETENTION_DELETE_ENABLED).
 * Ohne Schalter bleibt der bisherige Text wörtlich (nur die Marker fallen weg).
 */
export type LegalFlags = { v2: boolean; legacy: boolean; "retention-delete": boolean };

export function legalFlags(): LegalFlags {
  const v2 = isPricingV2();
  return { v2, legacy: !v2, "retention-delete": retentionDeleteEnabled() };
}

export function applyLegalConditions(markdown: string, flags: LegalFlags): string {
  return markdown.replace(
    /<!-- if:([a-z0-9-]+) -->([\s\S]*?)<!-- endif -->/g,
    (_match, name: string, body: string) =>
      (flags as Record<string, boolean>)[name] === true ? body : "",
  );
}

function readLegal(filename: string): string {
  return applyLegalConditions(
    readFileSync(path.join(process.cwd(), "content", "legal", filename), "utf8"),
    legalFlags(),
  );
}

export const impressumMarkdown = readLegal("impressum.md");
export const datenschutzMarkdown = readLegal("datenschutz.md");
export const agbMarkdown = readLegal("agb.md");
export const cookiesMarkdown = readLegal("cookies.md");
export const produktDisclaimerMarkdown = readLegal("produkt-disclaimer.md");
