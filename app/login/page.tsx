import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, safeNextPath } from "@/lib/auth";
import {
  answersLoginOffer,
  checkoutCustomerEmail,
  emailForAnswersLogin,
  intakeTargetFromNext,
  loginCheckoutEmail,
  LOGIN_FOR_ANSWERS_COPY,
} from "@/lib/checkout-session";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
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
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstQueryValue(params.next));
  const email = await getSessionEmail();
  if (email) {
    redirect(next ?? "/account");
  }

  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const target = intakeTargetFromNext(next);
  let documentEmail = "";
  if (target && (target.documentId || target.sessionId)) {
    const row = target.documentId
      ? await findDocumentById(target.documentId)
      : await findLatestDocumentByStripeSessionId(target.sessionId);
    documentEmail = emailForAnswersLogin(row, target);
  }
  const fromCheckout =
    target?.sessionId && !documentEmail
      ? await checkoutCustomerEmail(target.sessionId, resolveCheckoutSession)
      : "";
  const recorded =
    target?.sessionId && !documentEmail && !fromCheckout
      ? await checkoutSessionGrant(target.sessionId)
      : null;
  const offer = answersLoginOffer({
    next,
    checkoutEmail: loginCheckoutEmail({
      documentEmail,
      checkoutCustomerEmail: fromCheckout || recorded?.email,
    }),
  });

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        <h1>Anmelden</h1>
        <p className="lead">
          {offer.explain
            ? LOGIN_FOR_ANSWERS_COPY
            : "Magic Link an die Checkout-E-Mail. Kein Passwort."}
        </p>
        {error === "invalid" && (
          <p className="error">
            Der Link ist ungültig oder abgelaufen. Bitte einen neuen anfordern.
          </p>
        )}
        <LoginForm
          next={next}
          prefillEmail={offer.email}
          maskedEmail={offer.masked}
        />
      </main>
      <SiteFooter />
    </>
  );
}
