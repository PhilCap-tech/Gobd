import type { Metadata } from "next";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_LINK_INVALID } from "@/lib/vorlagen/copy";
import { firstQueryValue } from "@/lib/query";
import { verifyMagnetMarketingToken } from "@/lib/vorlagen/token";
import { MagnetMarketingPanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail-Informationen bestätigen",
  robots: { index: false, follow: false },
};

export default async function MagnetMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const valid = Boolean(verifyMagnetMarketingToken(token));

  return (
    <VorlagenShell>
      <h1>E-Mail-Informationen bestätigen</h1>
      {valid ? <MagnetMarketingPanel token={token} /> : <p className="card" role="alert">{MAGNET_LINK_INVALID}</p>}
    </VorlagenShell>
  );
}
