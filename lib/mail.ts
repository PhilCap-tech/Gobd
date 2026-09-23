import { Resend } from "resend";
import { isMailConfigured } from "@/lib/env";

export {
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";

export type MailResult = {
  stub: boolean;
  sent: boolean;
  id?: string;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend `Idempotency-Key`. Gleicher Key liefert denselben Versand, keinen zweiten. */
  idempotencyKey?: string;
}): Promise<MailResult> {
  if (!isMailConfigured()) {
    console.info("[mail] stub — RESEND_API_KEY oder EMAIL_FROM fehlt", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { stub: true, sent: false };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send(
      {
        from: process.env.EMAIL_FROM as string,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
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
