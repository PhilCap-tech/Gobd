import Link from "next/link";
import { KASSEN_CHECK_PATH, KASSEN_TEASER } from "@/lib/kassen-check-questions";

const TEASER_SLUGS = {
  kiosk: "default",
  friseure: "default",
  einzelhandel: "default",
  taxi: "taxi",
} as const;

const KASSE_MARKER =
  "Vertiefung: [GoBD Verfahrensdokumentation für die Kasse](/blog/verfahrensdokumentation-kasse).";

export type KassenTeaserVariant = "default" | "taxi";

/** Inserts the teaser after the kasse section's Vertiefung link. Other branches stay untouched. */
export function kassenTeaserSplit(
  slug: string,
  body: string,
): { before: string; after: string; variant: KassenTeaserVariant } | null {
  const variant = TEASER_SLUGS[slug as keyof typeof TEASER_SLUGS];
  if (!variant) return null;
  const heading = variant === "taxi" ? "## Taxameter, TSE und Belege" : "## Kasse und Bargeld";
  const head = body.indexOf(heading);
  if (head < 0) return null;
  const mark = body.indexOf(KASSE_MARKER, head);
  if (mark < 0) return null;
  const end = mark + KASSE_MARKER.length;
  return { before: body.slice(0, end), after: body.slice(end), variant };
}

export function KassenCheckTeaser({ variant }: { variant: KassenTeaserVariant }) {
  const text = variant === "taxi" ? KASSEN_TEASER.taxiText : KASSEN_TEASER.defaultText;
  return (
    <aside className="card kassen-check-teaser">
      <p>
        <strong>{KASSEN_TEASER.title}</strong>
      </p>
      <p>{text}</p>
      <p>
        <Link href={KASSEN_CHECK_PATH}>{KASSEN_TEASER.link}</Link>
      </p>
    </aside>
  );
}
