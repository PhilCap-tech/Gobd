import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import {
  documentDownloadPath,
  formatDocumentTime,
  groupDocumentFamilies,
  intakeEditPath,
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
              <div className="actions" style={{ marginBottom: 16 }}>
                <a className="btn" href={documentDownloadPath(latest)}>
                  Neueste Version herunterladen
                </a>
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
                  <div className="actions" style={{ marginTop: 12 }}>
                    <a
                      className="btn"
                      href={documentDownloadPath(family.latest)}
                    >
                      PDF herunterladen
                    </a>
                    <Link
                      className="btn ghost"
                      href={intakeEditPath(family.latest)}
                    >
                      Angaben bearbeiten
                    </Link>
                  </div>
                  <h3 className="version-heading">Versionen</h3>
                  <ul className="version-list">
                    {family.versions.map((row) => (
                      <li key={row.documentId}>
                        <span>
                          Version {parseDocumentVersion(row)} ·{" "}
                          {formatDocumentTime(row.timestamp)}
                        </span>
                        <a href={documentDownloadPath(row)}>Download</a>
                      </li>
                    ))}
                  </ul>
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
