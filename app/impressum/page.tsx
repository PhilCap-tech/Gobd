import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false, follow: false },
};

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p className="prose">
        {LEGAL_OPERATOR.name}
        <br />
        {LEGAL_OPERATOR.street}
        <br />
        {LEGAL_OPERATOR.zipCity}
        <br />
        {LEGAL_OPERATOR.country}
      </p>
      <p className="prose">
        E-Mail:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
        <br />
        Telefon: {LEGAL_OPERATOR.phone}
        <br />
        Website:{" "}
        <a href={LEGAL_OPERATOR.siteUrl}>{LEGAL_OPERATOR.siteUrl}</a>
      </p>

      <h2>Registereintrag</h2>
      <p className="prose">
        Eintragung im Handelsregister.
        <br />
        Registergericht: {LEGAL_OPERATOR.registerCourt}
        <br />
        Registernummer: {LEGAL_OPERATOR.registerNumber}
      </p>

      <h2>Vertreten durch</h2>
      <p className="prose">
        Geschäftsführer: {LEGAL_OPERATOR.managingDirector}
      </p>

      <h2>Umsatzsteuer-ID</h2>
      <p className="prose">
        Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:{" "}
        {LEGAL_OPERATOR.vatId}
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p className="prose">
        {LEGAL_OPERATOR.managingDirector}, {LEGAL_OPERATOR.name},{" "}
        {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.zipCity}
      </p>

      <h2>Online-Streitbeilegung</h2>
      <p className="prose">
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{" "}
        <a href="https://ec.europa.eu/consumers/odr/" rel="noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>
        . Wir sind nicht verpflichtet und nicht bereit, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Hinweis zum Angebot</h2>
      <p className="prose">
        {LEGAL_OPERATOR.product} ist ein Angebot der {LEGAL_OPERATOR.name}. Wir
        leisten keine Steuer- oder Rechtsberatung. Das PDF ist ein geführter
        Entwurf zur Abstimmung mit deinem Steuerberater.
      </p>
    </LegalPage>
  );
}
