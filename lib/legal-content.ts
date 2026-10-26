// Public legal pages read these files. A leading blockquote is internal
// and is stripped at render time.
import { readFileSync } from "node:fs";
import path from "node:path";
import { isPricingV2, retentionDeleteEnabled } from "@/lib/pricing-model";

/**
 * Bedingte Abschnitte (Preismodell v2): `<!-- if:NAME -->…<!-- endif -->`.
 * NAME: `v2`, `legacy`, `retention-delete` (RETENTION_DELETE_ENABLED),
 * `retention-delete-off`, `v2-retention-delete`, `v2-retention-delete-off`.
 * Nicht verschachteln: jeder Block steht für sich.
 * Ohne Schalter bleibt der bisherige Text wörtlich (nur die Marker fallen weg).
 */
export type LegalFlags = {
  v2: boolean;
  legacy: boolean;
  "retention-delete": boolean;
  "retention-delete-off": boolean;
  "v2-retention-delete": boolean;
  "v2-retention-delete-off": boolean;
};

export function legalFlagsFor(v2: boolean, retentionDelete: boolean): LegalFlags {
  return {
    v2,
    legacy: !v2,
    "retention-delete": retentionDelete,
    "retention-delete-off": !retentionDelete,
    "v2-retention-delete": v2 && retentionDelete,
    "v2-retention-delete-off": v2 && !retentionDelete,
  };
}

export function legalFlags(): LegalFlags {
  return legalFlagsFor(isPricingV2(), retentionDeleteEnabled());
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
export const datenschutzMarkdown = readLegal("datenschutz.md");
/** Preismodell v2: AGB-Fassung von Legal (26.10., Stand 30.10.2026) als eigene Datei; die bisherige bleibt wörtlich. */
export const agbMarkdown = readLegal(isPricingV2() ? "agb-v2.md" : "agb.md");
export const cookiesMarkdown = readLegal("cookies.md");
export const produktDisclaimerMarkdown = readLegal("produkt-disclaimer.md");
