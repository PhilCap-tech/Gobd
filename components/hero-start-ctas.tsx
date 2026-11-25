import type { ReactNode } from "react";
import home from "@/app/home.module.css";
import { CampaignLink } from "@/components/campaign-link";
import { HomeCtaLink } from "@/components/home-cta-link";
import { CTA_CHECK, CTA_SAMPLE, CTA_START } from "@/lib/offer-copy";

/** Wortlaut von der Startseite, Abschnitt „Noch unsicher“ / Lead der Ampel mit PDF-Bericht. */
const AMPEL_BENEFIT_START =
  "Sie sehen, welche Themen Ihre Dokumentation typischerweise abdecken sollte";
const AMPEL_BENEFIT_MORE = " — und wo bei Ihnen noch Klärungsbedarf liegen kann";

/**
 * Hero-CTAs der Startseite. Auf Desktop steht die Ampel-Karte zwischen dem
 * ersten Button und den weiteren. Auf schmalen Viewports entfällt die Karte;
 * dort folgt ein schmaler Ampel-Button direkt auf „Fragebogen kostenlos starten“.
 */
export function HeroStartCtas({ extra }: { extra?: ReactNode }) {
  return (
    <div className={home.heroCtaStack}>
      <div className={home.ctas}>
        <CampaignLink className="btn" cta="hero_checkout" href="/checkout">
          {CTA_START}
        </CampaignLink>
      </div>
      <div className={home.heroAmpelCard}>
        <p className={home.heroAmpelCardText}>
          {AMPEL_BENEFIT_START}
          <span className={home.heroAmpelCardMore}>{AMPEL_BENEFIT_MORE}</span>.
        </p>
        <HomeCtaLink className={`btn ${home.heroAmpelBtn}`} cta="hero_ampel" href="/readiness">
          {CTA_CHECK}
        </HomeCtaLink>
      </div>
      <div className={`${home.ctas} ${home.heroCtaRest}`}>
        {extra}
        <HomeCtaLink className={`btn ${home.btnSec}`} cta="hero_muster" href="#muster">
          {CTA_SAMPLE}
        </HomeCtaLink>
      </div>
    </div>
  );
}
