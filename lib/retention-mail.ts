/**
 * Löschhinweis 30 bzw. 7 Tage vor der Löschung (AGB § 12 Abs. 5, § 12a Abs. 5;
 * DSE Abschnitt 17). Legal v3 enthält keinen Mailwortlaut: der Text unten ist
 * ein PLATZHALTER (formelles Sie) und muss vor dem Einschalten von Legal
 * freigegeben werden. Schlüssel: HMAC über lib/mail-dedupe (keine Klartext-Mail im Ledger).
 */
import { formatBerlinDate } from "@/lib/kuendigung";

export const RETENTION_NOTICE_PLACEHOLDER = true;

export type RetentionNoticeStage = "notice30" | "notice7";

/** Ein Hinweis je Stufe, Mailbox und Frist. Enthält die Adresse, wird also per HMAC gespeichert. */
export function retentionNoticeMailKey(stage: RetentionNoticeStage, email: string, dueAt: string): string {
  return `retention-notice:${stage}:${email.trim().toLowerCase()}:${dueAt.trim()}`;
}

export function buildRetentionNoticeMail(input: {
  stage: RetentionNoticeStage;
  deleteAt: string;
  category: "option1" | "annual";
  siteUrl: string;
}): { subject: string; text: string; html: string } {
  const days = input.stage === "notice30" ? 30 : 7;
  const date = formatBerlinDate(input.deleteAt);
  const reason =
    input.category === "option1"
      ? "zwölf Monate nach Ihrem Kauf (Option 1)"
      : "zwölf Monate nach dem Ende Ihres Jahrespakets";
  const account = `${input.siteUrl.replace(/\/$/, "")}/account`;
  const subject = `[PLATZHALTER] Hinweis: Löschung Ihrer GoBD-Dokumentation in ${days} Tagen`;
  const lines = [
    "[PLATZHALTER – Wortlaut von Legal ausstehend]",
    "",
    "Guten Tag,",
    "",
    `wir löschen Ihre Verfahrensdokumentation, ihre Fassungen und Ihre Angaben aus dem Fragebogen am ${date} (${reason}) aus unserer Datenbank und unserem Dateispeicher.`,
    "",
    `Bis dahin können Sie Ihre Dokumentation reaktivieren; dann speichern wir sie weiter. Informationen und den Link zur Reaktivierung finden Sie nach der Anmeldung in Ihrem Kundenkonto: ${account}`,
    "",
    "Bereits heruntergeladene PDFs bleiben bei Ihnen und sind von der Löschung nicht betroffen.",
    "",
    "Mit freundlichen Grüßen",
    "Ihr Team von gobd-doku-erstellen.de",
  ];
  const text = lines.join("\n");
  const html = lines
    .map((line) => (line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : ""))
    .join("");
  return { subject, text, html };
}
