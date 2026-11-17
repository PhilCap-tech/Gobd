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
import { mitEinzelaufzeichnung, mitKassenNotverfahren } from "@/lib/schnellversion-basis";
import { neutralizeStandardText, offeneKasseText } from "@/lib/schnellversion-neutral";
import {
  SV_KASSE_UNSICHER_HILFE,
  formatSvDate,
  svClosingPage,
  svCoverBox,
  svHeaderLine,
} from "@/lib/schnellversion-copy";

export function standardFrameFor(input: SchnellversionAnswers, erstelltAm: Date): StandardPdfFrame {
  const built = buildStandardAnswers(input);
  const label = vorlageLabel(built.vorlage);
  const datum = formatSvDate(erstelltAm);
  const fall = standardFall(input);
  const frame: StandardPdfFrame = {
    header: svHeaderLine(input.firma, datum),
    coverBox: svCoverBox(label, datum),
    closing: svClosingPage({
      self: !kanzleiBuchtAntwort(input.bucht),
      kasse: kasseHatKapitel(input.kasse),
      gastro: input.branche === "gastro",
      kasseArt: input.kasse,
    }),
    erstelltAm: datum,
    selfBooking: !kanzleiBuchtAntwort(input.bucht),
    software: softwareProse(input),
    bausteinKind: fall.kind,
    bausteinName: fall.name,
    brancheId: input.branche,
    kasseArt: input.kasse,
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
    .map((chapter) => {
      let body = chapter.body;
      if (frame.kasseHinweis && chapter.id === "modul-m08") body = `${frame.kasseHinweis}\n\n${body}`;
      body = mitEinzelaufzeichnung(body, chapter.id, input.kasse);
      body = mitKassenNotverfahren(body, chapter.id, input.kasse);
      return neutralizeStandardText(body, datum, options);
    });
  const joined = limitIdenticalSentences([
    neutralizeStandardText(`${frame.coverBox}\n\n${rendered.cover}`, datum, options),
    ...chapters,
    standardSystemSection(standardFall(input)),
    neutralizeStandardText(frame.closing, datum, options),
  ].join("\n"), 1);
  return input.kasse === "Ja, offene Ladenkasse (ohne elektronisches System)" ? offeneKasseText(joined) : joined;
}

export function standardNeedsKasseChapter(input: SchnellversionAnswers): boolean {
  return kasseHatKapitel(input.kasse);
}
