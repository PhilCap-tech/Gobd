import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DocumentRevisionActions,
  VersionHistory,
} from "@/components/document-revision";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import {
  formatDocumentTime,
  groupDocumentFamilies,
  parseDocumentVersion,
} from "@/lib/documents";
import { listDocumentsByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meine Dokumente",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const email = await getSessionEmail();
  if (!email) {
    redirect("/login");
  }

  const docs = await listDocumentsByEmail(email);
  const families = groupDocumentFamilies(docs);
  const latest = families[0]?.latest;
  const stripeBound = docs.some((row) => row.stripeCustomerId || row.stripeSessionId);

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        <h1>Meine Dokumente</h1>
        <p className="lead">{email}</p>

        {families.length === 0 ? (
          <div className="card">
            <p className="prose">
              Zu dieser E-Mail liegt noch kein Entwurf vor.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/checkout">
                Dokumentation starten
              </Link>
            </div>
          </div>
        ) : (
          <>
            {latest && (
              <div className="card" style={{ marginBottom: 16 }}>
                <p className="doc-meta">Aktuellste Fassung</p>
                <DocumentRevisionActions
                  row={latest}
                  downloadLabel="Neueste Version herunterladen"
                />
              </div>
            )}
            <div className="doc-list">
              {families.map((family) => (
                <article className="card" key={family.familyId}>
                  <h2>{family.latest.company || "Verfahrensdokumentation"}</h2>
                  <p className="doc-meta">
                    Aktuell Version {parseDocumentVersion(family.latest)} ·{" "}
                    {formatDocumentTime(family.latest.timestamp)} ·{" "}
                    {family.latest.deliveryStatus || "ready"}
                  </p>
                  <DocumentRevisionActions row={family.latest} />
                  <VersionHistory versions={family.versions} />
                </article>
              ))}
            </div>
          </>
        )}

        <p className="hint" style={{ marginTop: 20 }}>
          {stripeBound
            ? "Identität über die Checkout-E-Mail / Stripe-Session gebunden."
            : "Identität über die E-Mail aus dem Intake."}{" "}
          Abo verwalten (Stripe Customer Portal) — folgt.
        </p>

        <form action="/api/auth/logout" method="post" style={{ marginTop: 16 }}>
          <button className="btn ghost" type="submit">
            Abmelden
          </button>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
