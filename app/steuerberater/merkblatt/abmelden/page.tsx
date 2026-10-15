import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { KANZLEI_UNSUBSCRIBE_LABEL } from "@/lib/kanzlei-copy";
import { firstQueryValue } from "@/lib/query";
import styles from "../../../home.module.css";
import { KanzleiUnsubscribePanel } from "./unsubscribe-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzlei-Informationen abmelden",
  robots: { index: false, follow: false },
};

export default async function KanzleiUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";

  return (
    <div className={`${styles.page} kanzlei-home`}>
      <SiteHeader ctaHref="/steuerberater#merkblatt" ctaLabel="Merkblatt" />
      <main className={styles.section}>
        <div className="shell">
          <h1>{KANZLEI_UNSUBSCRIBE_LABEL}</h1>
          <KanzleiUnsubscribePanel token={token} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
