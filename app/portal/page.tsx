import type { Metadata } from "next";
import Link from "next/link";
import { redirectToStripePortalOrAccount } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abo-Portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  await redirectToStripePortalOrAccount("/portal");
  return (
    <main className="wrap page">
      <h1>Weiterleitung…</h1>
      <p className="lead">
        Falls du nicht automatisch weitergeleitet wirst:
      </p>
      <p>
        <Link href="/account">Zum Konto</Link>
      </p>
    </main>
  );
}
