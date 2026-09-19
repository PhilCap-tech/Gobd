function decodeQueryId(value: string): string {
  let current = value.trim();
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break;
    try {
      const decoded = decodeURIComponent(current).trim();
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

/** Trim and URI-decode `session_id` / `document_id` query values. */
export function normalizeQueryId(value: string | null | undefined): string {
  if (!value) return "";
  return decodeQueryId(value);
}

export function queryIdsEqual(a: string, b: string): boolean {
  const left = normalizeQueryId(a);
  const right = normalizeQueryId(b);
  return Boolean(left) && left === right;
}

export function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value)
    ? value.find((item) => item && item.trim())
    : value;
  const normalized = normalizeQueryId(raw);
  return normalized || undefined;
}
