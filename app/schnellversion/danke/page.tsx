import type { Metadata } from "next";
import Link from "next/link";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { notFound } from "next/navigation";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { confirmPaidSession } from "@/lib/schnellversion-payment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schnellversion",
  robots: { index: false, follow: false },
};

export default async function SchnellversionDankePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  if (!schnellversion49Enabled()) notFound();
  const params = await searchParams;
  const sessionId = (Array.isArray(params.session_id) ? params.session_id[0] : params.session_id)?.trim() ?? "";
  const confirmed = sessionId ? await confirmPaidSession(sessionId) : { paid: false as const };
  const draftHref = confirmed.paid && confirmed.purchase.email
    ? `/fragebogen`
    : "";
  return (
    <SchnellversionShell>
      <main className="shell" style={{ maxWidth: 720, margin: "28px auto 48px" }}>
        {confirmed.paid ? (
          <>
            <h1>Ihre Standardfassung steht zum Download bereit.</h1>
            <p>
              <a className="btn" href={`/api/schnellversion/pdf?session_id=${encodeURIComponent(sessionId)}`}>
                PDF herunterladen
              </a>
            </p>
            <p>Download 30 Tage im Konto. Bitte speichern Sie das PDF selbst.</p>
            {draftHref ? (
              <p>
                Ihre 6 Angaben übernehmen wir in den Fragebogen.{" "}
                <Link href={draftHref}>Fragebogen fortsetzen</Link>
              </p>
            ) : null}
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
