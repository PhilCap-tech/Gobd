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
  // Ganze Beträge wie bisher („149“); v2 hat 99,90 €.
  const net = Number.isInteger(netEur) ? String(netEur) : netEur.toFixed(2).replace(".", ",");
  return `${net} € netto (${grossEuroLabel(netEur)} € brutto)`;
}

/*
 * Preismodell v2 (Philip 26.10.2026, netto zzgl. 19 % USt). Gilt nur bei
 * PRICING_MODEL=v2. Die Werte oben bleiben für das alte Modell und für
 * Digistore24 unverändert. Beträge in Cent, weil 99,90 € keine ganze Zahl ist.
 */
export const V2_ENTRY_CENTS = 9900;
/** Neues Modell (28.10.): Jahrespaket 49 €/Jahr (vorher 99,90 €). Gleicher Wert wie V3_YEAR_CENTS. */
export const V2_MEMBER_YEAR_CENTS = 4900;
export const V2_CHANGE_CENTS = 4900;

/** Brutto in Cent aus Netto in Cent: 9990 → 11888. */
export function grossFromNetCents(netCents: number): number {
  return Math.round((netCents * (100 + VAT_PERCENT)) / 100);
}

/** Deutsches Format aus Cent: 9990 → „99,90“, 9900 → „99“. */
export function centsLabel(cents: number, options?: { forceDecimals?: boolean }): string {
  const euros = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100);
  if (frac === 0 && !options?.forceDecimals) return String(euros);
  return `${euros},${String(frac).padStart(2, "0")}`;
}

/** „99 € netto (117,81 € brutto)“. */
export function netWithGrossCents(netCents: number): string {
  return `${centsLabel(netCents)} € netto (${centsLabel(grossFromNetCents(netCents), { forceDecimals: true })} € brutto)`;
}

export const V2_ENTRY_LABEL = centsLabel(V2_ENTRY_CENTS);
export const V2_MEMBER_YEAR_LABEL = centsLabel(V2_MEMBER_YEAR_CENTS);
export const V2_CHANGE_LABEL = centsLabel(V2_CHANGE_CENTS);
export const V2_ENTRY_GROSS_LABEL = centsLabel(grossFromNetCents(V2_ENTRY_CENTS), { forceDecimals: true });
export const V2_MEMBER_YEAR_GROSS_LABEL = centsLabel(grossFromNetCents(V2_MEMBER_YEAR_CENTS), { forceDecimals: true });
export const V2_CHANGE_GROSS_LABEL = centsLabel(grossFromNetCents(V2_CHANGE_CENTS), { forceDecimals: true });
/** Einstieg + erstes Mitgliedsjahr, beim Kauf fällig: 198,90 € netto. */
export const V2_ENTRY_WITH_MEMBER_CENTS = V2_ENTRY_CENTS + V2_MEMBER_YEAR_CENTS;

/** R1 neu (Philip 26.10. 14:04): weitere Firma ohne Mitgliedschaft 99 € einmalig, mit Mitgliedschaft ab der 3. Firma 49 €/Jahr. */
export const V2_FIRM_CENTS = 9900;
export const V2_MEMBER_FIRM_YEAR_CENTS = 4900;
export const V2_FIRM_LABEL = centsLabel(V2_FIRM_CENTS);
export const V2_MEMBER_FIRM_YEAR_LABEL = centsLabel(V2_MEMBER_FIRM_YEAR_CENTS);

/*
 * Feste Preise außerhalb von PRICING_MODEL (Inhalte-Liste 26.10.):
 * Digistore24-Partner-Angebot (/partner-angebot, /partner-danke) und das
 * Kanzlei-Angebot (/steuerberater, KANZLEI-PILOT) zeigen nie v2-Preise.
 * Werte wie bisher; sie hängen nicht mehr an der Kunden-Monatskonstante.
 */
export const DS24_SETUP_EUR = 149;
export const DS24_MONTHLY_EUR = 49;
export const DS24_TODAY_EUR = DS24_SETUP_EUR + DS24_MONTHLY_EUR;
export const DS24_SETUP_GROSS_LABEL = grossEuroLabel(DS24_SETUP_EUR);
export const DS24_MONTHLY_GROSS_LABEL = grossEuroLabel(DS24_MONTHLY_EUR);
export const DS24_TODAY_GROSS_LABEL = grossEuroLabel(DS24_TODAY_EUR);

/** KANZLEI-PILOT: Monatsbeitrag des Mandanten-Abos nach den zwei freien Monaten (altes Modell). */
export const KANZLEI_PILOT_MONTHLY_EUR = 49;
export const KANZLEI_PILOT_MONTHLY_GROSS_LABEL = grossEuroLabel(KANZLEI_PILOT_MONTHLY_EUR);

/*
 * Neues Preismodell (Philip 28.10.2026, netto zzgl. 19 % USt), ersetzt v2
 * vom 26.10. unter PRICING_MODEL=v2. Option 1: 99 € einmalig je Firma, 30
 * Tage Zugang. Option 2 („Bestseller“): 99 € + 49 €/Jahr. Kein 99,90-€-Jahr,
 * keine 49-€-Einzeländerung, keine Firmen-Rabatte mehr (Konstanten oben
 * bleiben nur für Altbestand/Checks).
 */
export const V3_ENTRY_CENTS = 9900;
export const V3_YEAR_CENTS = 4900;
export const V3_ENTRY_WITH_YEAR_CENTS = V3_ENTRY_CENTS + V3_YEAR_CENTS;
export const V3_ENTRY_LABEL = centsLabel(V3_ENTRY_CENTS);
export const V3_YEAR_LABEL = centsLabel(V3_YEAR_CENTS);
export const V3_ENTRY_GROSS_LABEL = centsLabel(grossFromNetCents(V3_ENTRY_CENTS), { forceDecimals: true });
export const V3_YEAR_GROSS_LABEL = centsLabel(grossFromNetCents(V3_YEAR_CENTS), { forceDecimals: true });
export const V3_ENTRY_WITH_YEAR_LABEL = centsLabel(V3_ENTRY_WITH_YEAR_CENTS);
export const V3_ENTRY_WITH_YEAR_GROSS_LABEL = centsLabel(grossFromNetCents(V3_ENTRY_WITH_YEAR_CENTS), { forceDecimals: true });
