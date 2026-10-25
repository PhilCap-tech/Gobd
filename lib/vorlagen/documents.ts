import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";
import {
  emptyCalc,
  CALC_ABSCHLUSS,
  CALC_ALWAYS_HINT,
  CALC_DISCLAIMER,
  CALC_INTERPRETATION,
  CALC_KASSE_HINT,
  CALC_KLEIN_HINT,
  CALC_RESULT_TITLE,
  CALC_RZ155,
  CALC_WAYS_NOTE,
  viewCalc,
  type CalcSnapshot,
} from "@/lib/vorlagen/calc";
import { MAGNET_FILENAMES, MAGNET_TITLES, type MagnetId } from "@/lib/vorlagen/ids";
import { renderMagnetMarkdown } from "@/lib/vorlagen/pdf-doc";
import { CHECKLISTE_MARKDOWN } from "@/lib/vorlagen/text-checkliste";
import { GLIEDERUNG_MARKDOWN } from "@/lib/vorlagen/text-gliederung";

function kostenrechnerMarkdown(calc: CalcSnapshot): string {
  const view = viewCalc(calc);
  const lines = [
    `# ${MAGNET_TITLES.kostenrechner}`,
    "",
    CALC_DISCLAIMER,
    "",
    CALC_RZ155,
    "",
    `## ${CALC_RESULT_TITLE}`,
    "",
    view.eigen,
    "",
    view.stb,
    "",
    view.tool,
    "",
    CALC_WAYS_NOTE,
    "",
    view.blockB,
    "",
  ];
  if (view.blockBDetail) lines.push(view.blockBDetail, "");
  if (view.assumption) lines.push(view.assumption, "");
  if (calc.kasse) {
    lines.push(CALC_KASSE_HINT, "", `Kassen-Nachschau-Checkliste: ${CANONICAL_PRODUCTION_APP_URL}/vorlagen/checkliste-kassen-nachschau`, "");
  }
  if (calc.kleinunternehmer) lines.push(CALC_KLEIN_HINT, "");
  lines.push(
    CALC_ALWAYS_HINT,
    "",
    CALC_INTERPRETATION,
    "",
    CALC_ABSCHLUSS,
    "",
    `Kostenlose GoBD-Ampel starten: ${CANONICAL_PRODUCTION_APP_URL}/ampel-check`,
    `Gliederungsvorlage ansehen: ${CANONICAL_PRODUCTION_APP_URL}/vorlagen/gliederung-verfahrensdoku`,
    "",
    "*gobd-doku-erstellen.de · IKAT GmbH, Gartzenweg 1a, 40789 Monheim am Rhein*",
  );
  return lines.join("\n");
}

export async function renderMagnetFile(magnet: MagnetId, calc: CalcSnapshot | null): Promise<{ filename: string; pdf: Buffer }> {
  if (magnet === "checkliste-kassen-nachschau") {
    return {
      filename: MAGNET_FILENAMES[magnet],
      pdf: await renderMagnetMarkdown(CHECKLISTE_MARKDOWN, MAGNET_TITLES[magnet]),
    };
  }
  if (magnet === "gliederung-verfahrensdoku") {
    return {
      filename: MAGNET_FILENAMES[magnet],
      pdf: await renderMagnetMarkdown(GLIEDERUNG_MARKDOWN, MAGNET_TITLES[magnet]),
    };
  }
  return {
    filename: MAGNET_FILENAMES.kostenrechner,
    pdf: await renderMagnetMarkdown(kostenrechnerMarkdown(calc ?? emptyCalc()), MAGNET_TITLES.kostenrechner),
  };
}
