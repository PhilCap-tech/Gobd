/**
 * Owner segment of `gobd/uploads/<owner>/…`.
 * Matches `storeCustomerUpload`: non-alphanumerics except `_` and `-` are removed.
 * An empty result is stored as the shared bucket `anon`. Wipe must not delete that
 * bucket, because it can contain uploads that did not belong to one account.
 */
export function uploadOwnerSegment(ownerKey: string): string {
  return ownerKey.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 64) || "anon";
}

export function wipeUploadOwner(ownerKey: string): string | null {
  const trimmed = ownerKey.trim();
  if (!trimmed) return null;
  const segment = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 64);
  if (!segment || segment === "anon") return null;
  return segment;
}
