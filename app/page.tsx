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
            Buchhaltungsprozesse dokumentieren — oft Pflicht, oft liegen
            geblieben.
          </p>
          <h1>GoBD-Verfahrensdokumentation erstellen</h1>
          <p className="lead">
            Wenn nur Fragmente oder eine leere Vorlage liegen, fehlt der
            greifbare Stand. Hier erstellst du die Verfahrensdokumentation{" "}
            <strong>online selbst</strong> — geführt, in unter einer Stunde —
            als PDF plus Offene-Punkte-Liste. Kein Warteschleifen-Termin. Für
            die meisten Betriebe reicht diese Fassung. Eine Abstimmung mit dem
            Steuerberater ist optional und nur im Rahmen eines gesonderten
            Auftrags.
          </p>
          <p className="outcome-line">
            PDF + Offene-Punkte in unter einer Stunde · in der Regel direkt
            nutzbar
          </p>
          <PaidCta
            trust="Sofort starten online · 14 Tage Geld-zurück · Keine Steuerberatung"
            secondaryLabel="Kostenloser Leitfaden"
            secondaryHint="Kurzer Check + Branchen-Grundlagen-PDF — noch keine fertige Verfahrensdokumentation."
          />
          <div className="tags" aria-label="Themen">
            <span>Verfahrensdokumentation erstellen</span>
            <span>digitale Verfahrensdokumentation</span>
            <span>Vorlage / Muster als Benefit</span>
            <span>für KMU &amp; Handwerk</span>
          </div>
          <p className="advisor-note">
            Steuerberater oder Kanzlei? →{" "}
            <Link href="/steuerberater">Seite für Berater ansehen</Link>
          </p>
        </section>

        <section className="block" id="problem">
          <h2>Eine leere Vorlage reicht selten als Dokumentation</h2>
          <ul className="prose-list">
            <li>Unklare Belegwege und Systeme</li>
            <li>Nichts Einheitliches zum Ablegen und Weitergeben</li>
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
              Offene-Punkte-Liste: du siehst Lücken, bevor du den Entwurf
              ablegst oder weitergibst
            </li>
            <li>
              Für KMU, Handwerk, Freiberufler (DATEV, sevdesk, lexoffice &amp;
              Co.)
            </li>
            <li>
              Für die meisten Betriebe die nutzbare Fassung. Anpassungen bei
              besonderen Verfahren sind möglich. Keine Steuerberatung.
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
              <strong>Ablegen und bei Bedarf anpassen</strong> — Die Fassung aus
              deinen Angaben reicht in der Regel. Bei besonderen Verfahren
              ergänzt du selbst. Eine Abstimmung mit dem Steuerberater ist
              freiwillig und nur im Rahmen eines gesonderten Auftrags. Danach
              im Login pflegen und neu exportieren.
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
              Keine Steuer- oder Rechtsberatung. Die Fassung aus deinen Angaben
              reicht in der Regel. Eine Abstimmung mit dem Steuerberater ist
              optional und nur im Rahmen eines gesonderten Auftrags.
            </p>
          </div>
        </section>

        <section className="block" id="preise">
          <h2>Was du bezahlst — und warum das Abo dazugehört</h2>
          <div className="price-grid">
            <div className="price-card stacked">
              <p className="price-lead">
                {SETUP_EUR}&nbsp;€ Setup — fertiges PDF + Offene-Punkte
              </p>
              <div className="price">
                {SETUP_EUR}&nbsp;€ <small>einmalig</small>
              </div>
              <p className="prose">
                Einrichtung und erstes PDF plus Offene-Punkte-Liste — kein
                reiner Check und keine Software-Lizenz.
              </p>
            </div>
            <div className="price-card stacked">
              <p className="price-lead">
                {MONTHLY_EUR}&nbsp;€/Mo — Versionen und Pflege
              </p>
              <div className="price">
                {MONTHLY_EUR}&nbsp;€ <small>/ Monat</small>
              </div>
              <p className="prose">
                Hält Fassungen, Speicherung und erneute Exporte aktuell, wenn
                sich Software oder Prozesse ändern.
              </p>
            </div>
          </div>
          <p className="prose framing">
            Statt Lizenz-Modell, reinem Check oder teurem Setup mit langer
            Bindung: einmal Setup für das Dokument, Abo nur für die Pflege.
          </p>
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
              Nein. Du erstellst die Verfahrensdokumentation selbst aus deinen
              Angaben. Für die meisten Betriebe reicht diese Fassung. Eine
              Abstimmung mit dem Steuerberater ist freiwillig und nur im Rahmen
              eines gesonderten Auftrags — sie gehört nicht automatisch zur
              Lieferung. Bei besonderen Verfahren kannst du die Fassung
              anpassen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Brauch ich eine Verfahrensdokumentation überhaupt?</h3>
            <p className="prose">
              Die GoBD erwarten eine nachvollziehbare Verfahrensdokumentation.
              Viele Betriebe schieben sie auf, weil Vorlagen leer bleiben oder
              der Aufwand unklar ist. Ein geführter Entwurf schafft einen
              greifbaren Stand, den du in der Regel selbst ablegen kannst.
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
              Beratungstermin. Wir leisten keine Steuerberatung. Die Lieferung
              reicht in der Regel. Eine fachliche Abstimmung mit deinem
              Steuerberater ist optional und nur, wenn du sie gesondert
              beauftragst.
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
              die Fassung aus deinen Angaben und reicht in der Regel. Die
              Verantwortung für die Dokumentation liegt bei dir. Eine Abstimmung
              mit dem Steuerberater ist optional und nur im Rahmen eines
              gesonderten Auftrags.
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
