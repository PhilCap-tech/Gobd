/**
 * Inbound inquiry from /steuerberater („VD für mehrere Mandanten“).
 * Mail goes to Ops via the existing Resend path. No checkout, no Soft-Invite.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PARTNER_INQUIRY_HONEYPOT_FIELD = "company_website";

export type PartnerInquiry = {
  name: string;
  kanzlei: string;
  email: string;
  mandantenZahl: string;
  message: string;
};

export type PartnerInquiryParse =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; inquiry: PartnerInquiry }
  | { ok: false; error: string };

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n\u0000]+/g, " ").trim();
}

function honeypotTripped(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value != null && value !== false;
}

export function parsePartnerInquiry(body: unknown): PartnerInquiryParse {
  const v = asRecord(body);
  if (!v) return { ok: false, error: "Ungültige Anfrage." };

  if (honeypotTripped(v[PARTNER_INQUIRY_HONEYPOT_FIELD])) {
    return { ok: true, honeypot: true };
  }

  const name = singleLine(typeof v.name === "string" ? v.name : "");
  const kanzlei = singleLine(typeof v.kanzlei === "string" ? v.kanzlei : "");
  const email = singleLine(typeof v.email === "string" ? v.email : "");
  const mandantenRaw = singleLine(
    typeof v.mandantenZahl === "string"
      ? v.mandantenZahl
      : typeof v.mandantenZahl === "number" && Number.isFinite(v.mandantenZahl)
        ? String(v.mandantenZahl)
        : "",
  );
  const message =
    typeof v.message === "string" ? v.message.replace(/\u0000/g, "").trim() : "";

  if (name.length < 2) return { ok: false, error: "Bitte geben Sie Ihren Namen an." };
  if (name.length > 80) return { ok: false, error: "Der Name ist zu lang." };
  if (kanzlei.length < 2) {
    return { ok: false, error: "Bitte geben Sie den Namen der Kanzlei an." };
  }
  if (kanzlei.length > 120) return { ok: false, error: "Der Kanzleiname ist zu lang." };
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Bitte geben Sie eine gültige E-Mail-Adresse an." };
  }
  if (!/^[1-9]\d{0,5}$/.test(mandantenRaw) || Number(mandantenRaw) > 100000) {
    return {
      ok: false,
      error: "Bitte geben Sie eine grobe Mandanten-Zahl als ganze Zahl ab 1 an.",
    };
  }
  if (message.length < 10) {
    return { ok: false, error: "Bitte schreiben Sie eine kurze Nachricht." };
  }
  if (message.length > 4000) return { ok: false, error: "Die Nachricht ist zu lang." };

  return {
    ok: true,
    honeypot: false,
    inquiry: {
      name,
      kanzlei,
      email,
      mandantenZahl: String(Number(mandantenRaw)),
      message,
    },
  };
}
