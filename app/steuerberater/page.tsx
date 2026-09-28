import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";

const PILOT_HREF =
  "/checkout?utm_source=partner&utm_medium=landing&utm_campaign=steuerberater";

const PROMO_CODE = "KANZLEI-PILOT";
const PRIMARY_CTA = "Pilot selbst testen";

const PAGE_TITLE =
  "GoBD-Verfahrensdokumentation für Mandanten — Partner-Pilot für Steuerberater";
const PAGE_DESCRIPTION =
  "Pflicht für Mandanten, oft liegen geblieben. Tool zum schnellen, nachvollziehbaren Erstellen mit Versionierung — selbst testen, dann weiterempfehlen.";

export const metadata: Metadata = {
  metadataBase: new URL(LEGAL_OPERATOR.siteUrl),
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: "/steuerberater" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/steuerberater",
    locale: "de_DE",
    type: "website",
  },
};

function PromoHint() {
  return (
    <>
      <p className="trust-line">
        Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>
        {" · "}Keine Steuerberatung · Sie füllen nicht für Mandanten aus
      </p>
      <p className="hint">100 % für Setup + Abo, 2 Monate (Partner-Pilot).</p>
    </>
  );
}

function PilotCta({ showSecondary = false }: { showSecondary?: boolean }) {
  return (
    <div className="cta-pair">
      <div className="cta-paid">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <PromoHint />
      </div>
      {showSecondary ? (
        <div className="cta-soft">
          <a className="btn ghost" href="#pilot">
            So funktioniert’s
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref={PILOT_HREF}
        ctaLabel={PRIMARY_CTA}
        links={[
          { href: "#prozess", label: "Prozess" },
          { href: "#pilot", label: "Pilot" },
          { href: "#faq", label: "FAQ" },
        ]}
      />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Für Steuerberater &amp; Kanzleien</p>
          <h1>
            Die Verfahrensdokumentation ist Pflicht — Ihre Mandanten schieben
            sie auf, weil sie zu aufwendig wirkt
          </h1>
          <p className="lead">
            Sie weisen darauf hin. Wir liefern das Tool, mit dem Mandanten der
            gesetzlichen GoBD-Verfahrensdokumentations-Pflicht schnell,
            unkompliziert und nachhaltig nachkommen — mit Versionierung statt
            Dateichaos.
          </p>
          <PilotCta showSecondary />
        </section>

        <section className="block" id="problem">
          <h2>Warum die Pflicht oft liegen bleibt</h2>
          <p className="prose">
            <strong>Problem:</strong> GoBD-Verfahrensdokumentation betrifft
            Ihre Mandanten. Sie sprechen es an — Umsetzung scheitert am
            Aufwand: leere Vorlagen, unklare Struktur, keine Historie.
          </p>
          <p className="prose">
            <strong>Lösung:</strong> Ein geführter Prozess: Mandant liefert die
            Betriebsdaten, heraus kommt ein strukturierter Entwurf plus Offene
            Punkte — versioniert und bei Bedarf aktualisierbar.
          </p>
        </section>

        <section className="block" id="positionierung">
          <h2>Das Tool für die Pflicht — nicht die Steuerberatung</h2>
          <p className="prose">
            Wir sind kein DATEV-Ersatz und keine Kanzlei-Software. Wir sind das
            Werkzeug, mit dem Mandanten ihre Verfahrensdokumentation anlegen
            und pflegen können — damit der Hinweis aus der Kanzlei nicht in
            einer leeren Word-Datei endet.
          </p>
          <p className="hint">
            Sie füllen die Dokumentation <strong>nicht</strong> für Ihre
            Mandanten aus.
          </p>
        </section>

        <section className="block" id="prozess">
          <h2>Was manuell ist — und was rauskommt</h2>
          <ol className="prose-list">
            <li>
              <strong>Manuell / Intake</strong> — Betriebsdaten, Software,
              Belegwege, Verantwortliche: der Mandant (oder Sie im eigenen
              Test) gibt die Parameter ein.
            </li>
            <li>
              <strong>Ergebnis</strong> — Strukturierter Entwurf der
              Verfahrensdokumentation als PDF plus Liste Offener Punkte.
            </li>
            <li>
              <strong>Versionierung</strong> — Änderungen nachvollziehbar;
              keine „welche Datei war die letzte?“-Diskussion.
            </li>
          </ol>
        </section>

        <section className="block" id="pruefung">
          <h2>Wenn die Prüfung kommt</h2>
          <p className="prose">
            Die Dokumentation ist sekundenschnell abrufbar — mit Historie und
            klarem Stand. So ist die Pflicht nicht „irgendwo in der Ablage“,
            sondern greifbar erledigt.
          </p>
          <p className="hint">
            Fachliche Prüfung bleibt bei Kanzlei und Mandant.
          </p>
        </section>

        <section className="block" id="pilot">
          <h2>So arbeiten Sie mit dem Partner-Pilot</h2>
          <ol className="prose-list">
            <li>
              <strong>Selbst testen</strong> — Parameter und Rechtsformen
              durchspielen (z. B. Freiberufler, GmbH, Handwerk).
            </li>
            <li>
              <strong>Ergebnis bewerten</strong> — Entwurf, Offene Punkte,
              Versionierung fachlich einordnen.
            </li>
            <li>
              <strong>Weiterempfehlen</strong> — Überzeugt der Test:
              Empfehlungslink an Mandanten — der Mandant arbeitet selbst
              weiter.
            </li>
          </ol>
          <PilotCta />
        </section>

        <section className="block" id="empfehlung">
          <div className="value-note">
            <h2>Empfehlen, wenn Ihr Test überzeugt</h2>
            <p className="prose">
              Nach dem eigenen Pilot: Empfehlungslink für Mandanten.
              Cash-Affiliate später — zuerst Qualität.
            </p>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Was wir nicht sind</h2>
          <ul className="prose-list">
            <li>Keine Steuer- oder Rechtsberatung.</li>
            <li>Kein Ersatz für Ihre fachliche Prüfung.</li>
            <li>Kein Ausfüllen der VD durch die Kanzlei für den Mandanten.</li>
            <li>Keine leere Vorlage zum Abhaken.</li>
            <li>Keine Claims „rechtssicher“ / „GoBD-konform“.</li>
            <li>Kein Fake-DATEV/KPMG.</li>
          </ul>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Ist die Verfahrensdokumentation Pflicht?</h3>
            <p className="prose">
              Für buchführungspflichtige Unternehmen ist sie Teil der
              GoBD-Anforderungen. Sie weisen Mandanten darauf hin — wir helfen
              bei der praktischen Erstellung und Pflege. (Keine
              Rechtsberatung.)
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich für Mandanten ausfüllen?</h3>
            <p className="prose">
              Nein. Sie testen selbst, bewerten, empfehlen weiter. Der Mandant
              nutzt den Link selbst.
            </p>
          </div>
          <div className="faq-item">
            <h3>Was ist manuell, was kommt raus?</h3>
            <p className="prose">
              Manuell: Intake/Parameter. Raus: Entwurf + Offene Punkte,
              versioniert.
            </p>
          </div>
          <div className="faq-item">
            <h3>Kostet der Pilot etwas?</h3>
            <p className="prose">
              Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>{" "}
              (100 % für Setup + Abo, 2 Monate; Details im Checkout). Reguläre
              Preise erst beim Kauf.
            </p>
          </div>
          <div className="faq-item">
            <h3>DATEV / Zertifizierung?</h3>
            <p className="prose">
              Nein. IKAT GmbH; optionales eigenes Partner-Siegel.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Selbst testen — dann entscheiden, ob Sie weiterempfehlen</h2>
          <PilotCta />
          <p className="hint back-links">
            <Link href="/faq">FAQ</Link>
            {" · "}
            <Link href="/datenschutz">Datenschutz</Link>
            {" · "}
            <Link href="/impressum">Impressum</Link>
          </p>
          <p className="disclaimer">
            Dies ist keine Steuer- oder Rechtsberatung. Der Pilot dient der
            eigenen Bewertung durch die Kanzlei. Eine Weiterempfehlung ersetzt
            keine fachliche Prüfung. Die Verfahrensdokumentation bleibt
            Verantwortung des Mandanten.
          </p>
        </section>
      </main>
      <div className="sticky-cta">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <p className="trust-line">
          Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>
          {" · "}100 % für Setup + Abo, 2 Monate
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
