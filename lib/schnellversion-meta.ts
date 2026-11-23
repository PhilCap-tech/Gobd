import type { Metadata } from "next";
import { schnellversionOffered } from "@/lib/schnellversion-flag";

type FlagEnv = Record<string, string | undefined>;

/** Gleicher Titel wie die 404-Seite, solange die Schnellversion nicht angeboten wird. */
export const SV_HIDDEN_TITLE = "Seite nicht gefunden";

export function schnellversionPageMetadata(title: string, env: FlagEnv = process.env): Metadata {
  if (!schnellversionOffered(env)) {
    return { title: SV_HIDDEN_TITLE, robots: { index: false, follow: false } };
  }
  return { title, robots: { index: false, follow: false } };
}
