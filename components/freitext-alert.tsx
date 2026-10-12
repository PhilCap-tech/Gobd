"use client";

import { FREITEXT_LIMIT_MESSAGE, freitextTooLong } from "@/lib/intake-payload";

/** Shown on the control itself as soon as a free-text value exceeds the cap. */
export function FreitextAlert({ value }: { value: string }) {
  if (!freitextTooLong(value)) return null;
  return (
    <p className="field-error" role="alert">
      {FREITEXT_LIMIT_MESSAGE}
    </p>
  );
}
