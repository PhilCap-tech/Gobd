import type { Metadata } from "next";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_LINK_INVALID, MAGNET_UNSUBSCRIBE_TITLE } from "@/lib/vorlagen/copy";
import { firstQueryValue } from "@/lib/query";
import { looksLikeMagnetToken } from "@/lib/vorlagen/token";
import { MagnetUnsubscribePanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: MAGNET_UNSUBSCRIBE_TITLE,
  robots: { index: false, follow: false },
};

export default async function MagnetUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const valid = looksLikeMagnetToken(token);

  return (
    <VorlagenShell>
      <h1>{MAGNET_UNSUBSCRIBE_TITLE}</h1>
      {valid ? <MagnetUnsubscribePanel token={token} /> : <p className="card" role="alert">{MAGNET_LINK_INVALID}</p>}
    </VorlagenShell>
  );
}
