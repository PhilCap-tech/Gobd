import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MODULE } from "@/lib/module/katalog";
import { previewInvite } from "@/lib/membership-invite";
import { getEntity } from "@/lib/store";
import { InviteAcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Einladung",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function moduleLabel(id: string): string {
  const modul = MODULE.find((item) => item.id === id);
  if (!modul) return id;
  return `${modul.nr} ${modul.titel}`;
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? "";
  const preview = token ? await previewInvite(token, getEntity) : null;

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Startseite" links={[]} />
      <main className="wrap page">
        <p className="kicker">Mitwirkende</p>
        <h1>Einladung annehmen</h1>
        {!preview?.ok ? (
          <div className="card">
            <p className="prose">
              Dieser Einladungslink ist nicht mehr gültig. Bitten Sie die einladende Person, die
              Einladung erneut zu senden.
            </p>
          </div>
        ) : (
          <div className="card">
            <p className="lead" style={{ marginTop: 0 }}>
              {preview.name}
            </p>
            {preview.address ? <p>{preview.address}</p> : null}
            <p className="hint">Eingeladen von {preview.ownerEmail}</p>
            <p>
              Sie sind eingeladen, als Mitwirkende Module dieser Firma auszufüllen. Die
              PDF-Fassung ist für Sie nicht lesbar. Sie erzeugt der Kontoinhaber.
            </p>
            <p>
              {preview.moduleIds.length === 0
                ? "Alle aktiven Module"
                : preview.moduleIds.map((id) => moduleLabel(id)).join(", ")}
            </p>
            <InviteAcceptForm token={token} />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
