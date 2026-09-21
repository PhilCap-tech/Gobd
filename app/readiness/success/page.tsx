import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { isMailConfigured } from "@/lib/env";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
import { firstQueryValue } from "@/lib/query";
import { canAccessReadinessLead, readinessDownloadPath } from "@/lib/readiness";
import { readinessBrancheLabel } from "@/lib/readiness-options";
import { findReadinessLeadById } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Readiness-PDF bereit",
  robots: { index: false, follow: false },
};

export default async function ReadinessSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    lead_id?: string | string[];
    token?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const leadId = firstQueryValue(params.lead_id);
  const token = firstQueryValue(params.token);
  const sessionEmail = await getSessionEmail();
  const lead = leadId ? await findReadinessLeadById(leadId) : null;
  const allowed = Boolean(
    lead && canAccessReadinessLead(lead, { email: sessionEmail, token }),
  );
  const downloadHref =
    allowed && lead
      ? readinessDownloadPath(lead.leadId, token || lead.accessToken)
      : null;
  const mailReady = isMailConfigured();
  const brancheLabel = lead ? readinessBrancheLabel(lead.branche) : "";

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {!allowed || !lead ? (
          <div className="card">
            <h1>PDF nicht gefunden</h1>
            <p className="prose">
              Der Download-Link ist ungültig oder abgelaufen. Starte den
              Readiness-Check erneut oder öffne den Link aus der E-Mail.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/readiness">
                Readiness-Check starten
              </Link>
              <Link className="btn ghost" href="/login">
                Anmelden
              </Link>
            </div>
          </div>
        ) : (
          <section>
            <p className="kicker">GoBD-Grundlagen · {brancheLabel}</p>
            <h1>Dein PDF ist bereit{lead.name ? `, ${lead.name}` : ""}</h1>
            <p className="lead">
              Branchenbezogene Arbeitshilfe für{" "}
              {lead.company || "dein Unternehmen"} — keine fertige
              Verfahrensdokumentation.
            </p>
            <div className="card">
              <p className="prose">
                Inhalt aus dem Modul {brancheLabel}: Grundlagen, Checkliste,
                nächste Schritte. Zur Orientierung und Abstimmung mit deinem
                Steuerberater.
              </p>
              {mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link
                  {lead.email ? ` an ${lead.email}` : ""} geschickt. Optional
                  kannst du dich später per Magic Link anmelden und den Link
                  aus der Mail erneut nutzen.
                </p>
              ) : (
                <p className="banner">
                  E-Mail-Versand ist nicht konfiguriert (Demo, Log-Stub). Der
                  Download bleibt hier auf der Seite. Magic-Link-Mail folgt,
                  sobald <code>RESEND_API_KEY</code> und <code>EMAIL_FROM</code>{" "}
                  gesetzt sind.
                </p>
              )}
              <div className="actions" style={{ marginTop: 16 }}>
                {downloadHref && (
                  <a className="btn" href={downloadHref}>
                    PDF herunterladen
                  </a>
                )}
                <Link className="btn" href="/checkout">
                  Verfahrensdokumentation führen lassen — {SETUP_EUR} € +{" "}
                  {MONTHLY_EUR} €/Mo
                </Link>
              </div>
              <p className="hint" style={{ marginTop: 14 }}>
                Nächster Schritt nach dem Checkout: kurzes Intake, dann PDF-Entwurf
                plus offene Punkte. Keine Kreditkarte im Readiness-Check.
              </p>
              <p className="disclaimer" role="note">
                Kein Steuerberatungsersatz. Dieses PDF ist eine allgemeine
                Arbeitshilfe der IKAT GmbH / gobd-doku-erstellen.de. Es enthält
                keine Zusicherung von GoBD-Konformität oder Prüfungssicherheit
                und ersetzt keine Abstimmung mit deinem Steuerberater.
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
