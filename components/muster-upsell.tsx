import Link from "next/link";
import {
  UPSELL_BULLETS,
  UPSELL_CTA,
  UPSELL_CTA_HREF,
  UPSELL_DISCLAIMER,
  UPSELL_EFFORT_NOTE,
  UPSELL_FOOTNOTE,
  UPSELL_HEADLINE,
  UPSELL_PRICE,
  UPSELL_PRICE_BREAKDOWN,
  UPSELL_SECTION_1_TEXT,
  UPSELL_SECTION_1_TITLE,
  UPSELL_SECTION_2_TEXT,
  UPSELL_SECTION_2_TITLE,
  UPSELL_SECTION_3_TITLE,
} from "@/lib/offer-copy";

/**
 * Gleicher Block auf /muster, den Gesamtmuster-Seiten, /steuerberater/muster
 * und am Ende der Demo. Der Text spricht den Betrieb an, nicht die Kanzlei.
 */
export function MusterUpsell() {
  return (
    <section className="upsell" id="upsell" aria-labelledby="upsell-heading">
      <h2 id="upsell-heading">{UPSELL_HEADLINE}</h2>

      <h3>{UPSELL_SECTION_1_TITLE}</h3>
      <p className="prose">{UPSELL_SECTION_1_TEXT}</p>

      <h3>{UPSELL_SECTION_2_TITLE}</h3>
      <p className="prose">{UPSELL_SECTION_2_TEXT}</p>

      <h3>{UPSELL_SECTION_3_TITLE}</h3>
      <ul className="prose-list">
        {UPSELL_BULLETS.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <p className="prose">{UPSELL_EFFORT_NOTE}</p>

      <p className="upsell-price">{UPSELL_PRICE}</p>
      <p className="hint">{UPSELL_PRICE_BREAKDOWN}</p>
      <div className="actions">
        <Link className="btn" href={UPSELL_CTA_HREF}>
          {UPSELL_CTA}
        </Link>
      </div>
      <p className="hint">{UPSELL_DISCLAIMER}</p>
      <p className="upsell-footnote">{UPSELL_FOOTNOTE}</p>
    </section>
  );
}
