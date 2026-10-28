import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { FRAGEBOGEN_BEZAHLT_PATH } from "@/lib/fragebogen";
import { loadIntakeDraft, saveIntakeDraft } from "@/lib/intake-draft";
import { logError } from "@/lib/log-error";
import { rememberOpenDraft } from "@/lib/open-drafts";
import { adoptPaidDraft } from "@/lib/prepay-draft";
import { firstQueryValue } from "@/lib/query";
import { resolveCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Rückkehr aus dem Stripe-Checkout (Login zuerst). Nur bei bestätigter
 * Zahlung (resolveCheckoutSession: bezahlt) wird der Login-Entwurf in den
 * Entwurf der bezahlten Session übernommen; danach der bezahlte Weg /intake,
 * wo die Dokumentation erstellt wird. Ohne Zahlung: weiter zum normalen
 * /intake-Einstieg, der die Session selbst prüft.
 */
export default async function BezahltPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const sessionId = (firstQueryValue(params.session_id) ?? "").trim();
  const intake = `/intake?session_id=${encodeURIComponent(sessionId)}`;
  if (!sessionId) redirect("/account");
  const email = await getSessionEmail();
  if (!email) redirect(loginPath(`${FRAGEBOGEN_BEZAHLT_PATH}?session_id=${encodeURIComponent(sessionId)}`));
  try {
    const identity = await resolveCheckoutSession(sessionId);
    if (!("error" in identity) && !identity.stub) {
      await adoptPaidDraft(
        { sessionEmail: email, identity },
        { load: loadIntakeDraft, save: saveIntakeDraft, remember: rememberOpenDraft },
      );
    }
  } catch (error) {
    logError("[fragebogen] Entwurf nach Zahlung nicht übernommen", error);
  }
  redirect(intake);
}
