/**
 * Neue Fragen der 24 Module (Themen ohne bisherigen Bereich).
 * Regel wie im Katalog: nur „bestätigt“ wird Präsens-Ist; „vorgesehen“ und
 * „weiß ich nicht“ werden offene Punkte. Hinweise beschreiben die Rechtslage
 * allgemein und bestätigen keine betriebliche Umsetzung.
 */
import type { BereichField, BereichKontrolle, BereichQuestion } from "@/lib/bereiche";

const text = (key: string, label: string, required = true): BereichField => ({ key, type: "text", label, required });
const area = (key: string, label: string, required = true): BereichField => ({ key, type: "textarea", label, required });
const pick = (key: string, label: string, options: string[]): BereichField => ({ key, type: "enum", label, options });
const many = (key: string, label: string, options: string[]): BereichField => ({ key, type: "multi", label, options });

const JNU = ["ja", "nein", "unbekannt"];

function q(
  id: string,
  title: string,
  prompt: string,
  fields: BereichField[],
  open: string,
  options: { priority?: "hoch" | "mittel" | "niedrig"; hint?: string } = {},
): BereichQuestion {
  return { id, title, prompt, fields, open, priority: options.priority ?? "mittel", ...(options.hint ? { hint: options.hint } : {}) };
}

function lead(prefix: string, modul: string): BereichQuestion {
  return q(
    `${prefix}00`,
    "Verantwortung und Vertretung",
    `Wer ist für „${modul}“ verantwortlich und wer vertritt?`,
    [text("verantwortlich", "Verantwortlich (Name oder Rolle)"), text("vertretung", "Vertretung", false)],
    `Verantwortung und Vertretung für „${modul}“ sind nicht bestätigt.`,
    { priority: "hoch", hint: "Name oder Rolle genügt. Die Vertretung übernimmt bei Urlaub, Krankheit oder Ausscheiden." },
  );
}

/** Kontrollfrage eines Moduls (Id Präfix + 92, wie bei den Bereichen). */
export function kontrollFrage(prefix: string, modul: string, kontrollen: BereichKontrolle[]): BereichQuestion {
  return q(
    `${prefix}92`,
    "Kontrollen im Modul",
    `Welche Kontrollen finden für „${modul}“ heute tatsächlich statt?`,
    [many("kontrollen", "Durchgeführte Kontrollen", kontrollen.map((item) => item.name)), area("details", "Turnus, wer, Nachweis je Kontrolle")],
    `Die Kontrollen für „${modul}“ (Turnus, Person, Nachweis) sind nicht bestätigt.`,
    { priority: "mittel", hint: "Nur Kontrollen auswählen, die heute wirklich laufen. Für jede Kontrolle Turnus, ausführende Person und Nachweis nennen." },
  );
}

export type FragenGruppe = {
  prefix: string;
  questions: BereichQuestion[];
  kontrollen: BereichKontrolle[];
};

function gruppe(prefix: string, modul: string, questions: BereichQuestion[], kontrollen: BereichKontrolle[]): FragenGruppe {
  return { prefix, questions: kontrollen.length ? [...questions, kontrollFrage(prefix, modul, kontrollen)] : questions, kontrollen };
}

// ---------------------------------------------------------------- Modul 1
export const UO = gruppe("UO", "Unternehmen und Organisation", [
  q("UO01", "Gesellschaften und Standorte", "Welche Gesellschaften, Betriebsstätten und Standorte umfasst diese Verfahrensdokumentation?", [
    area("gesellschaften", "Gesellschaften (Name, Rechtsform, Steuernummer optional)"),
    area("standorte", "Standorte und Betriebsstätten", false),
  ], "Gesellschaften und Standorte im Geltungsbereich sind nicht bestätigt.", { priority: "hoch" }),
  q("UO02", "Tätigkeiten und Geschäftsvorfälle", "Welche Tätigkeiten und typischen Geschäftsvorfälle hat der Betrieb (z. B. Verkauf an Privat- oder Geschäftskunden, Dienstleistung, Vermietung)?", [
    area("taetigkeiten", "Tätigkeiten und Umsatzarten"),
    many("kunden", "Kundengruppen", ["Privatkunden (B2C)", "Geschäftskunden (B2B)", "Öffentliche Auftraggeber", "Ausland / EU"]),
  ], "Tätigkeiten und typische Geschäftsvorfälle sind nicht bestätigt."),
  q("UO03", "Zuständigkeiten", "Wer ist für Buchhaltung, Belegwesen, IT und diese Dokumentation zuständig?", [
    area("zustaendigkeiten", "Aufgabe und zuständige Person oder Rolle"),
    pick("organigramm", "Organigramm oder Aufgabenliste vorhanden", JNU),
  ], "Zuständigkeiten für Buchhaltung, Belegwesen und IT sind nicht bestätigt.", { priority: "hoch" }),
  q("UO04", "Vertretungsregelung", "Wie ist die Vertretung bei Abwesenheit geregelt (Urlaub, Krankheit, Ausscheiden)?", [
    area("vertretung", "Vertretungsregelung"),
    pick("schriftlich", "Schriftlich festgehalten", JNU),
  ], "Die Vertretungsregelung ist nicht bestätigt."),
  q("UO05", "Zeichnungs- und Freigabebefugnisse", "Wer darf Verträge abschließen, Zahlungen freigeben und Rechnungen genehmigen, und bis zu welcher Grenze?", [
    area("befugnisse", "Befugnis, Person oder Rolle, Betragsgrenze"),
  ], "Zeichnungs- und Freigabebefugnisse sind nicht bestätigt."),
  q("UO06", "Geltungsbereich und Abgrenzung", "Für welchen Zeitraum und welche Teile des Betriebs gilt diese Fassung, und was ist ausdrücklich nicht erfasst?", [
    area("geltung", "Geltungsbereich"),
    text("ausgenommen", "Nicht erfasst und wo dokumentiert", false),
  ], "Geltungsbereich und Abgrenzung der Fassung sind nicht bestätigt.", { priority: "hoch" }),
], []);

// ---------------------------------------------------------------- Modul 2
export const LE = gruppe("LE", "Verkauf und Leistungserbringung", [
  q("LE01", "Auftragsänderungen und Nachträge", "Wie werden Änderungen eines Auftrags (Umfang, Preis, Termin) erfasst und bestätigt?", [
    area("ablauf", "Ablauf und Form der Bestätigung"),
    text("wer", "Wer bestätigt Änderungen", false),
  ], "Erfassung und Bestätigung von Auftragsänderungen sind nicht bestätigt."),
  q("LE02", "Lieferung und Leistungsnachweis", "Wie wird nachgewiesen, dass geliefert oder geleistet wurde (Lieferschein, Leistungsnachweis, Stundenzettel, Protokoll)?", [
    many("nachweis", "Nachweisarten", ["Lieferschein", "Leistungsnachweis / Stundenzettel", "Abnahmeprotokoll", "Versandnachweis", "Digitaler Nachweis im System"]),
    text("ablage", "Wo liegt der Nachweis", false),
  ], "Der Nachweis von Lieferung oder Leistung ist nicht bestätigt.", { priority: "hoch" }),
  q("LE03", "Abnahmen", "Gibt es Abnahmen durch den Kunden, und wie werden sie dokumentiert?", [
    area("ablauf", "Ablauf der Abnahme"),
    pick("protokoll", "Abnahmeprotokoll wird erstellt", JNU),
  ], "Ablauf und Dokumentation von Abnahmen sind nicht bestätigt.", { priority: "niedrig" }),
  q("LE04", "Wiederkehrende Leistungen", "Gibt es Verträge mit wiederkehrender Abrechnung (Abos, Wartung, Miete), und wie wird die Abrechnung ausgelöst?", [
    area("ablauf", "Verträge und Auslöser der Abrechnung"),
  ], "Die Abrechnung wiederkehrender Leistungen ist nicht bestätigt.", { priority: "niedrig" }),
  q("LE05", "Vollständige Abrechnung", "Wie wird sichergestellt, dass jede erbrachte Leistung abgerechnet wird?", [
    area("ablauf", "Abgleich Leistung – Rechnung"),
    text("wer", "Wer gleicht ab", false),
  ], "Der Abgleich erbrachter Leistungen mit den Rechnungen ist nicht bestätigt.", { priority: "hoch" }),
], [
  { name: "Abgleich erbrachter Leistungen mit Rechnungen", zweck: "Keine Leistung bleibt unberechnet." },
  { name: "Freigabe von Angeboten und Sonderpreisen", zweck: "Preise und Konditionen sind autorisiert." },
  { name: "Prüfung des Leistungsnachweises vor Rechnungsstellung", zweck: "Rechnung entspricht der erbrachten Leistung." },
  { name: "Durchsicht offener Aufträge", zweck: "Abgeschlossene Aufträge werden zeitnah abgerechnet." },
]);

// ---------------------------------------------------------------- Modul 4
export const AR = gruppe("AR", "Ausgangsrechnungen und Korrekturen", [
  lead("AR", "Ausgangsrechnungen und Korrekturen"),
  q("AR01", "Abschlags- und Schlussrechnungen", "Werden Abschlags-, Teil- oder Anzahlungsrechnungen gestellt, und wie werden sie in der Schlussrechnung verrechnet?", [
    area("ablauf", "Ablauf und Verrechnung"),
  ], "Abschlags- und Schlussrechnungen sind nicht bestätigt.", { hint: "In der Schlussrechnung werden vereinnahmte Anzahlungen und die darauf entfallende Umsatzsteuer abgezogen." }),
  q("AR02", "Gutschriften", "Werden Gutschriften erstellt – als Abrechnung durch den Leistungsempfänger oder als Korrektur einer Rechnung?", [
    many("art", "Art", ["Abrechnungsgutschrift (Leistungsempfänger rechnet ab)", "Korrektur / Rechnungsminderung", "keine"]),
    text("bezeichnung", "Bezeichnung auf dem Beleg", false),
  ], "Art und Bezeichnung von Gutschriften sind nicht bestätigt.", { hint: "Eine umsatzsteuerliche Gutschrift (§ 14 Abs. 2 Satz 2 UStG) trägt die Angabe „Gutschrift“. Eine kaufmännische Gutschrift ist eine Rechnungskorrektur und sollte nicht so bezeichnet werden." }),
  q("AR03", "Stornos und Berichtigungen", "Wie wird eine fehlerhafte Rechnung storniert oder berichtigt, und wer gibt das frei?", [
    area("ablauf", "Ablauf mit Bezug zur Ursprungsrechnung"),
    text("freigabe", "Freigabe durch", false),
  ], "Storno und Berichtigung von Ausgangsrechnungen sind nicht bestätigt.", { priority: "hoch", hint: "Eine Berichtigung muss sich spezifisch und eindeutig auf die ursprüngliche Rechnung beziehen (§ 31 Abs. 5 UStDV). Die ursprüngliche Rechnung wird nicht gelöscht." }),
  q("AR04", "Rechnungsdoppel und Archiv", "Wo und in welchem Format wird das Doppel jeder Ausgangsrechnung aufbewahrt?", [
    text("ort", "Ablageort"),
    text("format", "Format (PDF, XML, Papier)", false),
  ], "Aufbewahrung der Rechnungsdoppel ist nicht bestätigt."),
], [
  { name: "Lückenprüfung der Rechnungsnummern", zweck: "Jede Nummer ist vergeben und nachvollziehbar." },
  { name: "Vier-Augen-Prüfung vor Versand", zweck: "Pflichtangaben und Beträge sind richtig." },
  { name: "Abgleich Rechnungsausgangsbuch mit Buchhaltung", zweck: "Alle Ausgangsrechnungen sind gebucht." },
  { name: "Freigabe von Storno und Gutschrift", zweck: "Korrekturen sind autorisiert und begründet." },
]);

// ---------------------------------------------------------------- Modul 5
export const ER = gruppe("ER", "Elektronische Belege und E-Rechnungen", [
  lead("ER", "Elektronische Belege und E-Rechnungen"),
  q("ER01", "Empfangskanäle", "Über welche Kanäle kommen elektronische Belege und E-Rechnungen an?", [
    many("kanaele", "Kanäle", ["E-Mail-Postfach", "Lieferantenportal", "Peppol / Netzwerk", "Upload in Buchhaltungssoftware", "Schnittstelle (EDI)"]),
    text("postfach", "Zentrales Postfach oder Portal", false),
  ], "Empfangskanäle für elektronische Belege sind nicht bestätigt.", { hint: "Seit 01.01.2025 müssen inländische Unternehmen E-Rechnungen im B2B-Bereich empfangen können." }),
  q("ER02", "Anzeige und Prüfung", "Wie werden E-Rechnungen lesbar gemacht und geprüft (Viewer, Validierung, Rechnungsprüfung)?", [
    text("viewer", "Viewer oder Software"),
    pick("validierung", "Technische Validierung findet statt", JNU),
  ], "Anzeige und Prüfung von E-Rechnungen sind nicht bestätigt."),
  q("ER03", "Erstellung und Versand", "Werden E-Rechnungen erstellt und versendet, und in welchem Format?", [
    many("format", "Format", ["XRechnung", "ZUGFeRD", "anderes strukturiertes Format", "noch nicht (PDF oder Papier)"]),
    text("system", "System für Erstellung und Versand", false),
  ], "Erstellung und Versand von E-Rechnungen sind nicht bestätigt.", { hint: "Die Pflicht, E-Rechnungen auszustellen, gilt schrittweise ab 2027 und 2028 (Übergangsregeln, mit der Kanzlei abstimmen)." }),
  q("ER04", "Speicherung der strukturierten Daten", "Wie wird der strukturierte Datensatz (XML) unverändert gespeichert und mit der Buchung verbunden?", [
    area("ablauf", "Speicherort und Verknüpfung"),
    pick("unveraendert", "Original-XML bleibt unverändert", JNU),
  ], "Unveränderte Speicherung der strukturierten Rechnungsdaten ist nicht bestätigt.", { priority: "hoch", hint: "Aufbewahrt wird mindestens der strukturierte Teil im Originalformat. Den Umgang mit dem Bildteil hybrider Formate legt das Unternehmen fest (Abstimmung mit der Kanzlei empfohlen)." }),
  q("ER05", "Sonstige elektronische Belege", "Wie werden sonstige elektronische Belege behandelt (PDF-Rechnungen, E-Mails mit Belegfunktion, App-Belege, Kontoauszüge als Datei)?", [
    area("ablauf", "Ablauf je Belegart"),
  ], "Behandlung sonstiger elektronischer Belege ist nicht bestätigt.", { hint: "E-Mails mit Belegfunktion oder als Handels- oder Geschäftsbrief sind aufzubewahren; eine reine Transport-E-Mail nicht." }),
  q("ER06", "Konvertierung", "Werden elektronische Belege umgewandelt (z. B. in PDF/A oder ein anderes Format), und bleibt das Original erhalten?", [
    pick("konvertierung", "Konvertierung findet statt", JNU),
    text("original", "Was wird zusätzlich zum Original gespeichert", false),
  ], "Umgang mit konvertierten elektronischen Belegen ist nicht bestätigt.", { priority: "niedrig" }),
], [
  { name: "Tägliche Sichtung des Rechnungspostfachs", zweck: "Kein elektronischer Beleg geht verloren." },
  { name: "Validierung strukturierter Rechnungen", zweck: "Formfehler werden vor der Buchung erkannt." },
  { name: "Abgleich Postfach mit Belegerfassung", zweck: "Jeder empfangene Beleg ist erfasst." },
  { name: "Stichprobe: XML und Buchung stimmen überein", zweck: "Gebuchte Werte entsprechen dem Original." },
]);

// ---------------------------------------------------------------- Modul 6
export const PB = gruppe("PB", "Papierbelege und Digitalisierung", [
  lead("PB", "Papierbelege und Digitalisierung"),
  q("PB01", "Scanvorgang", "Wie werden Papierbelege gescannt oder fotografiert (Gerät, App, Einstellungen, Zeitpunkt)?", [
    text("geraet", "Gerät oder App"),
    area("ablauf", "Ablauf und Zeitpunkt"),
  ], "Der Scanvorgang ist nicht bestätigt."),
  q("PB02", "Qualitätskontrolle", "Wer prüft gescannte Belege auf Vollständigkeit und Lesbarkeit (Vorder- und Rückseite, Anlagen)?", [
    text("wer", "Wer prüft"),
    text("kriterien", "Prüfkriterien", false),
  ], "Die Qualitätskontrolle gescannter Belege ist nicht bestätigt.", { priority: "hoch" }),
  q("PB03", "Übergabe ins Archiv", "Wie gelangt das Scanbild ins Archiv, und mit welchen Merkmalen wird es abgelegt?", [
    area("ablauf", "Übergabe und Indexierung"),
  ], "Übergabe der Scans ins Archiv ist nicht bestätigt."),
  q("PB04", "Aufbewahrung der Papieroriginale", "Wo und wie lange werden Papieroriginale aufbewahrt?", [
    text("ort", "Ablageort"),
    text("dauer", "Dauer", false),
  ], "Aufbewahrung der Papieroriginale ist nicht bestätigt."),
  q("PB05", "Vernichtung der Originale", "Werden Papieroriginale nach dem Scannen vernichtet? Wenn ja: wann, durch wen, mit welcher Freigabe und mit welchen Ausnahmen?", [
    pick("vernichtung", "Vernichtung nach dem Scannen", ["ja", "nein", "unbekannt"]),
    area("regel", "Zeitpunkt, Freigabe, Ausnahmen", false),
  ], "Regel zur Vernichtung von Papieroriginalen ist nicht bestätigt.", { priority: "hoch", hint: "Ersetzendes Scannen setzt eine beschriebene und eingehaltene Verfahrensweise voraus. Unterlagen, bei denen das Papieroriginal Bedeutung behält, werden nicht vernichtet – im Zweifel mit der Kanzlei abstimmen." }),
  q("PB06", "Mobiles Erfassen", "Werden Belege unterwegs mit dem Smartphone erfasst, und was geschieht danach mit dem Papierbeleg?", [
    area("ablauf", "Ablauf"),
  ], "Mobiles Erfassen von Belegen ist nicht bestätigt.", { priority: "niedrig" }),
], [
  { name: "Vollständigkeitsprüfung nach dem Scannen", zweck: "Jede Seite ist erfasst." },
  { name: "Lesbarkeitsprüfung", zweck: "Bildqualität reicht für die Aufbewahrungsfrist." },
  { name: "Freigabe vor Vernichtung", zweck: "Kein Original wird ohne Prüfung vernichtet." },
  { name: "Abgleich Posteingang mit Scans", zweck: "Kein Papierbeleg bleibt unbearbeitet." },
]);

// ---------------------------------------------------------------- Modul 7
export const ZD = gruppe("ZD", "Zahlungsdienstleister und offene Posten", [
  q("ZD01", "Zahlungsdienstleister und Kartenzahlung", "Welche Zahlungsdienstleister und Kartenterminals werden genutzt, und wie oft wird ausgezahlt?", [
    area("anbieter", "Anbieter, Zahlungsarten, Auszahlungsrhythmus"),
  ], "Zahlungsdienstleister und Auszahlungsrhythmus sind nicht bestätigt."),
  q("ZD02", "Gebühren und Auszahlungsabrechnungen", "Wie werden Gebühren- und Auszahlungsabrechnungen abgerufen, abgelegt und gebucht?", [
    area("ablauf", "Abruf, Ablage, Buchung"),
  ], "Behandlung von Gebühren- und Auszahlungsabrechnungen ist nicht bestätigt.", { hint: "Auszahlungen sind meist Sammelbeträge. Für die Nachvollziehbarkeit werden Umsätze, Gebühren und Rückbuchungen einzeln aus der Abrechnung abgeleitet." }),
  q("ZD03", "Rückzahlungen und Rückbelastungen", "Wie werden Erstattungen an Kunden und Rückbelastungen (Chargebacks, Rücklastschriften) bearbeitet und belegt?", [
    area("ablauf", "Ablauf und Beleg"),
    text("freigabe", "Freigabe durch", false),
  ], "Bearbeitung von Rückzahlungen und Rückbelastungen ist nicht bestätigt."),
  q("ZD04", "Abgleich offener Posten", "Wie werden offene Posten (Debitoren und Kreditoren) mit Zahlungen abgeglichen, und wer klärt Differenzen?", [
    area("ablauf", "Abgleich und Klärung"),
    text("turnus", "Turnus", false),
  ], "Abgleich offener Posten mit Zahlungen ist nicht bestätigt.", { priority: "hoch" }),
], []);

// ---------------------------------------------------------------- Modul 9
export const BU = gruppe("BU", "Buchführung und Abschlüsse", [
  lead("BU", "Buchführung und Abschlüsse"),
  q("BU01", "Belegzuordnung und Kontierung", "Wer ordnet Belege zu und kontiert sie, nach welchem Kontenrahmen und mit welchen Hilfen (Buchungsregeln, Vorschläge)?", [
    text("wer", "Wer kontiert"),
    pick("kontenrahmen", "Kontenrahmen", ["SKR 03", "SKR 04", "anderer", "unbekannt"]),
    text("regeln", "Automatische Buchungsregeln oder Vorschläge", false),
  ], "Belegzuordnung und Kontierung sind nicht bestätigt.", { priority: "hoch" }),
  q("BU02", "Buchungsrhythmus und Festschreibung", "Wie zeitnah wird gebucht, und wann werden Buchungen festgeschrieben?", [
    text("rhythmus", "Buchungsrhythmus"),
    text("festschreibung", "Festschreibung (wann, durch wen)"),
  ], "Buchungsrhythmus und Festschreibung sind nicht bestätigt.", { priority: "hoch", hint: "Buchungen und Aufzeichnungen dürfen nicht so verändert werden, dass der ursprüngliche Inhalt nicht mehr feststellbar ist (§ 146 Abs. 4 AO). Die Festschreibung verhindert spätere Änderungen im System." }),
  q("BU03", "Korrekturen", "Wie werden Fehler nach der Buchung korrigiert (Storno- und Korrekturbuchung), und wer gibt das frei?", [
    area("ablauf", "Ablauf"),
    text("freigabe", "Freigabe durch", false),
  ], "Ablauf von Korrekturbuchungen ist nicht bestätigt."),
  q("BU04", "Abstimmungen", "Welche Konten und Bestände werden regelmäßig abgestimmt?", [
    many("abstimmungen", "Abstimmungen", ["Bank", "Kasse", "Offene Posten Debitoren", "Offene Posten Kreditoren", "Lohnverrechnung", "Umsatzsteuer", "Zahlungsdienstleister"]),
    text("turnus", "Turnus und wer", false),
  ], "Regelmäßige Abstimmungen sind nicht bestätigt.", { priority: "hoch" }),
  q("BU05", "Umsatzsteuer-Voranmeldung", "Wer erstellt die Umsatzsteuer-Voranmeldung, wer prüft sie, und in welchem Rhythmus?", [
    text("erstellt", "Erstellt durch"),
    text("prueft", "Geprüft durch", false),
    pick("rhythmus", "Rhythmus", ["monatlich", "vierteljährlich", "jährlich", "unbekannt"]),
  ], "Erstellung und Prüfung der Umsatzsteuer-Voranmeldung sind nicht bestätigt."),
  q("BU06", "Abschlussarbeiten", "Welche Arbeiten gehören zum Monats- und Jahresabschluss, und wer erledigt sie?", [
    area("arbeiten", "Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)"),
    text("wer", "Wer", false),
  ], "Abschlussarbeiten und Zuständigkeiten sind nicht bestätigt."),
  q("BU07", "Übergabe an die Kanzlei", "Was wird wann und auf welchem Weg an die Kanzlei übergeben, und wie wird die Übergabe nachgewiesen?", [
    area("ablauf", "Inhalt, Termin, Weg"),
    text("nachweis", "Nachweis der Übergabe", false),
  ], "Übergabe an die Kanzlei ist nicht bestätigt."),
], [
  { name: "Monatliche Bankabstimmung", zweck: "Kontostand Buchhaltung entspricht der Bank." },
  { name: "Durchsicht offener Posten", zweck: "Forderungen und Verbindlichkeiten sind aktuell." },
  { name: "Verprobung der Umsatzsteuer", zweck: "Voranmeldung passt zu den Erlösen und Vorsteuern." },
  { name: "Prüfung vor Festschreibung", zweck: "Nur geprüfte Buchungen werden festgeschrieben." },
  { name: "Abstimmung Vorsysteme mit Buchhaltung", zweck: "Kasse, Shop und Lohn sind vollständig übernommen." },
]);

// ---------------------------------------------------------------- Modul 14
export const BRANCHEN_ARTEN = [
  "Bau- und Handwerksprojekte",
  "Vermietung und Verpachtung",
  "Praxis (Heilberufe)",
  "Gastronomie und Hotel",
  "Taxi und Personenbeförderung",
  "Produktion und Fertigung",
  "Sonstige Branche",
];

export const BS = gruppe("BS", "Branchenspezifische Abläufe", [
  lead("BS", "Branchenspezifische Abläufe"),
  q("BS01", "Branchenspezifische Vorgänge", "Welche branchentypischen Vorgänge mit steuerlicher Bedeutung gibt es?", [
    many("art", "Branche", BRANCHEN_ARTEN),
    area("vorgaenge", "Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträge)"),
  ], "Branchenspezifische Vorgänge sind nicht bestätigt.", { priority: "hoch" }),
  q("BS02", "Branchensoftware", "Welche Branchensoftware oder Geräte erzeugen steuerrelevante Daten (z. B. Projektsoftware, Hausverwaltung, Praxissoftware, Hotelsoftware, Taxameter, Fertigungssteuerung)?", [
    area("systeme", "System oder Gerät, Zweck, Anbieter"),
  ], "Branchensoftware und Geräte sind nicht bestätigt.", { priority: "hoch" }),
  q("BS03", "Erfassung der Grunddaten", "Wie und von wem werden die branchentypischen Grunddaten erfasst (z. B. Aufmaß, Stunden, Zählerstände, Behandlungen, Fahrten, Materialverbrauch)?", [
    area("ablauf", "Erfassung, wer, wann"),
  ], "Erfassung der branchentypischen Grunddaten ist nicht bestätigt."),
  q("BS04", "Nachweise", "Welche Nachweise belegen diese Vorgänge (z. B. Bautagebuch, Stundenzettel, Mietvertrag, Behandlungsdokumentation, Fahrtenaufzeichnung, Fertigungsauftrag)?", [
    area("nachweise", "Nachweis und Ablageort"),
  ], "Nachweise der branchentypischen Vorgänge sind nicht bestätigt.", { priority: "hoch" }),
  q("BS05", "Abrechnung", "Wie werden die Vorgänge abgerechnet (z. B. Abschlagsrechnungen, Nebenkostenabrechnung, Abrechnung mit Kostenträgern, Fahrpreise, Kalkulation)?", [
    area("ablauf", "Abrechnungsweg"),
  ], "Abrechnung der branchentypischen Vorgänge ist nicht bestätigt."),
  q("BS06", "Besondere steuerliche Regeln", "Gibt es besondere steuerliche Regeln, die im Ablauf beachtet werden (z. B. Steuerschuldnerschaft des Leistungsempfängers bei Bauleistungen, Option zur Umsatzsteuer bei Vermietung, Steuerbefreiungen, Kassenpflichten bei Taxametern)?", [
    area("regeln", "Regel und wie sie im Ablauf umgesetzt wird"),
  ], "Besondere steuerliche Regeln im Branchenablauf sind nicht bestätigt.", { hint: "Allgemeine Beispiele, keine Bewertung des Einzelfalls. Die Anwendung im Betrieb mit der Kanzlei abstimmen." }),
  q("BS07", "Übergabe an die Buchhaltung", "Wie gelangen die Daten aus der Branchensoftware in die Buchhaltung?", [
    text("weg", "Weg (Schnittstelle, Export, manuell)"),
    text("turnus", "Turnus", false),
  ], "Übergabe der Branchendaten an die Buchhaltung ist nicht bestätigt."),
  q("BS08", "Aufbewahrung der Branchendaten", "Wo und wie lange werden die Daten und Nachweise der Branchensoftware aufbewahrt, und sind sie maschinell auswertbar?", [
    text("ablage", "Ablage"),
    pick("auswertbar", "Maschinell auswertbar exportierbar", JNU),
  ], "Aufbewahrung der Branchendaten ist nicht bestätigt."),
], [
  { name: "Abgleich Branchensoftware mit Buchhaltung", zweck: "Alle Vorgänge sind vollständig gebucht." },
  { name: "Prüfung der Nachweise vor Abrechnung", zweck: "Abrechnung entspricht den Grunddaten." },
  { name: "Prüfung besonderer Steuerregeln", zweck: "Sonderregeln werden richtig angewendet." },
]);

// ---------------------------------------------------------------- Modul 15
export const AW = gruppe("AW", "Archivierung und Wiederauffindbarkeit", [
  q("AW01", "Archivsystem", "In welchem System oder welcher Ablage werden die Originale aufbewahrt, getrennt nach elektronisch und Papier?", [
    text("elektronisch", "Elektronisches Archiv"),
    text("papier", "Papierablage", false),
  ], "Archivsystem und Ablage sind nicht bestätigt.", { priority: "hoch" }),
  q("AW02", "Suchmerkmale", "Mit welchen Merkmalen werden Unterlagen gefunden (z. B. Belegnummer, Datum, Partner, Betrag)?", [
    many("merkmale", "Suchmerkmale", ["Belegnummer / Beleg-ID", "Datum", "Geschäftspartner", "Betrag", "Rechnungsnummer", "Volltext"]),
  ], "Suchmerkmale sind nicht bestätigt."),
  q("AW03", "Verknüpfung Beleg und Buchung", "Wie ist jeder Beleg mit seiner Buchung verbunden (Belegbild an der Buchung, Beleg-ID)?", [
    area("ablauf", "Verknüpfung"),
  ], "Verknüpfung von Beleg und Buchung ist nicht bestätigt.", { priority: "hoch" }),
  q("AW04", "Lesbarkeit über die Frist", "Wie bleibt die Lesbarkeit über die gesamte Aufbewahrungsfrist gesichert (Formate, Programme, Altdaten)?", [
    area("ablauf", "Maßnahmen"),
  ], "Lesbarkeit über die Aufbewahrungsfrist ist nicht bestätigt.", { hint: "Unterlagen müssen während der Aufbewahrungsfrist verfügbar, unverzüglich lesbar und maschinell auswertbar sein (§ 147 Abs. 2 AO)." }),
  q("AW05", "Schutz vor unbemerkten Änderungen", "Wie wird verhindert, dass archivierte Unterlagen unbemerkt verändert oder gelöscht werden?", [
    many("massnahmen", "Maßnahmen", ["Schreibschutz / Unveränderbarkeit im Archiv", "Versionierung mit Protokoll", "Löschsperre bis Fristablauf", "Zugriff nur für wenige Personen"]),
    text("details", "Details", false),
  ], "Schutz archivierter Unterlagen vor Änderungen ist nicht bestätigt.", { priority: "hoch", hint: "Der ursprüngliche Inhalt muss feststellbar bleiben (§ 146 Abs. 4 AO)." }),
  q("AW06", "E-Mails", "Wie werden steuerrelevante E-Mails abgelegt (z. B. als Handels- oder Geschäftsbrief oder mit Belegfunktion)?", [
    area("ablauf", "Ablage"),
  ], "Ablage steuerrelevanter E-Mails ist nicht bestätigt.", { priority: "niedrig" }),
], [
  { name: "Stichprobe: Beleg zu Buchung auffindbar", zweck: "Progressive und retrograde Prüfung ist möglich." },
  { name: "Prüfung der Archivprotokolle", zweck: "Änderungen und Löschungen sind nachvollziehbar." },
  { name: "Lesbarkeitstest alter Bestände", zweck: "Altdaten bleiben lesbar." },
]);

// ---------------------------------------------------------------- Modul 16
export const AF = gruppe("AF", "Aufbewahrungsfristen und Löschung", [
  q("AF01", "Fristzuordnung", "Wie wird jeder Unterlagenart ihre Frist zugeordnet (z. B. Fristenliste, Kennzeichen im Archiv)?", [
    area("ablauf", "Verfahren der Zuordnung"),
    pick("liste", "Fristenliste vorhanden", JNU),
  ], "Zuordnung der Aufbewahrungsfristen ist nicht bestätigt.", { priority: "hoch" }),
  q("AF02", "Weitere Aufbewahrungsgründe", "Wie wird vor einer Löschung geprüft, ob Unterlagen noch gebraucht werden (offene Steuerfestsetzung, Außenprüfung, Rechtsstreit, andere Gesetze)?", [
    area("pruefung", "Prüfung vor Löschung"),
  ], "Prüfung weiterer Aufbewahrungsgründe vor Löschung ist nicht bestätigt.", { priority: "hoch", hint: "Die Aufbewahrungsfrist läuft nicht ab, solange Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO)." }),
  q("AF03", "Löschfreigabe", "Wer gibt eine Löschung oder Vernichtung frei, und gilt ein Vier-Augen-Prinzip?", [
    text("wer", "Freigabe durch"),
    pick("vierAugen", "Vier-Augen-Prinzip", JNU),
  ], "Löschfreigabe ist nicht bestätigt.", { priority: "hoch" }),
  q("AF04", "Durchführung und Protokoll", "Wie wird die Löschung durchgeführt und protokolliert?", [
    area("ablauf", "Durchführung"),
    pick("protokoll", "Löschprotokoll wird geführt", JNU),
  ], "Durchführung und Protokoll der Löschung sind nicht bestätigt."),
  q("AF05", "Datenschutz und Aufbewahrung", "Wie werden Löschwünsche nach Datenschutzrecht behandelt, solange Aufbewahrungspflichten bestehen?", [
    area("ablauf", "Vorgehen (z. B. Sperrung statt Löschung)"),
  ], "Verhältnis von Datenschutz-Löschung und Aufbewahrung ist nicht bestätigt.", { priority: "niedrig", hint: "Datenschutzrechtliche Löschpflichten treten zurück, soweit eine gesetzliche Aufbewahrungspflicht besteht (Art. 17 Abs. 3 Buchst. b DSGVO)." }),
], []);

// ---------------------------------------------------------------- Modul 17
export const SY = gruppe("SY", "Systeme und Datenübertragung", [
  q("SY01", "Hardware und Betriebsumgebung", "Auf welcher Hardware und in welcher Umgebung laufen die Systeme (Arbeitsplätze, Server, Cloud, mobile Geräte)?", [
    area("umgebung", "Umgebung"),
    pick("betrieb", "Betrieb überwiegend", ["Lokal installiert", "Cloud / Anbieter", "Gemischt"]),
  ], "Hardware und Betriebsumgebung sind nicht bestätigt."),
  q("SY02", "Schnittstellen", "Welche Schnittstellen übertragen steuerrelevante Daten (von wo nach wo, Format, Turnus, automatisch oder manuell)?", [
    area("schnittstellen", "Schnittstellen"),
  ], "Schnittstellen sind nicht bestätigt.", { priority: "hoch" }),
  q("SY03", "Importe, Exporte und Konvertierungen", "Welche Daten werden importiert, exportiert oder umgewandelt, und wie wird die Vollständigkeit geprüft?", [
    area("ablauf", "Vorgänge und Prüfung"),
  ], "Importe, Exporte und Konvertierungen sind nicht bestätigt.", { priority: "hoch" }),
  q("SY04", "Eigene Berechnungen und Automatisierungen", "Gibt es eigene Tabellen, Makros, Skripte oder Automatisierungen, die steuerrelevante Werte berechnen oder übertragen?", [
    pick("vorhanden", "Vorhanden", JNU),
    area("beschreibung", "Beschreibung (Zweck, Ersteller, Änderung)", false),
  ], "Eigene Berechnungen und Automatisierungen sind nicht bestätigt.", { hint: "Auch eine Tabellenkalkulation, aus der Buchungen entstehen, ist Teil des Verfahrens und wird mit ihrer Logik beschrieben." }),
  q("SY05", "Programmstände", "Wie werden eingesetzte Programmversionen festgehalten, damit nachvollziehbar bleibt, welcher Stand wann galt?", [
    area("ablauf", "Verzeichnis der Programmstände"),
  ], "Festhalten der Programmstände ist nicht bestätigt.", { hint: "Das beschriebene Verfahren muss dem in der Praxis eingesetzten entsprechen, insbesondere bei den Programmversionen (GoBD Rz. 154)." }),
  q("SY06", "Datenflussübersicht", "Gibt es eine Übersicht des Datenflusses von der Entstehung bis zur Buchung und Archivierung?", [
    pick("vorhanden", "Übersicht vorhanden", JNU),
    text("ort", "Ablageort", false),
  ], "Eine Datenflussübersicht ist nicht bestätigt.", { priority: "niedrig" }),
], [
  { name: "Abgleich Exportsummen mit Importsummen", zweck: "Übertragene Daten sind vollständig." },
  { name: "Fehlerprotokolle der Schnittstellen prüfen", zweck: "Abgebrochene Übertragungen werden erkannt." },
  { name: "Test nach Änderung einer Schnittstelle", zweck: "Änderungen verfälschen keine Daten." },
]);

// ---------------------------------------------------------------- Modul 18
export const ZR = gruppe("ZR", "Zugriffsrechte und Datensicherheit", [
  q("ZR01", "Rollen und Berechtigungen", "Welche Rollen mit welchen Rechten gibt es in den steuerrelevanten Systemen?", [
    area("rollen", "Rolle und Rechte je System"),
  ], "Rollen und Berechtigungen sind nicht bestätigt.", { priority: "hoch" }),
  q("ZR02", "Vergabe von Rechten", "Wer beantragt und wer genehmigt neue Zugänge und Rechte?", [
    text("antrag", "Antrag durch"),
    text("genehmigung", "Genehmigung durch"),
  ], "Vergabe von Rechten ist nicht bestätigt."),
  q("ZR03", "Entzug von Rechten", "Wie werden Rechte bei Austritt oder Aufgabenwechsel entzogen, und wie schnell?", [
    area("ablauf", "Ablauf"),
  ], "Entzug von Rechten bei Austritt oder Wechsel ist nicht bestätigt.", { priority: "hoch" }),
  q("ZR04", "Schutzmaßnahmen", "Welche technischen Schutzmaßnahmen bestehen?", [
    many("massnahmen", "Maßnahmen", ["Persönliche Zugänge (keine Sammelkonten)", "Zwei-Faktor-Anmeldung", "Passwortregeln", "Verschlüsselung", "Virenschutz und Updates", "Bildschirmsperre"]),
  ], "Technische Schutzmaßnahmen sind nicht bestätigt."),
  q("ZR05", "Protokollierung", "Werden Anmeldungen, Änderungen und Löschungen in den Systemen protokolliert, und wer wertet aus?", [
    pick("protokoll", "Protokollierung vorhanden", JNU),
    text("auswertung", "Auswertung durch", false),
  ], "Protokollierung von Zugriffen und Änderungen ist nicht bestätigt."),
], [
  { name: "Regelmäßige Prüfung der Berechtigungen", zweck: "Nur berechtigte Personen haben Zugriff." },
  { name: "Sperrung bei Austritt am letzten Arbeitstag", zweck: "Keine verwaisten Zugänge." },
  { name: "Auswertung der Änderungsprotokolle", zweck: "Unzulässige Änderungen werden erkannt." },
]);

// ---------------------------------------------------------------- Modul 19
export const SN = gruppe("SN", "Sicherung, Wiederherstellung und Notfälle", [
  q("SN01", "Sicherungskonzept", "Was wird wie oft wohin gesichert, und wie lange werden Sicherungen aufbewahrt?", [
    area("konzept", "Daten, Turnus, Ziel, Aufbewahrung"),
  ], "Das Sicherungskonzept ist nicht bestätigt.", { priority: "hoch" }),
  q("SN02", "Ausfallszenarien", "Welche Ausfälle sind bedacht (System, Internet, Strom, Anbieter, Verlust eines Geräts)?", [
    many("szenarien", "Szenarien", ["Systemausfall", "Internetausfall", "Stromausfall", "Ausfall oder Insolvenz eines Anbieters", "Verlust oder Diebstahl eines Geräts", "Schadsoftware"]),
  ], "Bedachte Ausfallszenarien sind nicht bestätigt."),
  q("SN03", "Ersatzverfahren", "Wie wird bei einem Ausfall weitergearbeitet (z. B. Papierbelege, Ersatzkasse, manuelle Aufzeichnung)?", [
    area("ablauf", "Ersatzverfahren"),
  ], "Ersatzverfahren bei Ausfall sind nicht bestätigt.", { priority: "hoch" }),
  q("SN04", "Nachbearbeitung", "Wie werden Ersatzaufzeichnungen nach dem Wiederanlauf nacherfasst und aufbewahrt?", [
    area("ablauf", "Nacherfassung und Nachweis"),
  ], "Nachbearbeitung nach einem Ausfall ist nicht bestätigt."),
  q("SN05", "Notfallkontakte", "Wer ist im Notfall zu informieren (intern, IT-Dienstleister, Anbieter)?", [
    area("kontakte", "Rolle oder Stelle (keine privaten Telefonnummern)"),
  ], "Notfallkontakte sind nicht bestätigt.", { priority: "niedrig" }),
], [
  { name: "Kontrolle der Sicherungsprotokolle", zweck: "Sicherungen laufen vollständig." },
  { name: "Wiederherstellungstest", zweck: "Sicherungen sind tatsächlich nutzbar." },
  { name: "Prüfung der Ersatzaufzeichnungen", zweck: "Nach Ausfall ist alles nacherfasst." },
]);

// ---------------------------------------------------------------- Modul 20
export const KF = gruppe("KF", "Kontrollen und Fehlerbehandlung", [
  q("KF01", "Vollständigkeitskontrollen", "Wie wird geprüft, dass alle Geschäftsvorfälle erfasst sind (z. B. Nummernlücken, Abgleich Vorsystem mit Buchhaltung)?", [
    area("kontrollen", "Kontrollen"),
  ], "Vollständigkeitskontrollen sind nicht bestätigt.", { priority: "hoch" }),
  q("KF02", "Richtigkeitskontrollen", "Wie wird die Richtigkeit geprüft (z. B. Vier-Augen-Prinzip, Plausibilitätsprüfungen, Stichproben)?", [
    area("kontrollen", "Kontrollen"),
  ], "Richtigkeitskontrollen sind nicht bestätigt.", { priority: "hoch" }),
  q("KF03", "Abweichungen und Fehler", "Wie werden festgestellte Abweichungen erfasst, geklärt, korrigiert und eskaliert?", [
    area("ablauf", "Ablauf"),
    text("wer", "Zuständig", false),
  ], "Behandlung von Abweichungen und Fehlern ist nicht bestätigt.", { priority: "hoch" }),
  q("KF04", "Kontrollnachweise", "Wie werden durchgeführte Kontrollen nachgewiesen und wie lange aufbewahrt?", [
    area("nachweis", "Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)"),
  ], "Nachweis durchgeführter Kontrollen ist nicht bestätigt."),
  q("KF05", "Überwachung des Kontrollsystems", "Wer überwacht, dass die Kontrollen tatsächlich durchgeführt werden?", [
    text("wer", "Überwachung durch"),
    text("turnus", "Turnus", false),
  ], "Überwachung des Kontrollsystems ist nicht bestätigt."),
], []);

// ---------------------------------------------------------------- Modul 21
export const AU = gruppe("AU", "Ausgelagerte Aufgaben", [
  q("AU01", "Buchhaltungsservice und weitere Dienstleister", "Welche Aufgaben übernehmen Buchhaltungsservice, Lohnbüro oder andere Dienstleister?", [
    area("dienstleister", "Dienstleister und Aufgaben"),
  ], "Aufgaben externer Dienstleister sind nicht bestätigt."),
  q("AU02", "IT- und Cloud-Dienstleister", "Welche IT- und Cloud-Dienstleister betreiben oder speichern steuerrelevante Systeme und Daten, und wo werden die Daten gespeichert?", [
    area("dienstleister", "Anbieter, Leistung, Speicherort"),
  ], "IT- und Cloud-Dienstleister sind nicht bestätigt.", { priority: "hoch" }),
  q("AU03", "Übergaben", "Was wird an Dienstleister übergeben und zurückgegeben, wann und wie wird das nachgewiesen?", [
    area("ablauf", "Übergaben und Nachweis"),
  ], "Übergaben an Dienstleister sind nicht bestätigt."),
  q("AU04", "Kontrolle der Dienstleister", "Wie wird die Arbeit der Dienstleister kontrolliert (z. B. Abstimmung, Auswertungen, Prüfberichte oder Bescheinigungen des Anbieters)?", [
    area("kontrolle", "Kontrolle"),
  ], "Kontrolle ausgelagerter Aufgaben ist nicht bestätigt.", { priority: "hoch" }),
  q("AU05", "Verantwortungsgrenzen", "Wo endet die Aufgabe des Dienstleisters, und was bleibt beim Unternehmen?", [
    area("grenzen", "Abgrenzung"),
    pick("vertrag", "Vertrag oder Leistungsbeschreibung liegt vor", JNU),
  ], "Verantwortungsgrenzen bei ausgelagerten Aufgaben sind nicht bestätigt.", { priority: "hoch", hint: "Auch bei Auslagerung bleibt das Unternehmen für die Ordnungsmäßigkeit seiner Bücher und Aufzeichnungen verantwortlich." }),
  q("AU06", "Datenzugriff bei Dienstleistern", "Wie ist der Zugriff auf Daten beim Dienstleister während der Aufbewahrungsfrist und nach Vertragsende gesichert?", [
    area("zugriff", "Regelung"),
  ], "Datenzugriff bei Dienstleistern und nach Vertragsende ist nicht bestätigt."),
], []);

// ---------------------------------------------------------------- Modul 22
export const PZ = gruppe("PZ", "Prüfungszugriff und Datenbereitstellung", [
  q("PZ00", "Ansprechpartner", "Wer ist bei einer Außenprüfung oder Nachschau Ansprechpartner, und wer vertritt?", [
    text("ansprechpartner", "Ansprechpartner (Name oder Rolle)"),
    text("vertretung", "Vertretung", false),
  ], "Ansprechpartner für Außenprüfung und Nachschau sind nicht bestätigt.", { priority: "hoch" }),
  q("PZ01", "Unmittelbarer Zugriff (Z1)", "Kann für Prüfer ein Nur-Lese-Zugang in den Systemen eingerichtet werden? In welchen Systemen?", [
    pick("moeglich", "Nur-Lese-Zugang möglich", JNU),
    text("systeme", "Systeme", false),
  ], "Unmittelbarer Datenzugriff (Z1) ist nicht bestätigt.", { hint: "Die Finanzverwaltung kann bei einer Außenprüfung Einsicht in die gespeicherten Daten nehmen und das System dazu nutzen (§ 147 Abs. 6 AO)." }),
  q("PZ02", "Mittelbarer Zugriff (Z2)", "Wer kann Auswertungen nach Vorgabe der Prüfer erstellen?", [
    text("wer", "Wer erstellt Auswertungen"),
  ], "Mittelbarer Datenzugriff (Z2) ist nicht bestätigt."),
  q("PZ03", "Datenträgerüberlassung (Z3)", "Welche Daten können in welchem maschinell auswertbaren Format exportiert werden?", [
    area("exporte", "System und Exportformat (z. B. DATEV-Format, CSV, DSFinV-K)"),
  ], "Datenexport für die Datenträgerüberlassung (Z3) ist nicht bestätigt.", { priority: "hoch" }),
  q("PZ04", "Bereitstellung von Belegen", "Wie werden Belege zu ausgewählten Buchungen kurzfristig bereitgestellt?", [
    area("ablauf", "Ablauf"),
  ], "Bereitstellung von Belegen für die Prüfung ist nicht bestätigt."),
  q("PZ05", "Exporttest", "Wann wurde ein Prüfungsexport zuletzt praktisch getestet, und mit welchem Ergebnis?", [
    { key: "datum", type: "date", label: "Datum", required: false },
    text("ergebnis", "Ergebnis", false),
  ], "Ein praktischer Test des Prüfungsexports ist nicht bestätigt.", { priority: "hoch" }),
  q("PZ06", "Altdaten", "Wie bleibt der Zugriff auf Daten früherer Systeme während der Aufbewahrungsfrist erhalten?", [
    area("ablauf", "Regelung (z. B. Lesezugang, Export, Archivsystem)"),
  ], "Zugriff auf Altdaten früherer Systeme ist nicht bestätigt.", { priority: "hoch" }),
  q("PZ07", "Auswertungen und Journale", "Welche Standardauswertungen können bereitgestellt werden (Journal, Kontenblätter, Summen- und Saldenliste, Kassenbuch)?", [
    area("auswertungen", "Auswertungen und System"),
  ], "Bereitstellbare Standardauswertungen sind nicht bestätigt.", { priority: "niedrig" }),
], []);

// ---------------------------------------------------------------- Modul 23
export const AE = gruppe("AE", "System- und Prozessänderungen", [
  lead("AE", "System- und Prozessänderungen"),
  q("AE01", "Einführung neuer Systeme", "Wie wird ein neues System ausgewählt, getestet, freigegeben und dokumentiert?", [
    area("ablauf", "Ablauf"),
  ], "Einführung neuer Systeme ist nicht bestätigt."),
  q("AE02", "Updates und Versionswechsel", "Wie werden Updates eingespielt und geprüft, und wer entscheidet darüber?", [
    area("ablauf", "Ablauf"),
    text("wer", "Entscheidung durch", false),
  ], "Behandlung von Updates und Versionswechseln ist nicht bestätigt."),
  q("AE03", "Migration und Datenübernahme", "Wie werden Daten bei einem Systemwechsel übernommen und auf Vollständigkeit geprüft?", [
    area("ablauf", "Übernahme und Prüfung"),
  ], "Migration und Datenübernahme sind nicht bestätigt.", { priority: "hoch" }),
  q("AE04", "Stammdaten und Einstellungen", "Wer ändert steuerrelevante Einstellungen (Steuersätze, Konten, Buchungsregeln, Nummernkreise), und wird das protokolliert?", [
    text("wer", "Wer ändert"),
    pick("protokoll", "Protokolliert", JNU),
  ], "Änderung steuerrelevanter Einstellungen ist nicht bestätigt.", { priority: "hoch" }),
  q("AE05", "Ablaufänderungen", "Wie wird eine geänderte Arbeitsweise erkannt und in diese Dokumentation übernommen?", [
    area("ablauf", "Meldung und Übernahme"),
  ], "Übernahme geänderter Abläufe in die Dokumentation ist nicht bestätigt."),
  q("AE06", "Historische Nachvollziehbarkeit", "Wie bleibt nachvollziehbar, welcher System- und Ablaufstand zu welchem Zeitpunkt galt?", [
    area("ablauf", "Änderungsverzeichnis, Versionen, Gültigkeitszeiträume"),
  ], "Historische Nachvollziehbarkeit von Änderungen ist nicht bestätigt.", { hint: "Die Verfahrensdokumentation ist bei Änderungen zu versionieren, eine nachvollziehbare Änderungshistorie ist vorzuhalten (GoBD Rz. 154)." }),
], [
  { name: "Freigabe vor produktivem Einsatz", zweck: "Nur geprüfte Änderungen gehen in Betrieb." },
  { name: "Test nach Update oder Migration", zweck: "Daten und Berechnungen bleiben richtig." },
  { name: "Änderungsverzeichnis gepflegt", zweck: "Jeder Stand ist nachvollziehbar." },
]);

// ---------------------------------------------------------------- Modul 24
export const PF = gruppe("PF", "Pflege der Verfahrensdokumentation", [
  q("PF01", "Prüfturnus", "Wie oft wird geprüft, ob die Dokumentation noch der gelebten Praxis entspricht?", [
    pick("turnus", "Turnus", ["jährlich", "halbjährlich", "anlassbezogen", "unbekannt"]),
    text("wer", "Prüfung durch", false),
  ], "Prüfturnus der Dokumentation ist nicht bestätigt.", { priority: "hoch" }),
  q("PF02", "Meldung von Änderungen", "Wer meldet Änderungen in Abläufen oder Systemen an die für die Dokumentation zuständige Person?", [
    area("ablauf", "Meldeweg"),
  ], "Meldeweg für Änderungen an die Dokumentationsverantwortung ist nicht bestätigt."),
  q("PF03", "Freigabe durch die Geschäftsleitung", "Wie nimmt die Geschäftsleitung neue Fassungen zur Kenntnis oder gibt sie frei?", [
    area("ablauf", "Ablauf (z. B. Unterschrift, Freigabevermerk)"),
  ], "Freigabe neuer Fassungen durch die Geschäftsleitung ist nicht bestätigt.", { priority: "hoch" }),
], []);

export const NEUE_GRUPPEN: FragenGruppe[] = [UO, LE, AR, ER, PB, ZD, BU, BS, AW, AF, SY, ZR, SN, KF, AU, PZ, AE, PF];
