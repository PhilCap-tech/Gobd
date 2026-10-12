export const SETUP_EUR = 149;
export const MONTHLY_EUR = 49;
export const TODAY_EUR = SETUP_EUR + MONTHLY_EUR;

/** Deutsche Umsatzsteuer, auf den Nettopreis aufgeschlagen (exclusive). */
export const VAT_PERCENT = 19;

/** Brutto in Cent, ohne Gleitkomma: 149 € → 17731. */
export function grossCents(netEur: number): number {
  return Math.round(netEur * (100 + VAT_PERCENT));
}

/** Deutsches Format, z. B. „177,31“. */
export function grossEuroLabel(netEur: number): string {
  const cents = grossCents(netEur);
  const euros = Math.trunc(cents / 100);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${euros},${frac}`;
}

export const SETUP_GROSS_LABEL = grossEuroLabel(SETUP_EUR);
export const MONTHLY_GROSS_LABEL = grossEuroLabel(MONTHLY_EUR);
export const TODAY_GROSS_LABEL = grossEuroLabel(TODAY_EUR);

/** „149 € netto (177,31 € brutto)“. */
export function netWithGross(netEur: number): string {
  return `${netEur} € netto (${grossEuroLabel(netEur)} € brutto)`;
}
