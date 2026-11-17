import type { Metadata } from "next";
import { SchnellversionDanke } from "@/components/schnellversion-danke";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { requireSchnellversionTest } from "@/lib/schnellversion-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schnellversion",
  robots: { index: false, follow: false },
};

export default async function SchnellversionDankePage() {
  await requireSchnellversionTest();
  return (
    <SchnellversionShell>
      <SchnellversionDanke />
    </SchnellversionShell>
  );
}
