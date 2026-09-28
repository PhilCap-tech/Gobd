import { MONTHLY_EUR } from "@/lib/pricing";

export const PROMO_CODE = "KANZLEI-PILOT";
/**
 * Ops 2026-09-28, Stripe: promo_1UKcN56UvAzri3dMrW7Wn7Y2, coupon J7BECQxI,
 * percent_off 100, duration repeating, duration_in_months 2, max_redemptions 50.
 * First invoice with the promo zeros both lines (Setup and Abo).
 * After promo: list Abo 49 €/Mo if not cancelled. List Setup without the code
 * is 149 € once and is not charged again monthly.
 */
export const PROMO_MONTHS = 2;
export const PROMO_MAX_REDEMPTIONS = 50;

export function PilotKlartextSentence() {
  return (
    <>
      Mit Code <strong className="promo-code">{PROMO_CODE}</strong>: Setup und
      Abo {PROMO_MONTHS}&nbsp;Monate 0&nbsp;€ (100&nbsp;%); danach{" "}
      {MONTHLY_EUR}&nbsp;€/Monat, wenn Sie nicht kündigen — kein
      Überraschungs-Abo hinter ‚gratis‘.
    </>
  );
}
