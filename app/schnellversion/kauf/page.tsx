import type { Metadata } from "next";
import { SchnellversionKauf } from "@/components/schnellversion-kauf";
import { SchnellversionShell } from "@/components/schnellversion-shell";
import { requireSchnellversionTest } from "@/lib/schnellversion-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schnellversion kaufen",
  robots: { index: false, follow: false },
};

export default async function SchnellversionKaufPage() {
  await requireSchnellversionTest();
  return (
    <SchnellversionShell>
      <SchnellversionKauf />
    </SchnellversionShell>
  );
}
