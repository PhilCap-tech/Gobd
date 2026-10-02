/**
 * Customer-facing labels for the account hub.
 *
 * Hunch, checked against this repo: strings from the UX review
 * ("V1 Versionierung Smoke GmbH", "GoBD Tester", "Admin E2E edit marker")
 * are not in source or seed files. They are leftover smoke/E2E values stored
 * on account rows. The hub renames those markers on display. Stored rows,
 * PDFs, and the firma form stay unchanged.
 */

const INTERNAL_TEST_LABEL =
  /\bversionierung\s+smoke(?:\s+gmbh)?\b|\bsmoke\s+gmbh\b|\bgobd\s+tester\b|\badmin\s+e2e\b|\be2e\s+edit\s+marker\b|\bedit\s+marker\b/i;

export function isInternalTestLabel(value: string): boolean {
  return INTERNAL_TEST_LABEL.test(value);
}

/** Company or entity title. Internal markers become the neutral hub label. */
export function customerHubTitle(value: string, fallback: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || isInternalTestLabel(trimmed)) return fallback;
  return trimmed;
}

/** Changelog line. Internal markers become a plain draft note. */
export function customerChangeSummary(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === "—") return "—";
  if (isInternalTestLabel(trimmed)) return "Entwurf";
  return trimmed;
}

/** "Wer" line. Internal markers are omitted. */
export function customerChangedBy(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === "—" || isInternalTestLabel(trimmed)) return "—";
  return trimmed;
}
