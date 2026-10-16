import PDFDocument from "pdfkit";
import {
  AMPEL_CAP_NOTE,
  AMPEL_DISCLAIMER,
  AMPEL_QUESTIONS,
  AMPEL_RESULT_REGISTER_LINE,
  AMPEL_RESULTS,
  type AmpelAnswer,
} from "@/lib/ampel-questions";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";
import { publicAmpelSource, type AmpelAnswerMap } from "@/lib/ampel-score";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import { BRAND_INK, BRAND_MUTED, BRAND_NAVY, drawBrandLockup } from "@/lib/pdf-brand";
import {
  escapeAttr,
  escapeHtml,
  MAIL_HOME_URL,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
const ANSWER_LABEL: Record<AmpelAnswer, string> = {
  ja: "Ja",
  nein: "Nein",
  nicht_zutreffend: "Trifft nicht zu",
};

const CONTENT_WIDTH = 483;

export function buildAmpelPdfMail(answers: AmpelAnswerMap): {
  subject: string;
  text: string;
  html: string;
} | null {
  const scored = scoreAmpelCheck(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const subject = "Ihr Ergebnis der Betriebsprüfungs-Ampel";
  const lines = [
    "Guten Tag,",
    "",
    "anbei erhalten Sie das PDF mit Ihrem Ergebnis der Betriebsprüfungs-Ampel.",
    "",
    `Ergebnis: ${band.label}.`,
    band.headline,
    "",
    band.text,
  ];
  if (scored.capped) lines.push("", AMPEL_CAP_NOTE);
  lines.push("", "Ihre Angaben:");
  for (const question of AMPEL_QUESTIONS) {
    const answer = answers[question.id];
    if (!answer) continue;
    lines.push(
      `- ${question.question}`,
      `  Ihre Angabe: ${ANSWER_LABEL[answer]}`,
      `  ${question.explanation}`,
      `  Quelle: ${publicAmpelSource(question.source)}`,
    );
  }
  lines.push("", "Hinweise:");
  for (const hint of band.hints) lines.push(`- ${hint}`);
  lines.push(
    "",
    "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.",
    "",
    AMPEL_DISCLAIMER,
    "",
    CUSTOMER_MAIL_SIGNATURE,
    `gobd-doku-erstellen.de: ${MAIL_HOME_URL}`,
    AMPEL_RESULT_REGISTER_LINE,
  );

  const items = AMPEL_QUESTIONS.map((question) => {
    const answer = answers[question.id];
    if (!answer) return "";
    return `<li><strong>${escapeHtml(question.question)}</strong><br />Ihre Angabe: ${escapeHtml(ANSWER_LABEL[answer])}<br />${escapeHtml(question.explanation)}<br />Quelle: ${escapeHtml(publicAmpelSource(question.source))}</li>`;
  }).join("");
  const hints = band.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>anbei erhalten Sie das PDF mit Ihrem Ergebnis der Betriebsprüfungs-Ampel.</p>
    <p>Ergebnis: <strong>${escapeHtml(band.label)}</strong>.</p>
    <p><strong>${escapeHtml(band.headline)}</strong></p>
    <p>${escapeHtml(band.text)}</p>
    ${scored.capped ? `<p>${escapeHtml(AMPEL_CAP_NOTE)}</p>` : ""}
    <p>Ihre Angaben:</p>
    <ul>${items}</ul>
    <p>Hinweise:</p>
    <ul>${hints}</ul>
    <p>Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
    <p>${escapeHtml(AMPEL_DISCLAIMER)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}<br /><a href="${escapeAttr(MAIL_HOME_URL)}">gobd-doku-erstellen.de</a></p>
    <p>${escapeHtml(AMPEL_RESULT_REGISTER_LINE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export function buildAmpelResultPdf(answers: AmpelAnswerMap): Promise<Buffer> {
  const scored = scoreAmpelCheck(answers);
  if (!scored) return Promise.reject(new Error("ampel-pdf-incomplete"));
  const band = AMPEL_RESULTS[scored.light];
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      compress: false,
      info: {
        Title: "Betriebsprüfungs-Ampel",
        Author: "GoBD Verfahrensdoku",
        Subject: "Orientierung, keine Steuerberatung",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawBrandLockup(doc, doc.page.margins.left, doc.page.margins.top, 28);
    doc.y = doc.page.margins.top + 42;
    doc.fillColor(BRAND_NAVY).font("Helvetica-Bold").fontSize(16).text("Betriebsprüfungs-Ampel", {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.4);
    doc.fillColor(BRAND_INK).font("Helvetica-Bold").fontSize(12).text(
      `Ergebnis: ${band.label}`,
      { width: CONTENT_WIDTH },
    );
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(band.headline, { width: CONTENT_WIDTH });
    doc.moveDown(0.3);
    doc.text(band.text, { width: CONTENT_WIDTH });
    if (scored.capped) {
      doc.moveDown(0.4);
      doc.text(AMPEL_CAP_NOTE, { width: CONTENT_WIDTH });
    }

    doc.moveDown(0.8);
    doc.fillColor(BRAND_NAVY).font("Helvetica-Bold").fontSize(13).text("Ihre Angaben", {
      width: CONTENT_WIDTH,
    });
    for (const question of AMPEL_QUESTIONS) {
      const answer = answers[question.id];
      if (!answer) continue;
      doc.moveDown(0.55);
      doc.fillColor(BRAND_INK).font("Helvetica-Bold").fontSize(11).text(question.question, {
        width: CONTENT_WIDTH,
      });
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(10).text(`Ihre Angabe: ${ANSWER_LABEL[answer]}`, {
        width: CONTENT_WIDTH,
      });
      doc.moveDown(0.15);
      doc.text(question.explanation, { width: CONTENT_WIDTH });
      doc.moveDown(0.15);
      doc.fillColor(BRAND_MUTED).fontSize(9).text(`Quelle: ${publicAmpelSource(question.source)}`, {
        width: CONTENT_WIDTH,
      });
    }

    doc.moveDown(0.8);
    doc.fillColor(BRAND_NAVY).font("Helvetica-Bold").fontSize(13).text("Hinweise", {
      width: CONTENT_WIDTH,
    });
    for (const hint of band.hints) {
      doc.moveDown(0.25);
      doc.fillColor(BRAND_INK).font("Helvetica").fontSize(10).text(`• ${hint}`, {
        width: CONTENT_WIDTH,
      });
    }

    doc.moveDown(1);
    doc.fillColor(BRAND_MUTED).font("Helvetica").fontSize(8).text(AMPEL_DISCLAIMER, {
      width: CONTENT_WIDTH,
    });
    doc.end();
  });
}
