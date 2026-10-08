import { createHash } from "node:crypto";

/** Same hash the intake draft store uses for `gobd/drafts/<hash>.json`. */
export function intakeDraftHash(draftKey: string): string {
  return createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
}

export function intakeDraftBlobPath(draftKey: string): string {
  return `gobd/drafts/${intakeDraftHash(draftKey)}.json`;
}
