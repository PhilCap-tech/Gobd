import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SchnellversionDankeWarten } from "@/components/schnellversion-danke-warten";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { notFound } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { SV_DOWNLOAD_COOKIE } from "@/lib/schnellversion-assign";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { readSchnellversionCheckout } from "@/lib/schnellversion-payment";
import { schnellversionPageMetadata } from "@/lib/schnellversion-meta";
import { svDownloadAllowed } from "@/lib/schnellversion-record";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return schnellversionPageMetadata("Schnellversion");
}

export default async function SchnellversionDankePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  if (!schnellversionOffered()) notFound();
  const params = await searchParams;
  const sessionId = (Array.isArray(params.session_id) ? params.session_id[0] : params.session_id)?.trim() ?? "";
  const looked = sessionId ? await readSchnellversionCheckout(sessionId) : { state: "unpaid" as const };
  const email = (await getSessionEmail()) ?? "";
  const cookie = decodeURIComponent((await cookies()).get(SV_DOWNLOAD_COOKIE)?.value ?? "");
  const purchase = looked.state === "paid" || looked.state === "ended" ? looked.purchase : null;
  const allowed = purchase
    ? svDownloadAllowed(purchase, { email, token: cookie, now: new Date() })
    : false;
  const draftHref = purchase?.email ? "/fragebogen" : "";
  const pdfHref = allowed ? `/api/schnellversion/pdf?session_id=${encodeURIComponent(sessionId)}` : "";
  return (
    <SchnellversionShell>
      <main className="shell" style={{ maxWidth: 720, margin: "28px auto 48px" }}>
        {looked.state === "confirming" ? (
          <SchnellversionDankeWarten sessionId={sessionId} />
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
        ) : looked.state === "ended" ? (
          <>
            <h1>Der Download ist beendet.</h1>
            <p>Die 30 Tage sind abgelaufen.</p>
          </>
        ) : looked.state === "paid" ? (
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
