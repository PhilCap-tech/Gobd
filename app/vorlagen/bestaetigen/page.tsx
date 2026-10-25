import type { Metadata } from "next";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { firstQueryValue } from "@/lib/query";
import { looksLikeMagnetToken } from "@/lib/vorlagen/token";
import { MagnetConfirmPanel } from "./confirm-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
  robots: { index: false, follow: false },
};

export default async function MagnetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";

  return (
    <VorlagenShell>
      <h1>Vorlage bestätigen</h1>
      {looksLikeMagnetToken(token) ? <MagnetConfirmPanel token={token} /> : <p className="card" role="alert">Dieser Link ist ungültig.</p>}
    </VorlagenShell>
  );
}
