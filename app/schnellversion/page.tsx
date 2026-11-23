import type { Metadata } from "next";
import { SchnellversionFunnel } from "@/components/schnellversion-funnel";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { requireSchnellversionTest } from "@/lib/schnellversion-gate";
import { schnellversionPageMetadata } from "@/lib/schnellversion-meta";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return schnellversionPageMetadata("Schnellversion");
}

export default async function SchnellversionPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[]; return?: string | string[] }>;
}) {
  await requireSchnellversionTest();
  const params = await searchParams;
  const raw = Array.isArray(params.step) ? params.step[0] : params.step;
  const back = Array.isArray(params.return) ? params.return[0] : params.return;
  const step = Number(raw || "1");
  return (
    <SchnellversionShell>
      <SchnellversionFunnel initialStep={step >= 1 && step <= 6 ? step : 1} returnToKauf={back === "kauf"} />
    </SchnellversionShell>
  );
}
