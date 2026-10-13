import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { isCompAccessEmail } from "@/lib/comp-access";
import { isStripeSecretConfigured } from "@/lib/env";
import { formatBerlinDate, lifecycleNotice } from "@/lib/kuendigung";
import { loadCancellationPreview } from "@/lib/kuendigung-stripe";
import { listLifecycleByEmail } from "@/lib/kuendigung-store";
import { MAIL_SUPPORT_EMAIL } from "@/lib/mail-layout";
import { firstQueryValue } from "@/lib/query";
import { listDocumentsByEmail, resolveStripeCustomerForEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abo kündigen",
  robots: { index: false, follow: false },
};

const STATUS_COPY: Record<string, { tone: "ok" | "warn"; text: string }> = {
  vorgemerkt: {
    tone: "ok",
    text: "Die Kündigung ist vorgemerkt. Sie erhalten eine Bestätigung per E-Mail.",
  },
  hinweis: {
    tone: "warn",
    text: "Bitte bestätigen Sie, dass Sie die Folgen der Kündigung gelesen haben.",
  },
  keins: {
    tone: "warn",
    text: "Zu diesem Konto liegt kein kündbares Abonnement vor.",
  },
  fehler: {
    tone: "warn",
    text: "Die Kündigung konnte nicht gespeichert werden. Bitte später erneut versuchen.",
  },
  portal: {
    tone: "warn",
    text: "Das Stripe-Portal konnte nicht geöffnet werden. Sie können die Kündigung hier bestätigen.",
  },
  unverfuegbar: {
    tone: "warn",
    text: "Die Zahlung ist derzeit nicht angebunden. Eine Kündigung ist hier nicht möglich.",
  },
};

export default async function KuendigungPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const email = await getSessionEmail();
  if (!email) redirect(loginPath("/account/kuendigung"));
  const compAccess = isCompAccessEmail(email);

  const params = await searchParams;
  const status = firstQueryValue(params.status);
  const banner = status ? STATUS_COPY[status] : undefined;
  const stripeReady = isStripeSecretConfigured();
  const resolved =
    stripeReady && !compAccess ? await resolveStripeCustomerForEmail(email) : null;
  const preview =
    resolved?.customerId && !resolved.lookupFailed
      ? await loadCancellationPreview(resolved.customerId)
      : null;
  const rows = await listLifecycleByEmail(email);
  const notice = lifecycleNotice(rows);
  const documents = await listDocumentsByEmail(email);
  const hasExport = documents.some(
    (row) => row.pdfUrl.trim() || row.fragen.includes("uploadUrl"),
  );
  const periodEnd = preview?.periodEnd || rows.find((row) => row.periodEnd)?.periodEnd || "";
  const periodLabel = formatBerlinDate(periodEnd);
  const scheduled = Boolean(preview?.alreadyScheduled || notice.phase === "cancel_scheduled");
  const canConfirm = Boolean(stripeReady && preview?.subscriptionId && !scheduled && !preview.lookupFailed);

  if (compAccess && !preview?.subscriptionId) {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          <p className="kicker">Konto</p>
          <h1>Zugang</h1>
          <p className="lead">{email}</p>
          <section className="card">
            <p className="prose">
              <strong>Kostenfreier Zugang.</strong> Sie nutzen die Verfahrensdokumentation
              ohne Zahlung. Eine Kündigung ist nicht erforderlich.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/account">
                Zurück zum Konto
              </Link>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto → Abo</p>
        <h1>Kündigung zum Ende des bezahlten Zeitraums</h1>
        <p className="lead">
          {periodLabel
            ? `Das Abonnement endet am ${periodLabel}, sofern Sie die Kündigung bestätigen.`
            : "Das Abonnement endet mit dem bereits bezahlten Zeitraum."}
        </p>

        {banner && (
          <p className={banner.tone === "ok" ? "banner ok" : "banner warn"} role="status">
            {banner.text}
          </p>
        )}

        {notice.phase === "cancel_scheduled" && (
          <p className="billing-status warn">
            <span className="billing-status-label">{notice.label}</span>
            <span>{notice.detail}</span>
          </p>
        )}

        <section className="card" aria-labelledby="folgen-heading">
          <h2 id="folgen-heading">Folgen der Kündigung</h2>
          <p className="prose">
            <strong>Online-Pflege und Versionierung entfallen</strong> mit dem Ende des
            bereits bezahlten Zeitraums. Bis dahin bleiben Ihr Konto, Ihre Entwürfe und
            Ihre PDF-Versionen nutzbar.
          </p>
          <p className="prose">
            Nach dem Vertragsende können Sie bereits erzeugte PDFs und hochgeladene
            Dateien noch 30 Tage herunterladen oder das Abonnement durch einen neuen
            Abschluss wiederherstellen. Danach löschen wir diese Daten. Sieben Tage vor
            der Löschung erhalten Sie eine Erinnerung.
          </p>
          <p className="prose">
            Die Aufbewahrung Ihrer Verfahrensdokumentation und der zugehörigen Unterlagen
            bleibt Ihre Pflicht. Für Bücher und Aufzeichnungen gelten in der Regel zehn
            Jahre (§ 147 AO). Wir führen kein Archiv für Sie. Nach der Löschung bei uns
            liegt eine Fassung nur noch dort, wo Sie sie gespeichert haben.
          </p>
          <p className="prose">
            Diese Seite kündigt das Abonnement. Sie erstattet nicht. Die
            14-Tage-Zufriedenheitsgarantie beantragen Sie gesondert per E-Mail an{" "}
            {MAIL_SUPPORT_EMAIL}. Es gelten die Regeln in den AGB.
          </p>
        </section>

        <section className="card" aria-labelledby="download-heading">
          <h2 id="download-heading">Dokumente herunterladen</h2>
          {hasExport && notice.downloadsOpen ? (
            <p className="actions">
              <a className="btn" href="/api/account/export">
                Alle PDF-Versionen und Uploads als ZIP herunterladen
              </a>
            </p>
          ) : (
            <p className="prose">Es liegen noch keine PDF-Versionen vor.</p>
          )}
          <p className="hint">
            Der Download bleibt auf dieser Seite. Die Kündigung ist davon nicht abhängig.
            Sie können auch in Textform an {MAIL_SUPPORT_EMAIL} kündigen.
          </p>
        </section>

        <section className="card" aria-labelledby="bestaetigen-heading">
          <h2 id="bestaetigen-heading">Kündigung bestätigen</h2>
          {scheduled ? (
            <p className="prose">
              Die Kündigung zum{" "}
              {periodLabel || "Ende des bezahlten Zeitraums"} ist bereits vorgemerkt.
              Bis dahin bleibt der bezahlte Umfang nutzbar.
            </p>
          ) : canConfirm ? (
            <>
              <form method="post" action="/api/account/kuendigung">
                <label className="check">
                  <input type="checkbox" name="acknowledged" value="yes" required />
                  <span>
                    Ich habe die Folgen der Kündigung zur Kenntnis genommen.
                  </span>
                </label>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn" type="submit">
                    Kündigung zum Periodenende bestätigen
                  </button>
                </div>
              </form>
              <form method="post" action="/api/account/kuendigung/portal" style={{ marginTop: 16 }}>
                <label className="check">
                  <input type="checkbox" name="acknowledged" value="yes" required />
                  <span>Ich habe die Folgen gelesen und möchte im Stripe-Portal kündigen.</span>
                </label>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn ghost" type="submit">
                    Im Stripe-Portal kündigen
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="prose">
              {stripeReady
                ? "Zu diesem Konto liegt kein kündbares Abonnement vor."
                : "Die Zahlung ist derzeit nicht angebunden. Eine Kündigung ist hier nicht möglich."}
            </p>
          )}
          <p className="hint">
            <Link href="/account/billing">Zahlungsmittel und Rechnungen</Link>
            {" · "}
            <Link href="/account">Zurück zum Konto</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
