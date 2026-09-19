import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type LegalPageProps = {
  title: string;
  children: ReactNode;
};

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page legal">
        <h1>{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
