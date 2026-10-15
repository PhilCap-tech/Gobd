/** Customer copy for the Kanzlei-Merkblatt. Wording follows the 15.10.2026 texts. */

export const KANZLEI_CONSENT_TEXT_VERSION = "2026-10-15";

export const KANZLEI_MERKBLATT_PDF_PATH = "/steuerberater/merkblatt/pdf";
export const KANZLEI_MERKBLATT_FILENAME = "kanzlei-merkblatt-verfahrensdokumentation.pdf";

export const KANZLEI_FORM_TITLE = "Kanzlei-Merkblatt: Verfahrensdokumentation nach GoBD";
export const KANZLEI_FORM_LEAD =
  "Checkliste für das Gespräch mit Ihren Mandanten, als PDF zum Ausdrucken (1–2 Seiten).";
export const KANZLEI_FORM_BENEFITS = [
  "Was die GoBD zur Verfahrensdokumentation verlangen",
  "Welche Bausteine Mandanten typischerweise brauchen",
  "Typische Lücken: Kasse, Scan, E-Rechnung, Archivierung, Zuständigkeiten",
] as const;

export const KANZLEI_EMAIL_LABEL = "E-Mail-Adresse";
export const KANZLEI_EMAIL_HINT =
  "Nach dem Absenden startet der Download des Merkblatts direkt auf dieser Seite. Eine Bestätigungs-E-Mail ist dafür nicht nötig. Wir speichern Ihre E-Mail-Adresse und den Zeitpunkt des Downloads für eine interne Auswertung und zum Schutz vor Missbrauch. Informationen und Einladungen erhalten Sie nur, wenn Sie unten gesondert zustimmen.";
export const KANZLEI_EMAIL_INVALID = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";

export const KANZLEI_OPT_IN =
  "Ja, ich möchte per E-Mail Informationen zu GoBD-Themen und zu Angeboten von gobd-doku-erstellen.de (IKAT GmbH) für Kanzleien sowie Einladungen zu Veranstaltungen erhalten. Ich erhalte zuerst eine separate E-Mail mit einem Bestätigungslink (Double-Opt-in). Meine Einwilligung kann ich jederzeit mit Wirkung für die Zukunft widerrufen, z. B. über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de. Für den Download ist diese Einwilligung nicht erforderlich.";

export const KANZLEI_SUBMIT_LABEL = "Merkblatt herunterladen (PDF)";
export const KANZLEI_PRIVACY_LINK_TEXT =
  "Hinweise zur Verarbeitung Ihrer Daten, einschließlich Ihres Widerspruchsrechts, finden Sie in unserer Datenschutzerklärung.";
export const KANZLEI_DISCLAIMER =
  "Das Merkblatt dient der Orientierung und ist keine Steuer- oder Rechtsberatung. Das Angebot von gobd-doku-erstellen.de richtet sich ausschließlich an Unternehmer.";

export const KANZLEI_SUCCESS_TITLE = "Vielen Dank. Der Download des Merkblatts startet.";
export const KANZLEI_SUCCESS_FALLBACK_LEAD = "Falls der Download nicht startet:";
export const KANZLEI_SUCCESS_OPT_IN_SENT =
  "Für die Informationen und Einladungen für Kanzleien haben wir Ihnen eine E-Mail an";
export const KANZLEI_SUCCESS_OPT_IN_CONFIRM =
  "Bitte bestätigen Sie Ihre Anmeldung über den Link darin.";
export const KANZLEI_SUCCESS_OPT_IN_WITHOUT =
  "Ohne Ihre Bestätigung senden wir Ihnen keine solchen E-Mails.";

export const KANZLEI_DOI_SUBJECT = "Bitte bestätigen Sie: Informationen und Einladungen für Kanzleien";
export const KANZLEI_DOI_PREHEADER =
  "Nur nach Ihrer Bestätigung senden wir Ihnen Informationen und Einladungen für Kanzleien.";
export const KANZLEI_DOI_BUTTON = "Anmeldung bestätigen";
export const KANZLEI_MAIL_FOOTER =
  "IKAT GmbH · Sitz der Gesellschaft: Monheim am Rhein · Gartzenweg 1a, 40789 Monheim am Rhein · Geschäftsführer: Philip Cappelletti · Registergericht: Amtsgericht Düsseldorf, HRB 81430 · info@gobd-doku-erstellen.de";
export const KANZLEI_UNSUBSCRIBE_LABEL = "Keine Kanzlei-Infos mehr erhalten";

export const KANZLEI_CONFIRM_TITLE = "Danke, Ihre Anmeldung ist bestätigt.";
export const KANZLEI_CONFIRM_BODY =
  "Sie erhalten künftig per E-Mail Informationen zu GoBD-Themen und zu Angeboten von gobd-doku-erstellen.de für Kanzleien sowie Einladungen zu Veranstaltungen. Abmelden können Sie sich jederzeit über den Link in jeder E-Mail.";
export const KANZLEI_CONFIRM_INVALID =
  "Dieser Bestätigungslink ist ungültig oder abgelaufen.";
export const KANZLEI_WITHDRAWN_NOTICE =
  "Diese Adresse ist abgemeldet. Wir senden keine weiteren Kanzlei-Informationen.";
export const KANZLEI_UNSUBSCRIBE_DONE =
  "Sie erhalten keine weiteren Informationen und Einladungen für Kanzleien.";
export const KANZLEI_UNSUBSCRIBE_INVALID = "Dieser Abmeldelink ist ungültig.";

export const KANZLEI_PRIVACY_TITLE = "Kanzlei-Merkblatt und Kanzlei-Informationen";

export const KANZLEI_PRIVACY_PARAGRAPHS = [
  "Wenn Sie unser Kanzlei-Merkblatt herunterladen, geben Sie Ihre E-Mail-Adresse an. Der Download startet direkt danach, eine Bestätigungs-E-Mail ist dafür nicht nötig. Wir speichern Ihre E-Mail-Adresse und den Zeitpunkt des Downloads. Damit werten wir intern aus, wer das Merkblatt angefordert hat (Reichweite und Interesse aus Kanzleien), schützen das Formular vor Missbrauch und können Ihnen auf Ihren Wunsch Rückfragen zum Merkblatt beantworten. Die Auswertung ist nur intern sichtbar, wir geben die Daten nicht an Dritte weiter. Rechtsgrundlage ist unser berechtigtes Interesse an diesen Zwecken (Art. 6 Abs. 1 lit. f DSGVO). Sie können dieser Verarbeitung jederzeit widersprechen (Art. 21 DSGVO). Ohne Ihre gesonderte Einwilligung senden wir Ihnen keine Werbung.",
  "Wenn Sie zusätzlich das freiwillige Häkchen für Kanzlei-Informationen setzen, senden wir Ihnen eine Bestätigungs-E-Mail (Double-Opt-in). Erst nach Ihrer Bestätigung erhalten Sie Informationen zu GoBD-Themen, Einladungen zu Veranstaltungen und Angebote von gobd-doku-erstellen.de. Um die Einwilligung nachweisen zu können, speichern wir den Zeitpunkt der Anmeldung und der Bestätigung, die IP-Adresse und den Text der Einwilligung. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 Nr. 2 UWG), für den Nachweis Art. 6 Abs. 1 lit. c und f DSGVO.",
  "Für den Versand der E-Mails setzen wir Resend (Plus Five Five, Inc., USA) als Auftragsverarbeiter ein (Art. 28 DSGVO). Grundlage ist ein Auftragsverarbeitungsvertrag. Für die Übermittlung in die USA stützen wir uns auf die Zertifizierung von Resend nach dem EU-U.S. Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO). Ergänzend sind im Vertrag Standardvertragsklauseln vereinbart (Art. 46 Abs. 2 lit. c DSGVO).",
  "Speicherdauer: Eine automatische Löschung nach einer festen Frist findet nicht statt. Wir löschen Ihre Angaben manuell, sobald der Zweck entfällt oder Sie die Löschung verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Bei erteilter Einwilligung speichern wir Ihre Adresse bis zu Ihrem Widerruf. Danach steht sie auf einer Sperrliste, und der Nachweis von Einwilligung und Widerruf bleibt aufbewahrt (siehe Ampel-Check).",
  "Widerruf und Ihre Rechte: Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt. Sie haben außerdem das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen die Verarbeitung auf Grundlage berechtigter Interessen (Art. 21). Eine Nachricht an info@gobd-doku-erstellen.de genügt, wir löschen dann manuell. Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.",
] as const;
