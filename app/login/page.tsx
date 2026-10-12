import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, safeNextPath } from "@/lib/auth";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
import {
  LOGIN_FOR_ANSWERS_COPY,
  loginClientFields,
  ownerEmailForLoginNext,
} from "@/lib/checkout-session";
import { firstQueryValue } from "@/lib/query";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
} from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anmelden",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
    sent?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstQueryValue(params.next));
  const email = await getSessionEmail();
  if (email) {
    redirect(next ?? "/account");
  }

  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const sent = Array.isArray(params.sent) ? params.sent[0] : params.sent;
  const checkoutEmail = await ownerEmailForLoginNext(next, {
    findDocumentById,
    findLatestBySession: findLatestDocumentByStripeSessionId,
    resolveCheckout: resolveCheckoutSession,
    grantEmail: async (sessionId) => (await checkoutSessionGrant(sessionId))?.email ?? null,
  });
  const fields = loginClientFields({
    next,
    checkoutEmail,
    sessionEmail: null,
  });

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        <h1>Anmelden</h1>
        <p className="lead">
          {fields.explain
            ? LOGIN_FOR_ANSWERS_COPY
            : "Magic Link an die Checkout-E-Mail. Kein Passwort."}
        </p>
        {error === "invalid" && (
          <p className="error">
            Der Link ist ungültig oder abgelaufen. Bitte einen neuen anfordern.
          </p>
        )}
        {error === "send" && (
          <p className="error">
            Der Anmeldelink konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.
          </p>
        )}
        <LoginForm
          next={next}
          maskedEmail={fields.masked}
          resolveOwner={fields.resolveOwner}
          initialSent={sent === "1"}
        />
      </main>
      <SiteFooter />
    </>
  );
}
