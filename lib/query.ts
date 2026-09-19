export function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value)
    ? value.find((item) => item && item.trim())
    : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}
