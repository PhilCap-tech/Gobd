/**
 * Sichtbare Sätze der Schnellversion. Wortlaut aus dem Konzept
 * (Abschnitt 2 und 3), formelles Sie. Keine eigenen Preise oder Disclaimer.
 */

export const SV_BUY_LABEL = "Direkt kaufen: Standard-PDF 49 €";

export const SV_HERO_NOTE =
  "Fragebogen: Ihre individuelle Dokumentation, 99 € erst vor der Erstellung. Direkt kaufen: Standardfassung aus Ihrer Branchenvorlage, bitte selbst prüfen. Preise netto zzgl. 19 % USt, nur für Unternehmen.";

export const SV_FUNNEL_HEAD =
  "Schnellversion: 6 Fragen zu Ihrem Betrieb. Daraus erstellen wir eine Standardfassung aus der Vorlage Ihrer Branche.";

export const SV_FUNNEL_FOOT =
  "Sie können Ihre Antworten vor dem Kauf noch ändern. Keine Steuer- oder Rechtsberatung.";

export const SV_KASSE_HILFE =
  "Bei ‚Ja‘ enthält die Standardfassung ein Kapitel zur Kassenführung mit allgemeinen Angaben. Gerätedaten, Ablauf des Tagesabschlusses und Ihre Zuständigkeiten tragen Sie selbst nach.";

/** Kurzer neutraler Satz zu „Unsicher“ (Konzept 2.2: Kapitel mit Prüfhinweis). */
export const SV_KASSE_UNSICHER_HILFE =
  "Bei „Unsicher“ wird das Kapitel zur Kassenführung mit einem Prüfhinweis aufgenommen.";

export const SV_KAUF_BUTTON = "Standardfassung für 49 € kaufen";

export const SV_KAUF_PREIS =
  "49 € zzgl. 19 % USt (58,31 € brutto), einmalig je Firma. Keine Abo-Pflicht.";

export const SV_KAUF_UNTERNEHMER = "Sie bestellen als Unternehmer im Sinne von § 14 BGB.";

export const SV_KAUF_BEWUSST =
  "Ihnen ist bewusst, dass die Schnellversion eine Standardfassung aus einer Branchenvorlage ist. Sie beschreibt nicht Ihre tatsächlichen Abläufe und muss vor der Verwendung von Ihnen geprüft und angepasst werden.";

export const SV_KAUF_PFLICHT =
  "Preise netto zzgl. 19 % USt, nur für Unternehmen. Jede weitere Firma buchen Sie gesondert. Erstattung nur, wenn die Erstellung Ihres PDFs fehlschlägt (Einzelheiten in den AGB). Keine Steuer- oder Rechtsberatung.";

export const SV_KAUF_WECHSEL =
  "Ihre 6 Angaben übernehmen wir in den Fragebogen. Der Fragebogen ist kostenlos, Sie zahlen erst nach der letzten Frage.";

export const SV_WECHSEL_LINK = "Stattdessen kostenlos mit dem Fragebogen beginnen";

export const SV_DANKE_TITEL = "Ihre Standardfassung steht zum Download bereit.";

export const SV_DANKE_MICRO = "Download 30 Tage im Konto. Bitte speichern Sie das PDF selbst.";

export const SV_DOWNLOAD_DAYS = 30;

export const SV_COVER_TITLE = "Standardfassung, bitte prüfen";

export function svCoverBox(vorlage: string, erstelltAm = ""): string {
  const datum = erstelltAm ? ` Erstellt am ${erstelltAm}.` : "";
  return [
    `**${SV_COVER_TITLE}**`,
    "",
    `Standardfassung auf Basis Ihrer Angaben zu Branche und Größe.${datum}`,
    "",
    `Dieses Dokument ist eine Standardfassung aus der Branchenvorlage „${vorlage}“. Es enthält Ihre Firmendaten und 6 Eckdaten. Die beschriebenen Abläufe sind typische Abläufe der Branche, nicht Ihre tatsächlichen. Am Ende steht eine kurze Liste der Punkte, die Sie für Ihren Betrieb ergänzen. Keine Steuer- oder Rechtsberatung.`,
  ].join("\n");
}

export function svHeaderLine(firma: string, datum: string): string {
  return `${SV_COVER_TITLE} · ${firma} · erstellt am ${datum}`;
}

/** Eine Prüffrage je Punkt aus Konzept 2.4. */
export const SV_PRUEF_PUNKTE: ReadonlyArray<readonly [string, string]> = [
  ["Belegeingang", "Wie gehen Belege bei Ihnen ein, und wer erfasst sie?"],
  ["Kasse", "Nehmen Sie Bargeld ein, und trifft das Kapitel zur Kassenführung auf Ihren Betrieb zu?"],
  ["Zuständigkeiten und Vertretung", "Wer ist zuständig, und wer vertritt diese Person?"],
  ["Systeme", "Welche Programme setzen Sie ein, und stimmt die Systemübersicht?"],
  ["Archiv und Aufbewahrung", "Wo liegen die Unterlagen, und wie lange bewahren Sie sie auf?"],
  ["Übergabe an die Kanzlei", "Welche Unterlagen übergeben Sie an die Kanzlei, und wer bleibt wofür zuständig?"],
];

export function svClosingPage(self = false): string {
  const lohn: readonly [string, string] = self
    ? ["Lohn", "Die Lohnabrechnung erfolgt extern (z. B. über ein Lohnbüro). Trifft das auf Ihren Betrieb zu?"]
    : ["Lohn", "Die Lohnabrechnung erfolgt extern (z. B. Lohnbüro oder Steuerkanzlei). Trifft das auf Ihren Betrieb zu?"];
  const points = [...SV_PRUEF_PUNKTE, lohn].map(([titel, frage]) => `**${titel}.** ${frage}`).join("\n\n");
  return ["# Diese Punkte sollten Sie für Ihren Betrieb ergänzen", "", points].join("\n");
}

export function svDankeText(anrechnungBis: string): string {
  return `Wenn Sie Ihre eigenen Abläufe beschreiben möchten: Ihre 6 Angaben sind im Fragebogen übernommen. Bis zum ${anrechnungBis} rechnen wir die 49 € an.`;
}

const BERLIN = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatSvDate(date: Date): string {
  return BERLIN.format(date);
}

export function addSvDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function svDownloadStillOpen(gekauftAmIso: string, now: Date): boolean {
  const bought = Date.parse(gekauftAmIso);
  if (!Number.isFinite(bought)) return false;
  const age = now.getTime() - bought;
  return age >= 0 && age <= SV_DOWNLOAD_DAYS * 24 * 60 * 60 * 1000;
}
