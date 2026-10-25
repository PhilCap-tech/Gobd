import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { revokeKanzleiToolbox } from "@/lib/kanzlei-toolbox-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzlei-Eintrag entfernen",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function removeEntry(formData: FormData) {
  "use server";
  const result = await revokeKanzleiToolbox(String(formData.get("token") ?? ""));
  if (result.ok) redirect("/steuerberater/toolbox/entfernen?fertig=1");
}

export default async function KanzleiRemovePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = first((await searchParams).token);
  const done = first((await searchParams).fertig) === "1";
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <h1>Eintrag entfernen</h1>
        {done ? (
          <p>Der Kanzleiname wird nicht mehr angezeigt. Ihr Link führt auf den Ampel-Check ohne Namen.</p>
        ) : (
          <>
            <p>Der Widerruf ist kostenfrei und ohne Begründung. Der Name entfällt sofort. Eine Anmeldung ist dafür nicht nötig.</p>
            <form action={removeEntry}>
              <input type="hidden" name="token" value={token} />
              <button className="btn" type="submit">
                Eintrag entfernen
              </button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
