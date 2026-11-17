/**
 * Standard-PDF: Branchenvorlage plus 6 Angaben, über generatePdf.
 * Kein Blob. Deckblatt-Kasten, Kopfzeile, Schlussseite, ohne Anhang A
 * (Liste offener Punkte aus eigenen Antworten).
 */

import { generatePdf, type StandardPdfFrame } from "@/lib/delivery";
import {
  buildStandardAnswers,
  kasseHatKapitel,
  vorlageLabel,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import {
  SV_KASSE_UNSICHER_HILFE,
  addSvDays,
  formatSvDate,
  svClosingPage,
  svCoverBox,
  svHeaderLine,
  SV_DOWNLOAD_DAYS,
} from "@/lib/schnellversion-copy";

export function standardFrameFor(input: SchnellversionAnswers, erstelltAm: Date): StandardPdfFrame {
  const built = buildStandardAnswers(input);
  const label = vorlageLabel(built.vorlage);
  const bis = formatSvDate(addSvDays(erstelltAm, SV_DOWNLOAD_DAYS));
  const frame: StandardPdfFrame = {
    header: svHeaderLine(input.firma, formatSvDate(erstelltAm)),
    coverBox: svCoverBox(label),
    closing: svClosingPage(bis),
  };
  if (input.kasse === "Unsicher") {
    frame.kasseHinweis = `[bitte prüfen] ${SV_KASSE_UNSICHER_HILFE}`;
  }
  return frame;
}

export async function generateStandardPdf(input: SchnellversionAnswers, erstelltAm: Date): Promise<Buffer> {
  const built = buildStandardAnswers(input);
  const { buffer } = await generatePdf({
    answers: built.answers,
    identity: built.identity,
    documentId: `standard-${built.vorlage}`,
    version: 1,
    standard: standardFrameFor(input, erstelltAm),
  });
  return buffer;
}

export function standardNeedsKasseChapter(input: SchnellversionAnswers): boolean {
  return kasseHatKapitel(input.kasse);
}
