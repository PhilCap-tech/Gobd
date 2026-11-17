import type { ReactNode } from "react";
import home from "@/app/home.module.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CTA_START } from "@/lib/offer-copy";

export function SchnellversionShell({ children }: { children: ReactNode }) {
  return (
    <div className={`${home.page} kanzlei-home`}>
      <SiteHeader
        ctaHref="/checkout"
        ctaLabel={CTA_START}
        links={[
          { href: "/#muster", label: "Muster" },
          { href: "/#bereiche", label: "Module" },
          { href: "/#ablauf", label: "Ablauf" },
          { href: "/#preise", label: "Preise" },
        ]}
      />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
