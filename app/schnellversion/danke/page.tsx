import type { Metadata } from "next";
import Link from "next/link";
import { SchnellversionDankeWarten } from "@/components/schnellversion-danke-warten";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { notFound } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { confirmPaidSession } from "@/lib/schnellversion-payment";
import { downloadStillOpen, svDownloadAllowed } from "@/lib/schnellversion-record";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schnellversion",
  robots: { index: false, follow: false },
};

export default async function SchnellversionDankePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[]; dl?: string | string[] }>;
}) {
  if (!schnellversionOffered()) notFound();
  const params = await searchParams;
  const sessionId = (Array.isArray(params.session_id) ? params.session_id[0] : params.session_id)?.trim() ?? "";
  const token = (Array.isArray(params.dl) ? params.dl[0] : params.dl)?.trim() ?? "";
  const confirmed = sessionId ? await confirmPaidSession(sessionId) : { paid: false as const };
  const email = (await getSessionEmail()) ?? "";
  const open = confirmed.paid && downloadStillOpen(confirmed.purchase, new Date());
  const allowed = confirmed.paid && svDownloadAllowed(confirmed.purchase, { email, token, now: new Date() });
  const draftHref = confirmed.paid && confirmed.purchase.email ? "/fragebogen" : "";
  const pdfHref = allowed
    ? `/api/schnellversion/pdf?session_id=${encodeURIComponent(sessionId)}${token ? `&dl=${encodeURIComponent(token)}` : ""}`
    : "";
  return (
    <SchnellversionShell>
      <main className="shell" style={{ maxWidth: 720, margin: "28px auto 48px" }}>
        {!confirmed.paid && confirmed.confirming ? (
          <SchnellversionDankeWarten sessionId={sessionId} token={token} />
        ) : allowed && pdfHref ? (
          <>
            <h1>Ihre Standardfassung steht zum Download bereit.</h1>
            <p>
              <a className="btn" href={pdfHref}>
                PDF herunterladen
              </a>
            </p>
            <p>Download 30 Tage im Konto. Bitte speichern Sie das PDF selbst.</p>
            {draftHref ? (
              <p>
                Ihre 6 Angaben übernehmen wir in den Fragebogen. <Link href={draftHref}>Fragebogen fortsetzen</Link>
              </p>
            ) : null}
          </>
        ) : confirmed.paid && !open ? (
          <>
            <h1>Der Download ist beendet.</h1>
            <p>Die 30 Tage sind abgelaufen.</p>
          </>
        ) : confirmed.paid ? (
          <>
            <h1>Die Standardfassung gehört zu einem anderen Konto.</h1>
            <p>Melden Sie sich mit der E-Mail-Adresse des Kaufs an.</p>
          </>
        ) : (
          <>
            <h1>Die Zahlung ist nicht abgeschlossen.</h1>
            <p>Es wird kein PDF erstellt und kein Kauf gespeichert.</p>
            <p>
              <Link href="/schnellversion/kauf">Zurück zur Kaufseite</Link>
            </p>
          </>
        )}
      </main>
    </SchnellversionShell>
  );
}
