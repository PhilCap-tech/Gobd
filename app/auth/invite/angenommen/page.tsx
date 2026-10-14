import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Einladung angenommen",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InviteAcceptedPage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Startseite" links={[]} />
      <main className="wrap page">
        <p className="kicker">Mitwirkende</p>
        <h1>Einladung angenommen</h1>
        <div className="card">
          <p>
            Sie haben die Einladung angenommen und sind als Mitwirkende angemeldet.
          </p>
          <p>
            Sie füllen Module aus und speichern Entwürfe. Die PDF-Fassung ist für Sie nicht
            lesbar. Sie erzeugt der Kontoinhaber.
          </p>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="btn" href="/account">
              Zum Konto
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
