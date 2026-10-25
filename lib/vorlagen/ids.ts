/** Whitelist for the three gated templates. Nothing else is a magnet id. */
export const MAGNET_IDS = [
  "kostenrechner",
  "checkliste-kassen-nachschau",
  "gliederung-verfahrensdoku",
] as const;

export type MagnetId = (typeof MAGNET_IDS)[number];

export const MAGNET_DOI_TTL_MS = 48 * 60 * 60 * 1000;
export const MAGNET_DOWNLOAD_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAGNET_MAIL_DEDUPE_MS = MAGNET_DOI_TTL_MS;

/** Step-sheet value `n`. Same order as the brief. */
export const MAGNET_STEP_N: Record<MagnetId, "1" | "2" | "3"> = {
  kostenrechner: "1",
  "checkliste-kassen-nachschau": "2",
  "gliederung-verfahrensdoku": "3",
};

export const MAGNET_TITLES: Record<MagnetId, string> = {
  kostenrechner: "Was kostet eine fehlende Verfahrensdokumentation?",
  "checkliste-kassen-nachschau": "Kassen-Nachschau: Was Sie vorbereiten können",
  "gliederung-verfahrensdoku": "Gliederungsvorlage für Ihre Verfahrensdokumentation",
};

export const MAGNET_FILENAMES: Record<MagnetId, string> = {
  kostenrechner: "kostenrechner-ergebnis.pdf",
  "checkliste-kassen-nachschau": "checkliste-kassen-nachschau.pdf",
  "gliederung-verfahrensdoku": "gliederung-verfahrensdoku.pdf",
};

export const MAGNET_PATHS: Record<MagnetId, string> = {
  kostenrechner: "/vorlagen/kostenrechner",
  "checkliste-kassen-nachschau": "/vorlagen/checkliste-kassen-nachschau",
  "gliederung-verfahrensdoku": "/vorlagen/gliederung-verfahrensdoku",
};

const MAGNET_ID_SET = new Set<string>(MAGNET_IDS);

export function isMagnetId(value: unknown): value is MagnetId {
  return typeof value === "string" && MAGNET_ID_SET.has(value);
}

export function magnetStepNumber(magnet: MagnetId): "1" | "2" | "3" {
  return MAGNET_STEP_N[magnet];
}
