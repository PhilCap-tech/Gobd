/**
 * Descriptive anchors for the public branch pages.
 * Labels are the H1 up to the colon. `scripts/check-seo.ts` checks that.
 */
export const BRANCHEN_LINKS = [
  {
    slug: "friseure",
    href: "/verfahrensdokumentation-friseure",
    label: "Verfahrensdokumentation für Friseure",
    musterVorlage: "dienstleister",
  },
  {
    slug: "einzelhandel",
    href: "/verfahrensdokumentation-einzelhandel",
    label: "Verfahrensdokumentation im Einzelhandel",
    musterVorlage: "handel",
  },
] as const;

export type BranchenLink = (typeof BRANCHEN_LINKS)[number];

export const HANDEL_MUSTER_HREF = "/muster/gesamt/handel";
export const HANDEL_MUSTER_LABEL = "Muster für den Handel";
