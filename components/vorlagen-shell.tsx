import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function VorlagenShell({
  backHref = "/vorlagen",
  backLabel = "← Zu den Vorlagen",
  children,
}: {
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader backHref={backHref} backLabel={backLabel} />
      <main className="wrap page">{children}</main>
      <SiteFooter />
    </>
  );
}
