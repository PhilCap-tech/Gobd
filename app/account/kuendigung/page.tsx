import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { isCompAccessEmail } from "@/lib/comp-access";
import { isStripeSecretConfigured } from "@/lib/env";
import {
  downloadsAvailableLabel,
  downloadsAvailableUntilIso,
  formatBerlinDate,
  lifecycleNotice,
} from "@/lib/kuendigung";
import { KuendigungActions } from "@/app/account/kuendigung/kuendigung-actions";
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
  const downloadUntil =
    notice.downloadsLabel ||
    downloadsAvailableLabel(
      downloadsAvailableUntilIso({
        periodEnd,
        endedAt: rows.find((row) => row.endedAt)?.endedAt,
        purgeAt: rows.find((row) => row.purgeAt)?.purgeAt,
        restoreUntil: rows.find((row) => row.restoreUntil)?.restoreUntil,
      }),
    );
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
        {(notice.label || downloadUntil) && (
          <p className="billing-status warn">
            {notice.label ? <span className="billing-status-label">{notice.label}</span> : null}
            {downloadUntil ? <span className="billing-status-label">{downloadUntil}</span> : null}
            {notice.detail ? <span>{notice.detail}</span> : null}
          </p>
        )}

        {banner && (
          <p className={banner.tone === "ok" ? "banner ok" : "banner warn"} role="status">
            {banner.text}
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
            Nach dem Vertragsende sind Downloads noch 30 Tage möglich. In dieser Frist können
            Sie bereits erzeugte PDFs herunterladen oder das Abonnement durch einen neuen
            Abschluss wiederherstellen.
          </p>
          <p className="prose">
            Die Aufbewahrung Ihrer Verfahrensdokumentation und der zugehörigen Unterlagen
            bleibt Ihre Pflicht. Für Bücher und Aufzeichnungen gelten in der Regel zehn
            Jahre (§ 147 AO). Wir führen kein Archiv für Sie. Eine Fassung liegt dort, wo
            Sie sie gespeichert haben.
          </p>
          <p className="prose">
            Diese Seite kündigt das Abonnement. Sie erstattet nicht. Die
            14-Tage-Zufriedenheitsgarantie beantragen Sie gesondert per E-Mail an{" "}
            {MAIL_SUPPORT_EMAIL}. Es gelten die Regeln in den AGB.
          </p>
        </section>

        {notice.downloadsOpen ? (
          <KuendigungActions
            hasExport={hasExport}
            canConfirm={canConfirm}
            portalFallback={status === "portal" && canConfirm}
          />
        ) : (
          <section className="card">
            <p className="prose">
              Die Downloadfrist nach dem Vertragsende ist abgelaufen.
            </p>
          </section>
        )}

        <section className="card" aria-labelledby="bestaetigen-heading">
          <h2 id="bestaetigen-heading">Kündigung</h2>
          {scheduled ? (
            <p className="prose">
              Die Kündigung zum{" "}
              {periodLabel || "Ende des bezahlten Zeitraums"} ist bereits vorgemerkt.
              Bis zum Vertragsende bleibt der bezahlte Umfang nutzbar.
            </p>
          ) : canConfirm ? (
            <p className="prose">
              Als Nächstes öffnet sich das Stripe-Portal. Die Kündigung wirkt zum Ende des
              bereits bezahlten Zeitraums. Sie können auch in Textform an {MAIL_SUPPORT_EMAIL}{" "}
              kündigen.
            </p>
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
