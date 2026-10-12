import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page">
        <p className="kicker">404</p>
        <h1>Seite nicht gefunden</h1>
        <p className="lead">
          Diese Adresse gibt es nicht oder sie wurde verschoben.
        </p>
        <div className="actions">
          <Link className="btn" href="/">
            Zur Startseite
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
