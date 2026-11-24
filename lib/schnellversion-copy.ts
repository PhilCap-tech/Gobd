/**
 * Sichtbare Sätze der Schnellversion. Wortlaut aus dem Konzept
 * (Abschnitt 2 und 3), formelles Sie. Keine eigenen Preise oder Disclaimer.
 */

import { LOHN_SATZ } from "@/lib/schnellversion-bausteine";
import { SV_BASIS_SATZ } from "@/lib/schnellversion-neutral";

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

/** Kaufseite: Checkout antwortet nicht mit 2xx oder das Netz fällt aus. */
export const SV_CHECKOUT_START_FAILED =
  "Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder schreiben Sie uns an info@gobd-doku-erstellen.de.";

export const SV_KAUF_PREIS =
  "49 € zzgl. 19 % USt (58,31 € brutto), einmalig je Firma. Keine Abo-Pflicht.";

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

/** Tage nach dem Kauf, nach denen PDF und Token-Link gelöscht werden. Philip legt die Dauer fest. */
export const SV_PURGE_AFTER_DAYS = 30;

export const SV_KAUF_UNTERNEHMER =
  "Ich bestelle als Unternehmer (§ 14 BGB) für meine gewerbliche oder selbstständige berufliche Tätigkeit.";

export const SV_PDF_FAILED =
  "Die Erstellung Ihrer Standardfassung ist fehlgeschlagen. Es liegt kein PDF zum Download bereit. Einzelheiten zur Erstattung stehen in den AGB (§ 9).";

export const SV_COVER_TITLE = "Standardfassung, bitte prüfen";

export function svCoverBox(vorlage: string, erstelltAm = ""): string {
  const satz = erstelltAm
    ? `Diese Verfahrensdokumentation wurde am ${erstelltAm} als Standardfassung auf Basis der Angaben zu Branche und Größe erstellt.`
    : SV_BASIS_SATZ;
  return [
    `**${SV_COVER_TITLE}**`,
    "",
    satz,
    "",
    `Anschrift: ________`,
    `gültig ab: ________ (nach Prüfung und Freigabe durch die Geschäftsführung eintragen)`,
    "",
    `Dieses Dokument wurde aus der Branchenvorlage „${vorlage}“ und 6 Eckdaten des Betriebs erzeugt. Die beschriebenen Abläufe sind branchentypische Annahmen, keine festgestellten Abläufe des Betriebs. Stellen mit „(bitte prüfen)“ und Lücken „____“ sind vom Betrieb zu ergänzen. Erst nach Prüfung, Ergänzung und Freigabe durch die Geschäftsführung gibt das Dokument die Verfahren des Betriebs wieder. Keine steuerliche oder rechtliche Beratung.`,
  ].join("\n");
}

export const SV_FOOTER =
  "Standardfassung – vor Freigabe durch die Geschäftsführung prüfen · Keine Steuer- oder Rechtsberatung";

export function svFooterLine(einzelunternehmen = false): string {
  const wer = einzelunternehmen ? "die Inhaberin bzw. den Inhaber" : "die Geschäftsführung";
  return `Standardfassung – vor Freigabe durch ${wer} prüfen · Keine Steuer- oder Rechtsberatung`;
}

export function svHeaderLine(firma: string, datum: string): string {
  return `Verfahrensdokumentation · ${firma} · Standardfassung vom ${datum}`;
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

export function svClosingPage(options: { self?: boolean; kasse?: boolean; gastro?: boolean; kasseArt?: string; solo?: boolean } = {}): string {
  const self = options.self === true;
  const solo = options.solo === true;
  const kasse = options.kasse === true;
  const gastro = options.gastro === true;
  const punkte: Array<readonly [string, string]> = [
    ["Prüfung und Freigabe", "Die Geschäftsführung prüft das Dokument, ersetzt offene Angaben durch eigene Angaben, unterschreibt und trägt „gültig ab“ ein."],
  ];
  const art = options.kasseArt ?? "";
  const kassenText =
    art === "Ja, offene Ladenkasse (ohne elektronisches System)"
      ? "Offene Ladenkasse: täglicher Kassenbericht, retrograd ab gezähltem Endbestand, mit Zählprotokoll (nicht vorgeschrieben, aber empfohlen als Nachweis des Auszählens). Wer zählt und den Bericht führt, ist einzutragen. Werden Einzelaufzeichnungen geführt oder wird die Ausnahme genutzt?"
      : art === "Unsicher"
        ? "Kassenart (elektronisch mit TSE oder offene Ladenkasse) ist festzulegen. Bei elektronischer Kasse: Kassen- und TSE-Seriennummer und das Datum der ELSTER-Mitteilung nach § 146a Abs. 4 AO. Bei offener Ladenkasse: Kassenbericht und Zählprotokoll (nicht vorgeschrieben, aber empfohlen als Nachweis des Auszählens)."
        : "Kassenart (elektronisches Aufzeichnungssystem mit TSE), Kassen- und TSE-Seriennummer, Datum der ELSTER-Mitteilung nach § 146a Abs. 4 AO, Tagesabschluss.";
  const kassenPunkt: readonly [string, string] = ["Kasse", kassenText];
  if (kasse && gastro) punkte.push(kassenPunkt);
  punkte.push(
    ["Zuständigkeiten und Vertretung", solo
      ? "Wer handelt bei Krankheit oder Urlaub (z. B. Vollmacht für Steuerberatung, Bank)?"
      : "Wer ist wofür zuständig, wer vertritt, wer gibt Zahlungen frei?"],
    ["Belegeingang und E-Rechnung", "Über welche Wege gehen Belege ein, wer erfasst sie, wo wird die E-Rechnung (XML) aufbewahrt?"],
  );
  if (kasse && !gastro) punkte.splice(1, 0, kassenPunkt);
  punkte.push(
    ["Systeme", "Welche Programme werden eingesetzt (Name, Anbieter, Cloud oder lokal), stimmt die Systemübersicht?"],
    ["Archiv, Unveränderbarkeit und Sicherung", "Wo liegen die Unterlagen, wie sind sie gegen Änderung geschützt, wer sichert wie oft? Fristen: Bücher und Aufzeichnungen 10 Jahre, Buchungsbelege 8 Jahre, Geschäftsbriefe 6 Jahre."],
  );
  punkte.push(
    solo
      ? ["Lohn", "Gibt es Beschäftigte (auch Minijob, Aushilfe)? Falls ja: Lohnabrechnung intern oder extern."]
      : [self ? "Lohn" : "Übergabe an Kanzlei bzw. Lohnbüro", LOHN_SATZ],
  );
  const points = punkte.map(([titel, frage]) => `**${titel}.** ${frage}`).join("\n\n");
  return ["# Vom Betrieb zu ergänzende Punkte", "", points].join("\n");
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
