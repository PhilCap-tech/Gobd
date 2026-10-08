import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { isMailConfigured } from "@/lib/env";
import { CTA_CREATE_WITH_PRICE, DISCLAIMER_ONCE } from "@/lib/offer-copy";
import { firstQueryValue } from "@/lib/query";
import { canAccessReadinessLead, readinessDownloadPath } from "@/lib/readiness";
import { readinessBrancheLabel } from "@/lib/readiness-options";
import { findReadinessLeadById } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "3-Minuten-Check",
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
              Der Download-Link ist ungültig oder abgelaufen. Starten Sie den
              3-Minuten-Check erneut oder öffnen Sie den Link aus der E-Mail.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/readiness">
                3-Minuten-Check starten
              </Link>
              <Link className="btn ghost" href="/login">
                Anmelden
              </Link>
            </div>
          </div>
        ) : (
          <section>
            <p className="kicker">GoBD-Grundlagen · {brancheLabel}</p>
            <h1>Ihr PDF ist bereit{lead.name ? `, ${lead.name}` : ""}</h1>
            <p className="lead">
              Kurze Einschätzung zu relevanten Themenfeldern für{" "}
              {lead.company || "Ihr Unternehmen"}. Nächste Schritte: Muster
              ansehen oder Dokumentation erstellen.
            </p>
            <div className="card">
              <p className="prose">
                Inhalt aus dem Modul {brancheLabel}: Themenfelder und nächste
                Schritte. Zur Orientierung.
              </p>
              {mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link
                  {lead.email ? ` an ${lead.email}` : ""} geschickt. Optional
                  können Sie sich später per Magic Link anmelden und den Link
                  aus der Mail erneut nutzen.
                </p>
              ) : (
                <p className="banner">
                  E-Mail-Versand ist in diesem Testpfad nicht eingerichtet. Der
                  Download bleibt hier auf der Seite.
                </p>
              )}
              <div className="actions" style={{ marginTop: 16 }}>
                {downloadHref && (
                  <a className="btn" href={downloadHref}>
                    PDF herunterladen
                  </a>
                )}
                <Link className="btn" href="/checkout">
                  {CTA_CREATE_WITH_PRICE}
                </Link>
              </div>
              <p className="hint" style={{ marginTop: 14 }}>
                Nächster Schritt: Dokumentation erstellen, dann PDF und Liste
                offener Punkte aus Ihren Angaben. Im 3-Minuten-Check selbst
                wird nichts berechnet.
              </p>
              <p className="disclaimer" role="note">
                {DISCLAIMER_ONCE} Dieses PDF ist eine kurze Einschätzung, keine
                Verfahrensdokumentation aus Ihren Abläufen.
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
