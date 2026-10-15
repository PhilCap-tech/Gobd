import { readFaqMarkdown } from "@/lib/faq-entries";
import { agbMarkdown } from "@/lib/legal-content";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { markdownH2Section, plainLineContaining } from "@/lib/markdown-section";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  VAT_PERCENT,
  netWithGross,
} from "@/lib/pricing";
import { SITE_ORIGIN, canonicalUrl } from "@/lib/seo";

const FAQ_GUARANTEE = "6. 14 Tage Zufriedenheitsgarantie";
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
    `${TODAY_EUR} € zum Start (Einrichtung + 1. Monat), danach ${MONTHLY_EUR} €/Monat, zzgl. USt. (brutto ${TODAY_GROSS_LABEL} €).`,
    "",
    `Einrichtung: ${netWithGross(SETUP_EUR)}.`,
    `Nutzungsentgelt: ${netWithGross(MONTHLY_EUR)} pro Monat.`,
    `Der Startpreis setzt sich aus ${SETUP_EUR} € Einrichtung und ${MONTHLY_EUR} € für den ersten Monat zusammen. Danach ${MONTHLY_EUR} € netto pro Monat (${MONTHLY_GROSS_LABEL} € brutto), inkl. ${VAT_PERCENT} % USt.`,
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
    // Branch pages (`/verfahrensdokumentation-<slug>`) stay out until `noindex`
    // is cleared. Add them in the same change that publishes the page.
    `- [FAQ](${canonicalUrl("/faq")}): Lieferumfang, Ablauf, Preise, Zufriedenheitsgarantie`,
    `- [AGB](${canonicalUrl("/agb")}): Vertragsbedingungen`,
    `- [Muster](${canonicalUrl("/muster")}): fiktive Muster der Verfahrensdokumentation`,
    `- [Muster für Steuerberater](${canonicalUrl("/steuerberater/muster")}): Beispielergebnis`,
    `- [Datenschutz](${canonicalUrl("/datenschutz")})`,
    `- [Impressum](${canonicalUrl("/impressum")}): ${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zipCity}, ${LEGAL_OPERATOR.country}`,
    `- [Checkout](${canonicalUrl("/checkout")}): hier starten Sie die Bestellung`,
    "",
    "## Erstattung und Kündigung",
    "",
    "Erstattung und Kündigung stehen im Wortlaut der FAQ und der AGB. Unten steht dieser Wortlaut.",
    "",
    ...quote(
      "FAQ: 14 Tage Zufriedenheitsgarantie",
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
