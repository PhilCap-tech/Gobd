/** Kundentexte der Einladung. Keine Serverimporte, damit Formulare sie laden können. */

export const INVITE_LINK_INVALID =
  "Dieser Einladungslink ist nicht mehr gültig. Bitten Sie die einladende Person, die Einladung erneut zu senden.";

export const INVITE_LIMIT_MESSAGE =
  "Sie haben bereits fünf aktive Mitwirkende für diese Firma. Eine weitere Einladung ist nicht möglich.";

export const INVITE_ACCEPT_LIMIT_MESSAGE =
  "Für diese Firma sind bereits fünf Mitwirkende aktiv. Bitten Sie die einladende Person, zuerst einen Zugriff zu entziehen.";

export const INVITE_SELF_MESSAGE =
  "Sie können Ihre eigene E-Mail-Adresse für diese Firma nicht einladen.";

export const INVITE_EMAIL_MESSAGE = "Bitte geben Sie eine E-Mail-Adresse ein.";

export const INVITE_ACTIVE_MESSAGE = "Diese Person ist bereits Mitwirkende dieser Firma.";

export const INVITE_MAIL_FAILED =
  "Die Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.";

export const INVITE_SENT_MESSAGE =
  "Die Einladung ist unterwegs. Der Link ist 20 Minuten gültig.";

export const INVITE_THROTTLED_MESSAGE =
  "Die Einladung ist bereits unterwegs. Bitte warten Sie einen Moment, bevor Sie erneut senden.";

/** Einmalige Nachfrage vor Zurücknehmen und Zugriff entziehen. Wortlaut aus dem Konzept. */
export const REVOKE_CONFIRM =
  "Diese Person kann die Firma danach nicht mehr bearbeiten. Der Entwurf bleibt erhalten.";

export const REVOKE_DONE_MESSAGE =
  "Der Zugriff ist entzogen. Der Entwurf bleibt erhalten.";

export const REVOKE_ALREADY_MESSAGE =
  "Der Zugriff ist bereits entzogen. Der Entwurf bleibt erhalten.";

export const REVOKE_MAIL_NOTE =
  "Der Zugriff ist entzogen. Die Information an die Person konnte nicht gesendet werden.";

export const MEMBER_PDF_HINT =
  "Sie füllen Module aus und speichern Entwürfe. Die PDF-Fassung ist für Sie nicht lesbar. Sie erzeugt der Kontoinhaber.";

export const MEMBER_SAVE_LABEL = "Entwurf speichern";

export const MEMBER_SAVED_MESSAGE = "Der Entwurf ist gespeichert.";

export const MODULE_OUTSIDE_MESSAGE =
  "Diese Antworten liegen außerhalb der Module, die Ihnen zugewiesen sind.";

export const MODULE_NOT_RELEASED = "Dieses Modul ist für Sie nicht freigegeben.";

export const OTHER_MODULES_HINT =
  "Andere Module dieser Firma sind für Sie nicht freigegeben.";

export const NO_MODULES_RELEASED =
  "Für Sie sind gerade keine Module freigegeben.";

export function draftConflictCopy(updatedBy: string): string {
  const who = updatedBy.trim() || "einer anderen Person";
  return `Zwischenzeitlich gespeichert von ${who}. Die Angaben wurden neu geladen. Ihre Eingaben aus dieser Sitzung wurden nicht darübergelegt.`;
}

export function lastSavedByYou(when: string): string {
  return `Zuletzt von Ihnen gespeichert am ${when}.`;
}

export const REVOKE_NOT_FOUND = "Diese Mitgliedschaft liegt nicht vor.";

export const AUDIT_HEADING = "Änderungshistorie";

export const AUDIT_EMPTY = "Noch keine Einträge.";

export const AUDIT_LOAD_MORE = "Ältere Einträge laden";

export const AUDIT_UNAVAILABLE =
  "Die Historie konnte gerade nicht geladen werden. Bitte laden Sie die Seite neu.";
