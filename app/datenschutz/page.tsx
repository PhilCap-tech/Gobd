import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: false },
};

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <h2>1. Verantwortlicher</h2>
      <p className="prose">
        Verantwortlicher im Sinne der DSGVO für die Website{" "}
        {LEGAL_OPERATOR.siteUrl} ({LEGAL_OPERATOR.product}) ist:
      </p>
      <p className="prose">
        {LEGAL_OPERATOR.name}
        <br />
        {LEGAL_OPERATOR.street}
        <br />
        {LEGAL_OPERATOR.zipCity}
        <br />
        {LEGAL_OPERATOR.country}
        <br />
        Telefon: {LEGAL_OPERATOR.phone}
        <br />
        E-Mail:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
      </p>

      <h2>2. Hosting</h2>
      <p className="prose">
        Die Website wird bei Vercel Inc. gehostet. Beim Aufruf können
        technisch notwendige Server-Logdaten verarbeitet werden (z.&nbsp;B.
        IP-Adresse, Zeitpunkt, aufgerufene URL, User-Agent), um die Website
        auszuliefern und Angriffe abzuwehren. Rechtsgrundlage: Art.&nbsp;6
        Abs.&nbsp;1 lit.&nbsp;f DSGVO. Eine Übermittlung in die USA kann im
        Rahmen des Hostings stattfinden; Vercel stützt sich dabei auf
        geeignete Garantien (u.&nbsp;a. Standardvertragsklauseln).
      </p>

      <h2>3. Readiness-Check und Kontakt</h2>
      <p className="prose">
        Im kostenlosen Readiness-Check kannst du Name, E-Mail und optional die
        Firma hinterlassen. Diese Angaben dienen der späteren Durchführung des
        Checks bzw. der Kontaktaufnahme. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;b DSGVO (vorvertragliche Maßnahmen) bzw. Art.&nbsp;6
        Abs.&nbsp;1 lit.&nbsp;f DSGVO (Interesse an einer sachgerechten
        Bearbeitung). Eine Zahlung findet auf diesem Weg nicht statt.
      </p>

      <h2>4. Bestellung, Zahlung (Stripe) und Intake</h2>
      <p className="prose">
        Für den kostenpflichtigen Start (Setup und Abo) verarbeiten wir Firma
        und E-Mail sowie Zahlungsdaten über Stripe (Stripe Payments Europe,
        Ltd. / Stripe, Inc.). Stripe verarbeitet Zahlungsdaten eigenständig als
        Auftragsverarbeiter bzw. eigener Verantwortlicher der Zahlung. Es
        können Cookies und Weiterleitungen zu Stripe Checkout gesetzt werden.
        Nach erfolgreicher Zahlung speichern wir Sitzungs- und
        Bestellreferenzen sowie deine Intake-Antworten (Branche, Software,
        Belegwege, IT, Verantwortliche), um die Dokumentation zu erzeugen und
        den Vertrag zu erfüllen. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;b DSGVO.
      </p>
      <p className="prose">
        Intake-Daten können in Google Sheets (Google Ireland Ltd. / Google LLC)
        oder — ohne konfigurierte Anbindung — lokal als Betriebs-Fallback
        abgelegt werden. Eine Übermittlung in die USA ist möglich;
        Rechtsgrundlage der Übermittlung sind geeignete Garantien.
      </p>

      <h2>5. Pflichtangaben und Steuer</h2>
      <p className="prose">
        Rechnungs- und Vertragsdaten speichern wir, soweit handels- und
        steuerrechtliche Aufbewahrungspflichten bestehen (Art.&nbsp;6
        Abs.&nbsp;1 lit.&nbsp;c DSGVO).
      </p>

      <h2>6. Cookies</h2>
      <p className="prose">
        Details zu Cookies und ähnlichen Techniken stehen auf der Seite{" "}
        <a href="/cookies">Cookies</a>. Technisch notwendige Cookies setzen wir
        auf Grundlage von Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO bzw. §&nbsp;25
        Abs.&nbsp;2 TDDDG.
      </p>

      <h2>7. Speicherdauer</h2>
      <p className="prose">
        Wir speichern personenbezogene Daten nur so lange, wie es für die
        genannten Zwecke erforderlich ist oder gesetzliche Fristen laufen. Logs
        werden in der Regel kurzfristig gelöscht, Vertrags- und
        Rechnungsdaten gemäß den gesetzlichen Aufbewahrungsfristen.
      </p>

      <h2>8. Deine Rechte</h2>
      <p className="prose">
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
        der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen
        Verarbeitungen auf Grundlage von Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f
        DSGVO. Außerdem besteht ein Beschwerderecht bei einer
        Datenschutzaufsichtsbehörde. Anfragen an{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>.
      </p>

      <h2>9. Keine Steuerberatung</h2>
      <p className="prose">
        Die über diesen Dienst erzeugte Dokumentation ist ein Entwurf zur
        Abstimmung mit deinem Steuerberater — keine individuelle Steuer- oder
        Rechtsberatung.
      </p>
    </LegalPage>
  );
}
