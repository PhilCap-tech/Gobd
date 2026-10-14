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

export const REVOKE_NOT_FOUND = "Diese Mitgliedschaft liegt nicht vor.";
