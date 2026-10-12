import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, readExpiredMagicToken, safeNextPath } from "@/lib/auth";
import {
  EXPIRED_LINK_HEADING,
  EXPIRED_LINK_LEAD,
  isOnboardingIntakeNext,
  maskEmailAddress,
} from "@/lib/expired-onboarding-link";
import { firstQueryValue } from "@/lib/query";
import { RenewExpiredLinkButton } from "./renew-link-button";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Anmeldelink abgelaufen",
  robots: { index: false, follow: false },
};

export default async function ExpiredOnboardingLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstQueryValue(params.next));
  const token = firstQueryValue(params.token) ?? "";
  const email = readExpiredMagicToken(token);

  if (!email || !isOnboardingIntakeNext(next)) {
    redirect(next ? `/login?error=invalid&next=${encodeURIComponent(next)}` : "/login?error=invalid");
  }

  const sessionEmail = await getSessionEmail();
  if (sessionEmail) {
    redirect(next);
  }

  const masked = maskEmailAddress(email);

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        <h1>{EXPIRED_LINK_HEADING}</h1>
        <p className="lead">{EXPIRED_LINK_LEAD}</p>
        <RenewExpiredLinkButton email={email} masked={masked} next={next} />
      </main>
      <SiteFooter />
    </>
  );
}
