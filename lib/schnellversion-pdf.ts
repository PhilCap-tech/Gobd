/**
 * Standard-PDF: Branchenvorlage plus 6 Angaben, über generatePdf.
 * Kein Blob. Deckblatt-Kasten, Kopfzeile, Schlussseite, ohne Anhang A
 * (Liste offener Punkte aus eigenen Antworten).
 */

import { generatePdf, type StandardPdfFrame } from "@/lib/delivery";
import {
  buildStandardAnswers,
  kanzleiBuchtAntwort,
  kasseHatKapitel,
  softwareProse,
  vorlageLabel,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { limitIdenticalSentences, standardFall, standardSystemSection } from "@/lib/schnellversion-bausteine";
import { neutralizeStandardText } from "@/lib/schnellversion-neutral";
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
  const datum = formatSvDate(erstelltAm);
  const fall = standardFall(input);
  const frame: StandardPdfFrame = {
    header: svHeaderLine(input.firma, datum),
    coverBox: svCoverBox(label, datum),
    closing: svClosingPage(bis),
    erstelltAm: datum,
    selfBooking: !kanzleiBuchtAntwort(input.bucht),
    software: softwareProse(input),
    bausteinKind: fall.kind,
    bausteinName: fall.name,
    brancheId: input.branche,
  };
  if (input.kasse === "Unsicher") {
    frame.kasseHinweis = SV_KASSE_UNSICHER_HILFE;
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

/** Derselbe Text wie im PDF, ohne PDFKit. Der Build prüft daran alle Kombinationen. */
export function standardPlainText(input: SchnellversionAnswers, erstelltAm: Date): string {
  const built = buildStandardAnswers(input);
  const frame = standardFrameFor(input, erstelltAm);
  const rendered = renderDeliveryDocument({
    identity: built.identity,
    answers: built.answers,
    documentId: `standard-${built.vorlage}`,
    version: 1,
  });
  const options = { selfBooking: frame.selfBooking, software: frame.software, fall: standardFall(input), branche: input.branche };
  const datum = frame.erstelltAm ?? "";
  const chapters = rendered.chapters
    .filter((chapter) => chapter.id !== "anhang-a")
    .map((chapter) => neutralizeStandardText(chapter.body, datum, options));
  return limitIdenticalSentences([
    neutralizeStandardText(`${frame.coverBox}\n\n${rendered.cover}`, datum, options),
    ...chapters,
    neutralizeStandardText(frame.closing, datum, options),
    standardSystemSection(standardFall(input)),
  ].join("\n"), 1);
}

export function standardNeedsKasseChapter(input: SchnellversionAnswers): boolean {
  return kasseHatKapitel(input.kasse);
}
