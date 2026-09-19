import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isMailConfigured } from "@/lib/env";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
import { firstQueryValue } from "@/lib/query";
import {
  READINESS_DISCLAIMER,
  brancheLabel,
  optionLabel,
  pdfTitleForBranche,
  READINESS_ARCHIV,
  READINESS_BELEGE,
  READINESS_DOKUMENTATION,
} from "@/lib/readiness";
import { findReadinessLeadById } from "@/lib/readiness-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kurzrichtlinie bereit",
  robots: { index: false, follow: false },
};

export default async function ReadinessSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const documentId = firstQueryValue(params.id);
  const row = documentId ? await findReadinessLeadById(documentId) : null;
  const mailReady = isMailConfigured();
  const downloadHref = row
    ? `/api/readiness/${encodeURIComponent(row.documentId)}/download`
    : null;
  const title = row ? pdfTitleForBranche(row.branche) : "";

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {!row ? (
          <div className="card">
            <h1>Kurzrichtlinie nicht gefunden</h1>
            <p className="prose">
              Der Download-Link ist ungültig oder das Dokument ist lokal nicht
              mehr verfügbar. Bitte den Readiness-Check erneut ausfüllen.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/readiness">
                Readiness-Check starten
              </Link>
              <Link className="btn ghost" href="/checkout">
                Dokumentation starten — {SETUP_EUR} € + {MONTHLY_EUR} €/Mo
              </Link>
            </div>
          </div>
        ) : (
          <section>
            <p className="kicker">Kostenlos · {brancheLabel(row.branche)}</p>
            <h1>Deine Kurzrichtlinie ist fertig</h1>
            <p className="lead">
              {title}
              {row.company ? ` für ${row.company}` : ""}. Arbeitshilfe zur
              Vorbereitung — keine fertige Verfahrensdokumentation.
            </p>
            <div className="card">
              <dl className="summary">
                <div>
                  <dt>Branche</dt>
                  <dd>{brancheLabel(row.branche)}</dd>
                </div>
                <div>
                  <dt>Belege</dt>
                  <dd>{optionLabel(READINESS_BELEGE, row.belege)}</dd>
                </div>
                <div>
                  <dt>Dokumentation</dt>
                  <dd>
                    {optionLabel(READINESS_DOKUMENTATION, row.dokumentation)}
                  </dd>
                </div>
                <div>
                  <dt>Archiv</dt>
                  <dd>{optionLabel(READINESS_ARCHIV, row.archiv)}</dd>
                </div>
              </dl>
              {mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link
                  {row.email ? ` an ${row.email}` : ""} geschickt.
                </p>
              ) : (
                <p className="banner">
                  E-Mail-Versand ist nicht konfiguriert (Demo). Der Download
                  bleibt hier auf der Seite. Sobald{" "}
                  <code>RESEND_API_KEY</code> und <code>EMAIL_FROM</code> gesetzt
                  sind, geht die Mail mit.
                </p>
              )}
              <div className="actions" style={{ marginTop: 16 }}>
                {downloadHref && (
                  <a className="btn" href={downloadHref}>
                    PDF herunterladen
                  </a>
                )}
                <Link className="btn ghost" href="/checkout">
                  Dokumentation starten — {SETUP_EUR} € + {MONTHLY_EUR} €/Mo
                </Link>
              </div>
              <p className="hint">
                Soft-Hinweis: Die Kurzrichtlinie sortiert Grundlagen und
                Checkliste. Eine geführte Verfahrensdokumentation folgt nach dem
                Checkout — weiterhin ohne Konformitätsversprechen.
              </p>
              <p className="disclaimer" role="note">
                {READINESS_DISCLAIMER}
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
