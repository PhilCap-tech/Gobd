import type { FaqEntry } from "@/lib/faq-entries";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  MONTHLY_EUR,
  SETUP_EUR,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  VAT_PERCENT,
  grossCents,
  grossEuroLabel,
  netWithGross,
} from "@/lib/pricing";
import { SITE_ORIGIN, canonicalUrl } from "@/lib/seo";

export type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const PRODUCT_ID = `${SITE_ORIGIN}/#gobd-verfahrensdokumentation`;

type ImpressumAddress = {
  streetAddress: string;
  postalCode: string;
  addressLocality: string;
  addressCountry: string;
};

/** Postal fields as printed on the Impressum page (`LEGAL_OPERATOR`). */
export function impressumAddress(
  operator: typeof LEGAL_OPERATOR = LEGAL_OPERATOR,
): ImpressumAddress {
  const match = /^(\d{5})\s+(.+)$/.exec(operator.zipCity);
  if (!match) {
    throw new Error("Impressum: PLZ und Ort müssen als „40789 Monheim am Rhein“ vorliegen.");
  }
  return {
    streetAddress: operator.street,
    postalCode: match[1],
    addressLocality: match[2],
    addressCountry: operator.country,
  };
}

export function organizationJsonLd(): JsonLdNode {
  const address = impressumAddress();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: LEGAL_OPERATOR.name,
    legalName: LEGAL_OPERATOR.name,
    url: SITE_ORIGIN,
    logo: canonicalUrl("/brand/logo-lockup.png"),
    email: LEGAL_OPERATOR.email,
    telephone: LEGAL_OPERATOR.phone,
    vatID: LEGAL_OPERATOR.vatId,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.streetAddress,
      postalCode: address.postalCode,
      addressLocality: address.addressLocality,
      addressCountry: address.addressCountry,
    },
  };
}

function schemaPriceFromCents(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${euros}.${frac}`;
}

function netSchemaPrice(netEur: number): string {
  return schemaPriceFromCents(netEur * 100);
}

function grossSchemaPrice(netEur: number): string {
  return schemaPriceFromCents(grossCents(netEur));
}

function priceSpecifications(
  netEur: number,
  extra: JsonLdNode,
): JsonLdNode[] {
  return [
    {
      "@type": "UnitPriceSpecification",
      price: netSchemaPrice(netEur),
      priceCurrency: "EUR",
      valueAddedTaxIncluded: false,
      ...extra,
    },
    {
      "@type": "UnitPriceSpecification",
      price: grossSchemaPrice(netEur),
      priceCurrency: "EUR",
      valueAddedTaxIncluded: true,
      description: `${grossEuroLabel(netEur)} € brutto inkl. ${VAT_PERCENT} % USt`,
      ...extra,
    },
  ];
}

function offer(name: string, netEur: number, extra: JsonLdNode): JsonLdNode {
  return {
    "@type": "Offer",
    name,
    url: canonicalUrl("/checkout"),
    price: netSchemaPrice(netEur),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    description: `${netWithGross(netEur)}. Der Wert in price ist der Nettopreis, zzgl. ${VAT_PERCENT} % USt.`,
    seller: {
      "@id": ORGANIZATION_ID,
      "@type": "Organization",
      name: LEGAL_OPERATOR.name,
    },
    priceSpecification: priceSpecifications(netEur, extra),
  };
}

/** Product with net EUR offers. Gross amounts are the 19 % specifications. */
export function productOfferJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": PRODUCT_ID,
    name: "GoBD-Verfahrensdokumentation",
    url: canonicalUrl("/"),
    description: [
      "Strukturierte GoBD-Verfahrensdokumentation als PDF aus einem Fragebogen mit 24 Modulen.",
      `Einrichtung ${SETUP_EUR} € netto, Nutzungsentgelt ${MONTHLY_EUR} € netto pro Monat.`,
      `Zum Start ${TODAY_EUR} € netto (${TODAY_GROSS_LABEL} € brutto inkl. ${VAT_PERCENT} % USt).`,
      "Nur für Unternehmen. Hinweis: keine Steuerberatung.",
    ].join(" "),
    brand: {
      "@type": "Organization",
      name: LEGAL_OPERATOR.name,
    },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Unternehmen (§ 14 BGB)",
    },
    offers: [
      offer("Einrichtung (Setup)", SETUP_EUR, { unitText: "Einrichtung" }),
      offer("Nutzungsentgelt pro Monat", MONTHLY_EUR, {
        unitText: "Monat",
        unitCode: "MON",
        billingDuration: 1,
      }),
      offer("Startpreis (Einrichtung und erster Monat)", TODAY_EUR, {
        unitText: "Start",
      }),
    ],
  };
}

export function faqPageJsonLd(entries: FaqEntry[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(items: Crumb[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}
