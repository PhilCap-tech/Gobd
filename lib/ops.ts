/**
 * GoBD Ops — Stub.
 *
 * TODO: echte E-Mails / Alerts (Onboarding, Failed Payment, Failed Job).
 * Hier wird nichts versendet.
 */

export type OpsResult = {
  stub: true;
  sent: false;
  action: "onboarding" | "failed_payment" | "failed_job";
};

export async function triggerOnboardingMail(input: {
  email: string;
  company?: string;
  sessionId?: string;
}): Promise<OpsResult> {
  try {
    console.info("[ops] onboarding mail stub", {
      email: input.email,
      company: input.company,
      sessionId: input.sessionId,
    });
  } catch (error) {
    console.error("[ops] onboarding mail stub failed", error);
  }
  return { stub: true, sent: false, action: "onboarding" };
}

export async function handleFailedPayment(input: {
  email?: string;
  sessionId?: string;
  invoiceId?: string;
  reason?: string;
}): Promise<OpsResult> {
  try {
    // TODO: Ops benachrichtigen, ggf. Kundenmail zu fehlgeschlagener Zahlung.
    console.warn("[ops] failed payment stub", input);
  } catch (error) {
    console.error("[ops] failed payment stub failed", error);
  }
  return { stub: true, sent: false, action: "failed_payment" };
}

export async function handleFailedJob(input: {
  sessionId?: string;
  job?: string;
  reason?: string;
}): Promise<OpsResult> {
  try {
    // TODO: Alert an Ops, Job erneut einreihen.
    console.warn("[ops] failed job stub", input);
  } catch (error) {
    console.error("[ops] failed job stub failed", error);
  }
  return { stub: true, sent: false, action: "failed_job" };
}
