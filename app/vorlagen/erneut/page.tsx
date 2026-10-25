import type { Metadata } from "next";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_LINK_EXPIRED, MAGNET_LINK_INVALID } from "@/lib/vorlagen/copy";
import { firstQueryValue } from "@/lib/query";
import { looksLikeMagnetToken } from "@/lib/vorlagen/token";
import { MagnetRenewPanel } from "./renew-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neuen Link anfordern",
  robots: { index: false, follow: false },
};

export default async function MagnetRenewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const known = looksLikeMagnetToken(token);

  return (
    <VorlagenShell>
      <h1>Neuen Link anfordern</h1>
      {known ? (
        <>
          <p>{MAGNET_LINK_EXPIRED}</p>
          <MagnetRenewPanel token={token} />
        </>
      ) : (
        <p className="card" role="alert">{MAGNET_LINK_INVALID}</p>
      )}
    </VorlagenShell>
  );
}
