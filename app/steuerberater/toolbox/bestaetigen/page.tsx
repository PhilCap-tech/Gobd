import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { confirmKanzleiToolbox } from "@/lib/kanzlei-toolbox-flow";
import { KANZLEI_TOOLBOX_NEWSLETTER_NOTE, kanzleiNewsletterLong, kanzleiNewsletterShort } from "@/lib/kanzlei-toolbox-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzlei-Toolbox bestätigen",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function KanzleiToolboxConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = first((await searchParams).token);
  const result = token ? await confirmKanzleiToolbox(token) : { ok: false as const, error: "Der Bestätigungslink fehlt." };
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <h1>Kanzlei-Toolbox</h1>
        {result.ok ? (
          <>
            <p>
              {result.status === "pending"
                ? "Ihre E-Mail-Adresse ist bestätigt. Der automatische Abgleich mit der Website ist in Ordnung. Den Kanzleinamen zeigen wir erst, wenn der Abgleich mit dem amtlichen Steuerberaterverzeichnis abgeschlossen ist. Bis dahin führt Ihr Link auf den Ampel-Check ohne Namen."
                : result.status === "verified"
                  ? "Ihre Anmeldung ist bestätigt. Der Kanzleiname kann auf dem Ampel-Check angezeigt werden."
                  : "Ihre E-Mail-Adresse ist bestätigt. Der automatische Abgleich ist nicht aufgegangen. Der Kanzleiname wird nicht angezeigt. Wenn die Angaben stimmen, schreiben Sie an info@gobd-doku-erstellen.de. Wir prüfen den Eintrag dann von Hand."}
            </p>
            <p>
              Ihr Link: <Link href={`/k/${result.slug}`}>{`/k/${result.slug}`}</Link>
            </p>
            <h2>Newsletter-Baustein, kurz</h2>
            <pre>{kanzleiNewsletterShort(result.slug)}</pre>
            <h2>Newsletter-Baustein, lang</h2>
            <pre>{kanzleiNewsletterLong(result.slug)}</pre>
            <p>{KANZLEI_TOOLBOX_NEWSLETTER_NOTE}</p>
            <p>QR-Code und Merkblatt gehen zusätzlich an die bestätigte Adresse, sofern der Versand freigegeben ist.</p>
          </>
        ) : (
          <p role="alert">{result.error}</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
