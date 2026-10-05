import { BEREICHE, BELEGFLUSS, bereichById, bereichDocTitle } from "@/lib/bereiche";
import { musterFall, type MusterFall } from "@/lib/bereich-muster";
import { catalogFragebogen } from "@/lib/intake-catalog";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

/**
 * Muster-Verfahrensdokumentation und Muster-Fragebogen je Bereich.
 * Belegfluss nutzt die bestehende Beispiel GmbH (Partner-Muster).
 */

export const MUSTER_BEREICH_IDS = BEREICHE.map((bereich) => bereich.id);

export function getMuster(bereich: string): MusterFall | undefined {
  return musterFall(bereich, {
    identity: PARTNER_MUSTER_IDENTITY,
    answers: PARTNER_MUSTER_ANSWERS,
    documentId: PARTNER_MUSTER_DOCUMENT_ID,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
    versionHistory: [],
    steckbrief:
      "Fiktive Beispiel GmbH: B2B-Dienstleistung, DATEV, Eingangsrechnungen per E-Mail und PDF, Ausgangsrechnungen aus einer Rechnungssoftware.",
    facts: [
      ["Unternehmen", `${PARTNER_MUSTER_IDENTITY.company} (fiktiv)`],
      ["Branche", PARTNER_MUSTER_ANSWERS.branchen.join(", ")],
      ["Rechtsform", PARTNER_MUSTER_ANSWERS.rechtsform],
      ["Mitarbeitende", PARTNER_MUSTER_ANSWERS.mitarbeitende],
      ["Geschäftsführung", PARTNER_MUSTER_ANSWERS.gf],
      ["Bereich", "Belegfluss"],
      ["Fassung", "1.0 (Erstfassung)"],
    ],
  });
}

function md(text: string): string {
  return text.replaceAll("|", "/").replace(/\s+/g, " ").trim();
}

/** Muster-Fragebogen as markdown for the PDF writer. */
export function fragebogenMarkdown(muster: MusterFall): string {
  const bereich = bereichById(muster.bereich);
  const steps = catalogFragebogen(muster.answers);
  const count = steps.reduce((sum, step) => sum + step.questions.length, 0);
  const lines: string[] = [
    `# Muster-Fragebogen: ${bereichDocTitle(muster.bereich)}`,
    "",
    "*Muster mit fiktivem Beispielunternehmen. Alle Antworten sind erfunden und zeigen nur, wie ein ausgefüllter Fragebogen aussieht. Keine Steuer- oder Rechtsberatung.*",
    "",
    "| Merkmal | Angabe |",
    "| --- | --- |",
    ...muster.facts.map(([label, value]) => `| ${md(label)} | ${md(value)} |`),
    `| Fragen in diesem Bereich | ${count} |`,
    "",
    "## So lesen Sie den Fragebogen",
    "",
    "- **So läuft es heute:** bestätigte, gelebte Praxis. Nur diese Angaben stehen im Präsens in der Verfahrensdokumentation.",
    "- **Soll künftig so laufen:** geplant, noch nicht gelebt. Wird zum offenen Punkt.",
    "- **Muss ich klären:** unbekannt. Wird zum offenen Punkt.",
    "- **Entfällt:** trifft nicht zu, mit Begründung.",
    "",
    `Der allgemeine Teil (Unternehmen, Systeme, Ablage, Rechte, Kontrollen, Pflege) ist für alle Bereiche gleich und wird bei einem weiteren Bereich derselben Firma vorausgefüllt. ${muster.bereich === BELEGFLUSS ? "" : `Die Schritte zum Bereich ${bereich.label} sind bereichsspezifisch.`}`.trim(),
    "",
  ];
  steps.forEach((step, stepIndex) => {
    lines.push(`## Schritt ${stepIndex + 1}: ${md(step.title)}`, "");
    step.questions.forEach((question, questionIndex) => {
      lines.push(`### ${stepIndex + 1}.${questionIndex + 1} ${md(question.prompt)}`, "");
      if (question.hint) lines.push(`*Hinweis: ${md(question.hint).replaceAll("*", "")}*`, "");
      lines.push(`- **Stand:** ${question.status}`);
      for (const line of question.lines) lines.push(`- ${md(line)}`);
      if (question.reason) lines.push(`- Begründung: ${md(question.reason)}`);
      lines.push("");
    });
  });
  return lines.join("\n").trim();
}
