import type { Metadata } from "next";
import { SchnellversionKauf } from "@/components/schnellversion-kauf";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { requireSchnellversionTest } from "@/lib/schnellversion-gate";
import { schnellversionPageMetadata } from "@/lib/schnellversion-meta";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return schnellversionPageMetadata("Schnellversion kaufen");
}

export default async function SchnellversionKaufPage() {
  await requireSchnellversionTest();
  return (
    <SchnellversionShell>
      <SchnellversionKauf />
    </SchnellversionShell>
  );
}
