/**
 * Firms that must not trigger customer delivery, post-purchase mail, or stats.
 * Stored rows, blobs, and Stripe objects stay as they are. Add an id here.
 * Match is the firm id, trimmed, case-insensitive.
 */

export const TEST_ENTITY_IDS = [
  // Refunded test purchase "R4 Mystery Test GmbH".
  "48c6805d-3d34-4a80-9747-38ce4edb3eed",
] as const;

const TEST_ENTITY_ID_SET = new Set<string>(TEST_ENTITY_IDS.map((id) => id.toLowerCase()));

export function isTestEntity(id: string | null | undefined): boolean {
  const value = typeof id === "string" ? id.trim().toLowerCase() : "";
  return value.length > 0 && TEST_ENTITY_ID_SET.has(value);
}

/** Reporting, KPI, and admin counts. A blank id is not a listed firm. */
export function countsInReporting(id: string | null | undefined): boolean {
  return !isTestEntity(id);
}

export function omitTestEntities<T extends { entityId?: string | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => countsInReporting(row.entityId));
}

/** True when a page URL carries a listed firm id (query or path). */
export function urlMentionsTestEntity(value: string): boolean {
  const haystack = value.toLowerCase();
  return TEST_ENTITY_IDS.some((id) => haystack.includes(id.toLowerCase()));
}

/** First listed id among the candidates, otherwise "". */
export function matchingTestEntityId(...ids: Array<string | null | undefined>): string {
  for (const id of ids) {
    if (typeof id === "string" && isTestEntity(id)) return id.trim();
  }
  return "";
}

/** Raised when a customer PDF would be generated for a listed firm. */
export class TestEntityDeliverySkipped extends Error {
  readonly code = "test_entity" as const;

  constructor(readonly entityId: string) {
    super("test-entity-delivery-skipped");
    this.name = "TestEntityDeliverySkipped";
  }
}
