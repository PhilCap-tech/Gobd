import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AccountBillingStatus,
  AccountInvoiceList,
} from "@/components/account-billing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { isStripeSecretConfigured } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import {
  loadCustomerBilling,
  portalStatusCopy,
  portalStatusFromQuery,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abo & Rechnungen",
  robots: { index: false, follow: false },
};

export default async function AccountBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string | string[] }>;
}) {
  const email = await getSessionEmail();
  if (!email) {
    redirect(loginPath("/account/billing"));
  }

  const params = await searchParams;
  const portalStatus = portalStatusFromQuery(firstQueryValue(params.portal));
  const portalCopy = portalStatus ? portalStatusCopy(portalStatus) : null;

  const stripeReady = isStripeSecretConfigured();
  const customerId = await findLatestStripeCustomerIdByEmail(email);
  const hasCustomer = Boolean(customerId);
  const billing =
    stripeReady && customerId
      ? await loadCustomerBilling(customerId)
      : {
          subscriptionStatus: "none" as const,
          invoices: [],
          lookupFailed: false,
        };

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        <h1>Abo &amp; Rechnungen</h1>
        <p className="lead">{email}</p>

        {portalCopy && (
          <p
            className={portalCopy.tone === "ok" ? "banner ok" : "banner warn"}
            role="status"
          >
            {portalCopy.text}
          </p>
        )}

        <div className="billing-stack">
          <AccountBillingStatus
            status={billing.subscriptionStatus}
            stripeReady={stripeReady}
            hasCustomer={hasCustomer}
            lookupFailed={billing.lookupFailed}
          />
          <AccountInvoiceList invoices={billing.invoices} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
