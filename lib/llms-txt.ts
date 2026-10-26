import { BRANCHEN_SLUGS, branchenPath, listBranchenFooterLinks } from "@/lib/branchen";
import { readFaqMarkdown } from "@/lib/faq-entries";
import { agbMarkdown } from "@/lib/legal-content";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { markdownH2Section, plainLineContaining } from "@/lib/markdown-section";
import {
  V2_CHANGE_CENTS,
  V2_ENTRY_CENTS,
  V2_MEMBER_YEAR_CENTS,
  netWithGrossCents,
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  VAT_PERCENT,
  netWithGross,
} from "@/lib/pricing";
import { isPricingV2 } from "@/lib/pricing-model";
import { SITE_ORIGIN, canonicalUrl } from "@/lib/seo";

const FAQ_GUARANTEE = "6. 14 Tage Geld zurück: Garantie und Rückgaberecht";
const AGB_NO_WITHDRAWAL = "§ 8 Kein Widerrufsrecht (B2B)";
const AGB_GUARANTEE = "§ 9 Zufriedenheitsgarantie";
const AGB_TERM = "§ 12 Laufzeit, Verlängerung und Kündigung";

const DELIVERY_NEEDLE = "innerhalb weniger Minuten";
const B2B_NEEDLE = "ausschließlich an Unternehmer";

/** Checkout hint, rendered text (the source uses a non-breaking space before %). */
const REVERSE_CHARGE =
  "Inland (Deutschland): 19 % Umsatzsteuer auf die Nettopreise. Eine Umkehr der Steuerschuldnerschaft (Reverse Charge) bieten wir derzeit nicht an.";

function quote(title: string, body: string): string[] {
  return [`### ${title}`, "", body, ""];
}

/** One line per `BRANCHEN_SLUGS` entry, so a new slug shows up here too. */
function industryLines(): string[] {
  const labels = new Map(
    listBranchenFooterLinks().map((link) => [link.slug, link.label]),
  );
  return BRANCHEN_SLUGS.map((slug) => {
    const label = labels.get(slug) ?? slug;
    return `- [${label}](${canonicalUrl(branchenPath(slug))})`;
  });
}

/**
 * Public /llms.txt. Refund and cancellation paragraphs are the current FAQ
 * and AGB sections, not a rewritten policy.
 */
export function buildLlmsTxt(): string {
  const faq = readFaqMarkdown();
  const delivery = plainLineContaining(faq, DELIVERY_NEEDLE);
  const b2b = plainLineContaining(faq, B2B_NEEDLE);
  const lines = [
    "# GoBD-Verfahrensdokumentation",
    "",
    `> ${LEGAL_OPERATOR.name} bietet Ihnen unter ${SITE_ORIGIN} eine GoBD-Verfahrensdokumentation als PDF. Das Angebot gilt nur für Unternehmen. Hinweis: keine Steuerberatung.`,
    "",
    "## Angebot",
    "",
    "Sie erhalten eine strukturierte GoBD-Verfahrensdokumentation als PDF. Die Dokumentation entsteht aus Ihren Angaben im Online-Fragebogen. Enthalten sind 24 Module und eine Liste offener Punkte. Texte, Vorlagen und Ausgaben sind allgemeine Arbeitshilfen.",
    "",
    "Hinweis: keine Steuerberatung, keine Rechtsberatung und keine verbindliche Auskunft.",
    "",
    "## Preis",
    "",
    ...(isPricingV2()
      ? [
          `Einstieg: ${netWithGrossCents(V2_ENTRY_CENTS)}, einmalig.`,
          `Optional Jahresmitgliedschaft: ${netWithGrossCents(V2_MEMBER_YEAR_CENTS)} pro Jahr.`,
          `Änderung (neue Version) ohne Mitgliedschaft: ${netWithGrossCents(V2_CHANGE_CENTS)}.`,
          `Alle Preise zzgl. ${VAT_PERCENT} % USt. Nur für Unternehmen.`,
        ]
      : [
          `${TODAY_EUR} € zum Start (Einrichtung + 1. Monat), danach ${MONTHLY_EUR} €/Monat, zzgl. USt. (brutto ${TODAY_GROSS_LABEL} €).`,
          "",
          `Einrichtung: ${netWithGross(SETUP_EUR)}.`,
          `Nutzungsentgelt: ${netWithGross(MONTHLY_EUR)} pro Monat.`,
          `Der Startpreis setzt sich aus ${SETUP_EUR} € Einrichtung und ${MONTHLY_EUR} € für den ersten Monat zusammen. Danach ${MONTHLY_EUR} € netto pro Monat (${MONTHLY_GROSS_LABEL} € brutto), inkl. ${VAT_PERCENT} % USt.`,
        ]),
    "",
    REVERSE_CHARGE,
    "",
    "## Ablauf",
    "",
    "Kauf, dann Fragebogen mit 24 Modulen, dann PDF.",
    "",
    `1. Kauf über ${canonicalUrl("/checkout")}.`,
    "2. Fragebogen mit 24 Modulen (Online-Intake zu Abläufen, Software, IT und Verantwortlichen).",
    "3. PDF der Verfahrensdokumentation, dazu eine Liste offener Punkte.",
    "",
    `Über POST ${canonicalUrl("/api/checkout")} starten Sie den Stripe-Checkout über den Ablauf der Website, und die Zahlung schließen Sie bei Stripe ab.`,
    "",
    delivery,
    "",
    "## Für wen",
    "",
    "Nur für Unternehmen (B2B).",
    "",
    b2b,
    "",
    "## Seiten",
    "",
    `- [FAQ](${canonicalUrl("/faq")}): Lieferumfang, Ablauf, Preise, Geld-zurück-Garantie und Rückgaberecht`,
    `- [AGB](${canonicalUrl("/agb")}): Vertragsbedingungen`,
    `- [Muster](${canonicalUrl("/muster")}): fiktive Muster der Verfahrensdokumentation`,
    `- [Muster für Steuerberater](${canonicalUrl("/steuerberater/muster")}): Beispielergebnis`,
    `- [Datenschutz](${canonicalUrl("/datenschutz")})`,
    `- [Impressum](${canonicalUrl("/impressum")}): ${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zipCity}, ${LEGAL_OPERATOR.country}`,
    `- [Checkout](${canonicalUrl("/checkout")}): hier starten Sie die Bestellung`,
    ...industryLines(),
    "",
    "## Erstattung und Kündigung",
    "",
    "Erstattung und Kündigung stehen im Wortlaut der FAQ und der AGB. Unten steht dieser Wortlaut.",
    "",
    ...quote(
      "FAQ: 14 Tage Geld zurück: Garantie und Rückgaberecht",
      markdownH2Section(faq, FAQ_GUARANTEE),
    ),
    ...quote(
      `AGB ${AGB_NO_WITHDRAWAL}`,
      markdownH2Section(agbMarkdown, AGB_NO_WITHDRAWAL),
    ),
    ...quote(
      `AGB ${AGB_GUARANTEE}`,
      markdownH2Section(agbMarkdown, AGB_GUARANTEE),
    ),
    ...quote(`AGB ${AGB_TERM}`, markdownH2Section(agbMarkdown, AGB_TERM)),
    `Kontakt: ${LEGAL_OPERATOR.email}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}
