import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "AGB",
  robots: { index: false, follow: false },
};

export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen">
      <h2>1. Geltungsbereich und Anbieter</h2>
      <p className="prose">
        Diese AGB gelten für die Nutzung von {LEGAL_OPERATOR.product} unter{" "}
        {LEGAL_OPERATOR.siteUrl} und für den Vertrag über Setup und Abo.
        Anbieter ist {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.street},{" "}
        {LEGAL_OPERATOR.zipCity} ({LEGAL_OPERATOR.email}).
      </p>

      <h2>2. Leistungsgegenstand</h2>
      <p className="prose">
        Wir bieten eine geführte Online-Erstellung einer
        GoBD-Verfahrensdokumentation als PDF plus eine Offene-Punkte-Liste.
        Das Ergebnis ist ein Entwurf zur Abstimmung mit deinem Steuerberater.
        Wir leisten keine Steuer-, Rechts- oder Wirtschaftsprüfungsberatung und
        schulden keine GoBD-Konformität. Die Verantwortung für Inhalt,
        Vollständigkeit und Freigabe liegt bei dir bzw. bei der beratenen
        Freigabe.
      </p>

      <h2>3. Vertragsschluss und Preise</h2>
      <p className="prose">
        Der kostenlose Readiness-Check ist unverbindlich und begründet keinen
        Zahlungsvertrag. Der entgeltliche Vertrag kommt zustande, wenn du im
        Checkout die Bestellung absendest und wir sie durch Bereitstellung des
        Dienstes bzw. durch Stripe-Bestätigung annehmen. Aktuelle Preise:
        149&nbsp;€ Setup einmalig plus 49&nbsp;€ pro Monat. Es gelten die auf
        der Website angegebenen Preise.
      </p>

      <h2>4. Abo, Updates und Kündigung</h2>
      <p className="prose">
        Das Abo umfasst Updates bei System- oder Prozessänderungen und erneute
        Exporte, soweit der Dienst verfügbar ist. Die monatliche Zahlung
        verlängert sich, bis du kündigst. Die Kündigung ist zum Ende des
        jeweiligen Abrechnungszeitraums möglich; uns genügt eine E-Mail an{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>.
      </p>

      <h2>5. Geld-zurück und Widerruf</h2>
      <p className="prose">
        Zusätzlich zum gesetzlichen Widerrufsrecht für Verbraucher gilt unsere
        14-Tage-Geld-zurück-Garantie auf die Erstbestellung. Das ist kein
        kostenloses Probeabo.
      </p>
      <p className="prose">
        Verbrauchern steht ein Widerrufsrecht von 14 Tagen ab Vertragsschluss
        zu. Zur Ausübung genügt eine eindeutige Erklärung an{" "}
        {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.zipCity}
        , E-Mail {LEGAL_OPERATOR.email}. Zur Fristwahrung reicht die rechtzeitige
        Absendung. Nach Widerruf erstatten wir erhaltene Zahlungen binnen 14
        Tagen über dasselbe Zahlungsmittel. Hast du verlangt, dass die
        Leistung während der Widerrufsfrist beginnt, zahlst du einen
        angemessenen Betrag für den bis zum Widerruf erbrachten Anteil.
      </p>
      <p className="prose">
        Muster-Widerrufsformular: An {LEGAL_OPERATOR.name},{" "}
        {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.zipCity},{" "}
        {LEGAL_OPERATOR.email}: Hiermit widerrufe ich den von mir
        abgeschlossenen Vertrag über die folgende Dienstleistung. Bestellt am:
        … Name: … Anschrift: … Datum: …
      </p>

      <h2>6. Mitwirkung</h2>
      <p className="prose">
        Du gibst wahrheitsgemäße Angaben zu Betrieb, Systemen und
        Verantwortlichen. Unvollständige Angaben führen zu Lücken in der
        Offene-Punkte-Liste; das ist kein Mangel des Dienstes.
      </p>

      <h2>7. Haftung</h2>
      <p className="prose">
        Wir haften unbeschränkt für Vorsatz, grobe Fahrlässigkeit und nach dem
        Produkthaftungsgesetz sowie für Schäden aus der Verletzung von Leben,
        Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur bei
        Verletzung wesentlicher Vertragspflichten und begrenzt auf den
        vorhersehbaren, typischen Schaden. Eine Haftung für GoBD-Konformität,
        Prüfungserfolg oder steuerliche Folgen besteht nicht.
      </p>

      <h2>8. Schlussbestimmungen</h2>
      <p className="prose">
        Es gilt deutsches Recht. Ist der Kunde Kaufmann, ist Gerichtsstand{" "}
        {LEGAL_OPERATOR.zipCity}. Sollten einzelne Klauseln unwirksam sein,
        bleibt der Vertrag im Übrigen wirksam.
      </p>
    </LegalPage>
  );
}
