import { Resend } from "resend";
import { magicLinkDevFallbackAllowed } from "@/lib/env";

export {
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type MailResult = {
  stub: boolean;
  sent: boolean;
  id?: string;
  /** Claim already recorded this logical mail. No second send. */
  duplicate?: boolean;
  /** Another request still holds a fresh claim. */
  inflight?: boolean;
};

/**
 * Pauses before repeating one Resend call. The first attempt does not wait.
 * Only used together with an Idempotency-Key, so a lost response is the same send.
 */
export const MAIL_SEND_RETRY_DELAYS_MS = [0, 200, 600] as const;

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * A dropped connection (`statusCode` null) or a short-lived Resend status.
 * Validation and auth failures are final.
 */
export function isTransientResendError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "statusCode" in error ? (error as { statusCode?: unknown }).statusCode : undefined;
  if (status == null) return true;
  return typeof status === "number" && TRANSIENT_STATUS.has(status);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  });
}

let resendClient: Resend | null = null;
let resendClientKey = "";

/** Construction is synchronous and opens no socket. One client per API key. */
function resendFor(apiKey: string): Resend {
  if (!resendClient || resendClientKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendClientKey = apiKey;
  }
  return resendClient;
}

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
  attachments?: MailAttachment[];
}): Promise<MailResult> {
  const from = input.from?.trim() || process.env.EMAIL_FROM?.trim() || "";
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey || !from) {
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

  const resend = resendFor(apiKey);
  const payload = {
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.attachments && input.attachments.length > 0
      ? { attachments: input.attachments }
      : {}),
  };
  const options = input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined;
  const attempts = input.idempotencyKey ? MAIL_SEND_RETRY_DELAYS_MS.length : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const delay = MAIL_SEND_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) await wait(delay);
    try {
      const result = await resend.emails.send(payload, options);
      if (!result.error) return { stub: false, sent: true, id: result.data?.id };
      console.error("[mail] Resend Fehler", result.error);
      if (!isTransientResendError(result.error) || attempt === attempts - 1) {
        return { stub: false, sent: false };
      }
    } catch (error) {
      console.error("[mail] Versand fehlgeschlagen", error);
      if (attempt === attempts - 1) return { stub: false, sent: false };
    }
  }
  return { stub: false, sent: false };
}
