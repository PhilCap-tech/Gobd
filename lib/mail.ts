import { Resend } from "resend";
import { magicLinkDevFallbackAllowed } from "@/lib/env";

export {
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";

export type MailResult = {
  stub: boolean;
  sent: boolean;
  id?: string;
  /** Claim already recorded this logical mail. No second send. */
  duplicate?: boolean;
  /** Another request still holds a fresh claim. */
  inflight?: boolean;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend `Idempotency-Key`. Gleicher Key liefert denselben Versand, keinen zweiten. */
  idempotencyKey?: string;
  /** Antwortadresse, z. B. die E-Mail aus einem Formular. */
  replyTo?: string;
  /**
   * Absender für diese eine Mail. Ohne Angabe gilt `EMAIL_FROM`.
   * Kündigungsmails setzen hier die info@-Adresse, ohne die Umgebung zu ändern.
   */
  from?: string;
}): Promise<MailResult> {
  const from = input.from?.trim() || process.env.EMAIL_FROM?.trim() || "";
  if (!process.env.RESEND_API_KEY?.trim() || !from) {
    const text =
      input.text.includes("/auth/verify?") && !magicLinkDevFallbackAllowed()
        ? "[redacted]"
        : input.text;
    console.info("[mail] stub — RESEND_API_KEY oder EMAIL_FROM fehlt", {
      to: input.to,
      subject: input.subject,
      text,
    });
    return { stub: true, sent: false };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send(
      {
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      },
      input.idempotencyKey
        ? { idempotencyKey: input.idempotencyKey }
        : undefined,
    );
    if (result.error) {
      console.error("[mail] Resend Fehler", result.error);
      return { stub: false, sent: false };
    }
    return { stub: false, sent: true, id: result.data?.id };
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen", error);
    return { stub: false, sent: false };
  }
}
