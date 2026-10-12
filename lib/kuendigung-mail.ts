import { CANCELLATION_MAIL_FROM, type LifecycleRow, formatBerlinDate } from "@/lib/kuendigung";
import type { TransactionalMailContent } from "@/lib/ops";
import {
  escapeHtml,
  MAIL_ACCOUNT_URL,
  MAIL_CHECKOUT_URL,
  MAIL_SUPPORT_EMAIL,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";

export { CANCELLATION_MAIL_FROM };

const SIGNATURE = "Ihr Team von GoBD Verfahrensdoku";

export const CANCELLATION_PAGE_URL = `${MAIL_ACCOUNT_URL}/kuendigung`;

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\n+/)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function mail(subject: string, body: string): TransactionalMailContent {
  return {
    subject,
    text: wrapTransactionalText(body),
    html: wrapTransactionalHtml(paragraphs(body)),
  };
}

function dates(row: LifecycleRow): { end: string; purge: string } {
  return {
    end: formatBerlinDate(row.endedAt || row.periodEnd),
    purge: formatBerlinDate(row.purgeAt || row.restoreUntil),
  };
}

export function buildCancellationConfirmMail(row: LifecycleRow): TransactionalMailContent {
  const end = formatBerlinDate(row.periodEnd);
  const body = [
    "Guten Tag,",
    "",
    `Sie haben das Abonnement für GoBD Verfahrensdoku gekündigt. Das Abo läuft bis zum ${end}, dem Ende des bereits bezahlten Zeitraums. Bis dahin bleiben Ihre Firmen, Entwürfe und PDF-Versionen in Ihrem Konto verfügbar, einschließlich Download und weiterer Versionen.`,
    "",
    `Mit diesem Datum entfallen Online-Pflege und Versionierung. Bereits erzeugte PDFs und Ihre hochgeladenen Dateien können Sie noch 30 Tage nach diesem Datum herunterladen. In Ihrem Konto laden Sie alle Dokumente als ZIP herunter:`,
    CANCELLATION_PAGE_URL,
    "",
    "Die Aufbewahrung steuerlich relevanter Unterlagen ist Ihre Pflicht. Für Bücher und Aufzeichnungen gelten in der Regel zehn Jahre (§ 147 AO). Wir führen kein Archiv für Sie. Mit der späteren Löschung bei uns ist Ihre Aufbewahrung nicht erfüllt.",
    "",
    `Nach dem ${end} halten wir die bei uns gespeicherten Entwürfe und Dokumente noch 30 Tage vor. In dieser Frist können Sie die Dokumente herunterladen oder den Zugang wiederherstellen, indem Sie ein neues Abonnement abschließen. Danach löschen wir diese Daten. Sieben Tage vor der Löschung erhalten Sie eine Erinnerung.`,
    "",
    `Die Kündigung ist keine Erstattung. Die 14-Tage-Zufriedenheitsgarantie beantragen Sie gesondert per E-Mail an ${MAIL_SUPPORT_EMAIL}.`,
    "",
    "Ihr Konto:",
    MAIL_ACCOUNT_URL,
    "",
    SIGNATURE,
  ].join("\n");
  return mail(`Ihre Kündigung — das Abo endet am ${end}`, body);
}

export function buildCancellationReminderMail(row: LifecycleRow): TransactionalMailContent {
  const { end, purge } = dates(row);
  const body = [
    "Guten Tag,",
    "",
    `Ihr Abonnement für GoBD Verfahrensdoku ist am ${end} ausgelaufen. Wir löschen die bei uns gespeicherten Entwürfe, PDF-Versionen und hochgeladenen Dateien am ${purge}.`,
    "",
    "Bis zu diesem Datum können Sie die Dokumente in Ihrem Konto herunterladen oder den Zugang wiederherstellen, indem Sie ein neues Abonnement abschließen:",
    CANCELLATION_PAGE_URL,
    MAIL_CHECKOUT_URL,
    "",
    "Eine Wiederherstellung nach diesem Datum ist nicht mehr möglich. Bitte denken Sie an Ihre eigene Aufbewahrung. Für Bücher und Aufzeichnungen gelten in der Regel zehn Jahre (§ 147 AO). Die Löschung bei uns ersetzt diese Pflicht nicht.",
    "",
    SIGNATURE,
  ].join("\n");
  return mail(`Erinnerung — Löschung Ihrer Dokumentation am ${purge}`, body);
}

export function buildCancellationReactivatedMail(): TransactionalMailContent {
  const body = [
    "Guten Tag,",
    "",
    "die Kündigung Ihres Abonnements für GoBD Verfahrensdoku ist aufgehoben. Das Abo läuft weiter. Online-Pflege und Versionierung bleiben verfügbar.",
    "",
    "Ihr Konto:",
    MAIL_ACCOUNT_URL,
    "",
    SIGNATURE,
  ].join("\n");
  return mail("Ihre Kündigung ist aufgehoben", body);
}

export function buildCancellationEndedMail(row: LifecycleRow): TransactionalMailContent {
  const { end, purge } = dates(row);
  const first =
    row.endReason === "payment_failed"
      ? `Ihr Abonnement für GoBD Verfahrensdoku ist am ${end} beendet, weil die Zahlung nicht abgeschlossen werden konnte.`
      : `Ihr Abonnement für GoBD Verfahrensdoku ist am ${end} beendet. Online-Pflege und Versionierung stehen nicht mehr zur Verfügung.`;
  const body = [
    "Guten Tag,",
    "",
    first,
    "",
    `Bereits erzeugte PDFs und hochgeladene Dateien können Sie bis zum ${purge} herunterladen. Bis dahin stellen Sie den Zugang mit einem neuen Abonnement wieder her:`,
    MAIL_CHECKOUT_URL,
    "",
    "Danach löschen wir diese Daten. Eine Erinnerung senden wir vor der Löschung. Die Aufbewahrung Ihrer Unterlagen bleibt Ihre Pflicht, in der Regel zehn Jahre (§ 147 AO).",
    "",
    SIGNATURE,
  ].join("\n");
  return mail("Ihr Abo ist beendet", body);
}
