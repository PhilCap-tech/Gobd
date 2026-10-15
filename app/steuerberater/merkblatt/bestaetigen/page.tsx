import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { KANZLEI_CONFIRM_INVALID } from "@/lib/kanzlei-copy";
import { firstQueryValue } from "@/lib/query";
import { verifyKanzleiDoiToken } from "@/lib/kanzlei-token";
import styles from "../../../home.module.css";
import { KanzleiConfirmPanel } from "./confirm-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anmeldung bestätigen",
  robots: { index: false, follow: false },
};

export default async function KanzleiConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const payload = verifyKanzleiDoiToken(token);

  return (
    <div className={`${styles.page} kanzlei-home`}>
      <SiteHeader ctaHref="/steuerberater#merkblatt" ctaLabel="Merkblatt" />
      <main className={styles.section}>
        <div className="shell">
          {payload ? (
            <KanzleiConfirmPanel token={token} />
          ) : (
            <>
              <h1>{KANZLEI_CONFIRM_INVALID}</h1>
              <p className={styles.prose}>
                <Link className={styles.inlineLink} href="/steuerberater#merkblatt">
                  Zurück zum Merkblatt
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
