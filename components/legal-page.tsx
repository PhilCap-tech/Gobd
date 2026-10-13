import type { ReactNode } from "react";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type LegalPageProps = {
  title: string;
  children: ReactNode;
  crumbPath?: string;
};

export function LegalPage({ title, children, crumbPath }: LegalPageProps) {
  return (
    <>
      {crumbPath ? (
        <CrumbJsonLd
          items={[
            { name: "Startseite", path: "/" },
            { name: title, path: crumbPath },
          ]}
        />
      ) : null}
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page legal">
        <h1>{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
