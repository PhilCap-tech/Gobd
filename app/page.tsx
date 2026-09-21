import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";

const CTA_PRIMARY = "Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo";
const CTA_PRIMARY_HREF = "/checkout";
const CTA_SECONDARY_HREF = "/readiness";

function PaidCta({
  trust,
  secondaryLabel,
  secondaryHint,
}: {
  trust: string;
  secondaryLabel: string;
  secondaryHint?: string;
}) {
  return (
    <div className="cta-pair">
      <div className="cta-paid">
        <Link className="btn" href={CTA_PRIMARY_HREF}>
          {CTA_PRIMARY}
        </Link>
        <p className="trust-line">{trust}</p>
      </div>
      <div className="cta-soft">
        <Link className="btn ghost" href={CTA_SECONDARY_HREF}>
          {secondaryLabel}
        </Link>
        {secondaryHint ? <p className="hint">{secondaryHint}</p> : null}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader ctaHref={CTA_PRIMARY_HREF} ctaLabel={CTA_PRIMARY} />
      <main className="wrap">
        <section className="hero">
          <p className="hook">
            Als Erstes fragt der Prüfer nach der Verfahrensdokumentation.
          </p>
          <h1>GoBD-Verfahrensdokumentation erstellen</h1>
          <p className="lead">
            Wenn du dann nur Fragmente oder eine leere Vorlage hast, wird’s
            eng. Hier erstellst du die Verfahrensdokumentation{" "}
            <strong>online selbst</strong> — geführt, in unter einer Stunde —
            als PDF plus Offene-Punkte-Liste. Kein Warteschleifen-Termin. Zur
            Abstimmung mit deinem Steuerberater.
          </p>
          <PaidCta
            trust="Sofort starten online · 14 Tage Geld-zurück · Keine Steuerberatung · Entwurf für deinen Steuerberater"
            secondaryLabel="Erst Readiness-Check (kostenlos)"
            secondaryHint="Ca. 2–3 Minuten · Keine Kreditkarte"
          />
          <div className="tags" aria-label="Themen">
            <span>Verfahrensdokumentation erstellen</span>
            <span>digitale Verfahrensdokumentation</span>
            <span>Vorlage / Muster als Benefit</span>
            <span>für KMU &amp; Handwerk</span>
          </div>
        </section>

        <section className="block" id="problem">
          <h2>Der Prüfer wartet nicht auf deine Word-Vorlage</h2>
          <ul className="prose-list">
            <li>Unklare Belegwege und Systeme</li>
            <li>Nichts Einheitliches zum Vorzeigen</li>
            <li>Vorlagen, die seit Monaten leer liegen</li>
          </ul>
          <p className="prose framing">
            Du brauchst keinen Beratungs-Termin und keine mehrmonatige
            Self-Service-Begleitung, um überhaupt etwas Greifbares zu haben —
            du brauchst eine geführte Struktur, die du{" "}
            <strong>jetzt online</strong> erzeugst.
          </p>
        </section>

        <section className="block" id="outcome">
          <h2>
            Sofort digital — online selbst erstellen, statt auf Beratung warten
          </h2>
          <ul className="prose-list">
            <li>
              In unter einer Stunde: strukturierte Verfahrensdokumentation als
              PDF (nicht erst nach Kickoff-Call)
            </li>
            <li>
              {SETUP_EUR} € Setup = Einrichtung + erstes PDF +
              Offene-Punkte-Liste — nicht nur ein Check ohne Dokument
            </li>
            <li>
              Offene-Punkte-Liste: du siehst Lücken, bevor der Prüfer fragt
            </li>
            <li>
              Für KMU, Handwerk, Freiberufler (DATEV, sevdesk, lexoffice &amp;
              Co.)
            </li>
            <li>
              Entwurf zur Abstimmung mit dem Steuerberater — kein Ersatz für
              Beratung
            </li>
          </ul>
        </section>

        <section className="block" id="so-funktionierts">
          <h2>So funktioniert’s</h2>
          <ol className="prose-list">
            <li>
              <strong>Fragen beantworten</strong> — Kurzes Intake zu Branche,
              Software, Belegwegen, IT und Verantwortlichen.
            </li>
            <li>
              <strong>Dokumentation erzeugen</strong> — PDF plus
              Offene-Punkte-Liste.
            </li>
            <li>
              <strong>Mit dem Steuerberater abstimmen</strong> — Entwurf prüfen,
              Lücken schließen, ablegen. Danach im Login pflegen und neu
              exportieren.
            </li>
          </ol>
        </section>

        <section className="block" id="setup-anker">
          <div className="value-note">
            <h2>
              {SETUP_EUR} € Setup — und du hast mehr als einen Check
            </h2>
            <p className="prose">
              Andere bieten für ähnliche Beträge oft nur eine Auswertung oder
              einen Termin. Bei uns zahlst du {SETUP_EUR} € Setup für die
              geführte <strong>Verfahrensdokumentations-Struktur</strong>: PDF
              plus Liste offener Punkte. Danach hält das Abo ({MONTHLY_EUR}{" "}
              €/Mo) Versionen und Exporte aktuell — weil ein einmaliges PDF
              veraltet.
            </p>
            <p className="hint">
              Keine Steuer- oder Rechtsberatung. Entwurf zur Abstimmung mit
              deinem Steuerberater.
            </p>
          </div>
        </section>

        <section className="block" id="preise">
          <h2>Was du bezahlst — und warum das Abo dazugehört</h2>
          <div className="price-grid">
            <div className="price-card stacked">
              <p className="step-label">Setup</p>
              <div className="price">
                {SETUP_EUR}&nbsp;€ <small>einmalig</small>
              </div>
              <p className="prose">
                Einrichtung, erstes PDF und Offene-Punkte-Liste.
              </p>
            </div>
            <div className="price-card stacked">
              <p className="step-label">Abo</p>
              <div className="price">
                {MONTHLY_EUR}&nbsp;€ <small>/ Monat</small>
              </div>
              <p className="prose">
                Damit du dich nie wieder selbst darum kümmern musst:
              </p>
              <ul className="prose-list">
                <li>Automatische Versionierung deiner Verfahrensdokumentation</li>
                <li>Sichere Speicherung und Zugang zu bisherigen Fassungen</li>
                <li>
                  Updates, wenn sich Systeme, Prozesse oder Anforderungen ändern
                </li>
                <li>
                  Bereit für künftige Vorgaben — ohne von vorn anzufangen
                </li>
                <li>
                  Erneute Exporte, wenn Prüfer oder Steuerberater eine aktuelle
                  Fassung brauchen
                </li>
              </ul>
            </div>
          </div>
          <p className="prose framing">
            Ein einmaliges PDF veraltet. Betriebsprüfung und GoBD sind kein
            Einmal-Event — Pflege ist der eigentliche Schutz. Und du startest
            online in unter einer Stunde, nicht erst nach Terminfindung.
          </p>
          <PaidCta
            trust="14 Tage Geld-zurück-Garantie"
            secondaryLabel="Erst kostenlosen Readiness-Check machen"
          />
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Muss das der Steuerberater machen?</h3>
            <p className="prose">
              Nicht zwingend. Viele Betriebe liefern dem Berater bisher nur
              Fragmente. Hier bekommst du einen strukturierten Entwurf — der
              Berater prüft und ergänzt, statt bei Null anzufangen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Brauch ich eine Verfahrensdokumentation überhaupt?</h3>
            <p className="prose">
              Die GoBD erwarten eine nachvollziehbare Verfahrensdokumentation.
              Bei einer Betriebsprüfung wird oft genau danach gefragt. Wer nur
              Vorlagen oder gar nichts hat, steht schlechter da.
            </p>
          </div>
          <div className="faq-item">
            <h3>Reicht nicht ein einmaliges PDF?</h3>
            <p className="prose">
              Für den Moment vielleicht — bis sich Software, Belegwege oder
              Verantwortliche ändern. Genau dann fehlt die aktuelle Fassung. Das
              Abo hält Versionen, Speicherung und Updates am Laufen, damit du
              dich nicht erneut selbst darum kümmern musst.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das eine Beratung oder ein Online-Produkt?</h3>
            <p className="prose">
              Ein Online-Produkt. Du beantwortest kurze Fragen und erhältst PDF
              plus Offene-Punkte-Liste — ohne Warteschleife auf einen
              Beratungstermin. Für die fachliche Freigabe bleibst du bei deinem
              Steuerberater. Wir leisten keine Steuerberatung.
            </p>
          </div>
          <div className="faq-item">
            <h3>Warum Setup {SETUP_EUR} € und dann Abo?</h3>
            <p className="prose">
              Das Setup liefert die erste geführte Struktur (PDF + Offene
              Punkte). Das Abo hält Fassungen, Speicherung und erneute Exporte
              am Laufen, wenn sich Software oder Prozesse ändern. So bleibst du
              nicht auf einem veralteten Einmal-PDF sitzen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Haftet ihr — ist das rechtssicher / GoBD-konform?</h3>
            <p className="prose">
              Nein. Wir leisten keine Steuer- oder Rechtsberatung. Das PDF ist
              ein geführter Entwurf zur Abstimmung mit deinem Steuerberater. Die
              Verantwortung für GoBD-Konformität liegt bei dir bzw. bei der
              beratenen Freigabe.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das nur eine Vorlage zum Download?</h3>
            <p className="prose">
              Nein. Du beantwortest kurze Fragen zu deinem Betrieb und erhältst
              ein individuelles PDF plus eine Offene-Punkte-Liste — keine
              Blanko-Datei.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Wenn der Prüfer fragt — hast du etwas vorzuzeigen?</h2>
          <PaidCta
            trust="14 Tage Geld-zurück · Keine Steuerberatung"
            secondaryLabel="Readiness-Check (kostenlos)"
          />
        </section>
      </main>
      <div className="sticky-cta">
        <Link className="btn" href={CTA_PRIMARY_HREF}>
          {CTA_PRIMARY}
        </Link>
        <p className="trust-line">14 Tage Geld-zurück-Garantie</p>
      </div>
      <SiteFooter />
    </>
  );
}
