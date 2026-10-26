import { createHash, timingSafeEqual } from "node:crypto";
import { magicLinkUrl } from "@/lib/auth";
import {
  ds24AccessStore,
  normalizeDs24Email,
  type Ds24AccessRecord,
  type Ds24AccessStore,
} from "@/lib/digistore24-access";
import { isProductionRuntime } from "@/lib/env";
import { CHECKOUT_NOTICE_TO } from "@/lib/checkout-notice";
import { formatBerlinDateTime } from "@/lib/delivery-templates";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import {
  ds24AccessMailKey,
  ds24NoticeMailKey,
  lookupMailDedupe,
  mailDedupeSendIsStubbed,
  sendDedupedEmail,
} from "@/lib/mail-dedupe";
import { escapeHtml } from "@/lib/mail-layout";
import { buildMagicLinkMail } from "@/lib/ops";

/**
 * Digistore24 IPN (Instant Payment Notification).
 *
 * Doku: https://dev.digistore24.com/hc/en-us/articles/32480561422353-Events
 * und https://dev.digistore24.com/hc/en-us/articles/32480217565969-Quick-Integration-Guide,
 * Referenzskript https://www.digistore24.com/download/ipn/examples/ipn/ipn_receiver.php
 *
 * Signatur `sha_sign`: alle Parameter außer `sha_sign`/`SHASIGN`, leere Werte
 * weggelassen, nach Namen sortiert, je `name=wert` + Passphrase aneinander
 * gehängt, SHA-512, hex in Großbuchstaben. Das Referenzskript sortiert die
 * Namen unverändert; die Doku nennt „not case sensitive“ (Variante mit
 * Namen in Großbuchstaben im selben Skript). Beide Varianten werden geprüft.
 * Antwort an Digistore24 ist immer der Text `OK`.
 */

export const DIGISTORE24_IPN_PRODUCT_IDS = ["751404", "751419"] as const;

/** Name der Vercel-Umgebungsvariable mit der IPN-Passphrase. */
export const DIGISTORE24_IPN_PASSPHRASE_ENV = "DIGISTORE24_IPN_PASSPHRASE";

const BLOCKING_EVENTS = new Set(["on_refund", "on_chargeback", "last_paid_day"]);
/** Diese Ereignisse sperren die Bestellung dauerhaft. */
const PERMANENT_BLOCK_EVENTS = new Set(["on_refund", "on_chargeback"]);

export type Ds24MailOutcome = "sent" | "duplicate" | "failed";

export type Ds24NoticeInput = {
  event: string;
  email: string;
  productId: string;
  orderId: string;
  paymentId: string;
  apiMode: string;
  at: number;
  /**
   * Gesetzt, wenn eine gültig signierte IPN ohne Mail oder Bestell-ID kam.
   * Dient als Dedupe-Referenz (payment/transaction id oder Hash der Parameter).
   */
  incompleteRef?: string;
};

export type Ds24IpnDeps = {
  passphrase: string;
  store: Ds24AccessStore;
  sendAccessMail: (email: string, orderId: string) => Promise<Ds24MailOutcome>;
  /** Interner Hinweis an den Inhaber. Fehler bleiben dort und ändern die Antwort nicht. */
  sendOwnerNotice: (input: Ds24NoticeInput) => Promise<void>;
  now: () => number;
};

export type Ds24IpnResult = { status: number; body: string };

export function readDs24IpnPassphrase(): string {
  return process.env[DIGISTORE24_IPN_PASSPHRASE_ENV]?.trim() ?? "";
}

/** Letzter Wert gewinnt, wie bei PHP `$_POST`. */
export function ds24ParamMap(entries: Iterable<[string, string]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of entries) map.set(key, value);
  return map;
}

function byteCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ds24Signature(
  passphrase: string,
  params: Map<string, string>,
  upperKeys = false,
): string {
  const keys = [...params.keys()]
    .filter((key) => key !== "sha_sign" && key !== "SHASIGN")
    .map((key) => ({ key, name: upperKeys ? key.toUpperCase() : key }))
    .sort((a, b) => byteCompare(a.name, b.name));
  let text = "";
  for (const { key, name } of keys) {
    const value = params.get(key) ?? "";
    if (value === "") continue;
    text += `${name}=${value}${passphrase}`;
  }
  return createHash("sha512").update(text, "utf8").digest("hex").toUpperCase();
}

function sameHex(received: string, expected: string): boolean {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyDs24Signature(passphrase: string, params: Map<string, string>): boolean {
  if (!passphrase) return false;
  const received = (params.get("sha_sign") ?? params.get("SHASIGN") ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]{128}$/.test(received)) return false;
  const plain = sameHex(received, ds24Signature(passphrase, params, false));
  const upper = sameHex(received, ds24Signature(passphrase, params, true));
  return plain || upper;
}

const OK: Ds24IpnResult = { status: 200, body: "OK" };

/** SHA-256 über die sortierten Parameter ohne Signatur, gekürzt. Nur als Dedupe-Referenz. */
export function ds24ParamsHash(params: Map<string, string>): string {
  const text = [...params.entries()]
    .filter(([key]) => key !== "sha_sign" && key !== "SHASIGN")
    .sort((a, b) => byteCompare(a[0], b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
}

function buyerEmail(params: Map<string, string>): string {
  return normalizeDs24Email(
    params.get("email") || params.get("address_email") || params.get("buyer_email"),
  );
}

export async function handleDs24Ipn(
  params: Map<string, string>,
  deps: Ds24IpnDeps,
): Promise<Ds24IpnResult> {
  if (!deps.passphrase) return { status: 503, body: "" };
  if (!verifyDs24Signature(deps.passphrase, params)) return { status: 403, body: "" };

  const event = (params.get("event") ?? "").trim();
  if (event === "connection_test") return OK;

  const productId = (params.get("product_id") ?? "").trim();
  if (!(DIGISTORE24_IPN_PRODUCT_IDS as readonly string[]).includes(productId)) {
    return OK;
  }

  const isPayment = event === "on_payment";
  if (!isPayment && !BLOCKING_EVENTS.has(event)) {
    // on_payment_missed, on_rebill_cancelled, on_rebill_resumed usw.:
    // Zugang bleibt bis last_paid_day bzw. bis zur nächsten Zahlung unverändert.
    return OK;
  }

  const orderId = (params.get("order_id") ?? "").trim();
  const email = buyerEmail(params);
  const paymentId = (params.get("payment_id") || params.get("transaction_id") || "").trim();
  if (!orderId || !email) {
    console.warn("[ds24] IPN ohne Bestell-ID oder Mail", { event });
    await deps.sendOwnerNotice({
      event,
      email,
      productId,
      orderId,
      paymentId,
      apiMode: (params.get("api_mode") ?? "").trim(),
      at: deps.now(),
      incompleteRef: paymentId || ds24ParamsHash(params),
    });
    return OK;
  }
  const at = new Date(deps.now()).toISOString();

  const record: Ds24AccessRecord = (await deps.store.read(email)) ?? { email, orders: {} };
  const previous = record.orders[orderId];
  const notice: Ds24NoticeInput = {
    event,
    email,
    productId,
    orderId,
    paymentId,
    apiMode: (params.get("api_mode") ?? "").trim(),
    at: deps.now(),
  };

  if (isPayment) {
    // Nach Erstattung/Rückbuchung bleibt die Bestellung dauerhaft gesperrt, egal
    // mit welcher (oder ohne) payment_id. Eine verspätete Wiederholung derselben
    // Zahlung hebt auch eine last_paid_day-Sperre nicht auf.
    const staleRetry =
      Boolean(previous?.permanentBlock) ||
      (previous?.status === "blocked" && Boolean(paymentId) && previous.paymentId === paymentId);
    if (!staleRetry && previous?.status !== "active") {
      record.orders[orderId] = {
        productId,
        status: "active",
        event,
        paymentId,
        createdAt: previous?.createdAt || at,
        updatedAt: at,
      };
      await deps.store.write(record);
    } else if (previous?.status === "active" && paymentId && previous.paymentId !== paymentId) {
      record.orders[orderId] = { ...previous, event, paymentId, updatedAt: at };
      await deps.store.write(record);
    }
    await deps.sendOwnerNotice(notice);
    if (staleRetry) return OK;
    const mail = await deps.sendAccessMail(email, orderId);
    if (mail === "failed") {
      console.error("[ds24] Anmeldelink nicht gesendet", { event });
      return { status: 500, body: "ERROR" };
    }
    return OK;
  }

  const permanent = PERMANENT_BLOCK_EVENTS.has(event) ? (event as "on_refund" | "on_chargeback") : undefined;
  if (previous?.status !== "blocked" || (permanent && !previous.permanentBlock)) {
    const permanentBlock = previous?.permanentBlock || permanent;
    record.orders[orderId] = {
      productId,
      status: "blocked",
      event,
      paymentId: previous?.paymentId || paymentId,
      ...(permanentBlock ? { permanentBlock } : {}),
      createdAt: previous?.createdAt || at,
      updatedAt: at,
    };
    await deps.store.write(record);
  }
  await deps.sendOwnerNotice(notice);
  return OK;
}

/** Checks und Prebuild senden nur, wenn der Versand gestubbt ist. */
function liveSendRefused(): boolean {
  return automatedRunForbidsLiveWrites() && !mailDedupeSendIsStubbed();
}

const NOTICE_LABELS: Record<string, string> = {
  on_payment: "Zahlung",
  on_refund: "Erstattung",
  on_chargeback: "Rückbuchung",
  last_paid_day: "Abo-Ende",
};

export function buildDs24NoticeMail(input: Ds24NoticeInput): {
  subject: string;
  text: string;
  html: string;
} {
  const label = NOTICE_LABELS[input.event] ?? input.event;
  const incomplete = input.incompleteRef !== undefined;
  const lines: [string, string][] = [
    ["Ereignis", `${label} (${input.event})`],
    ...(incomplete
      ? ([["Achtung", "IPN ohne Mail oder Bestell-ID, kein Zugang angelegt oder gesperrt"]] as [string, string][])
      : []),
    ["E-Mail", input.email || "—"],
    ["Produkt", input.productId],
    ["Bestell-ID", input.orderId || "—"],
    ["Zahlungs-ID", input.paymentId || "—"],
    ["Modus", input.apiMode || "—"],
    ["Zeit (Europe/Berlin)", formatBerlinDateTime(new Date(input.at))],
  ];
  const test = input.apiMode === "test" ? " [Test]" : "";
  return {
    subject: `Digistore24: ${label}${test}${incomplete ? " unvollständig" : ""} — ${input.orderId || "ohne Bestell-ID"}`.replace(/[\r\n]+/g, " ").slice(0, 180),
    text: ["Digistore24-Ereignis", "", ...lines.map(([k, v]) => `${k}: ${v}`)].join("\n"),
    html: `<p>Digistore24-Ereignis</p><p>${lines
      .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`)
      .join("<br />")}</p>`,
  };
}

/**
 * Interner Hinweis an denselben Empfänger wie der Stripe-Kaufhinweis
 * (CHECKOUT_NOTICE_TO). Einmal pro Bestellung, Ereignis und Zahlung.
 * Wirft nicht.
 */
export async function notifyDs24Event(input: Ds24NoticeInput): Promise<void> {
  if (liveSendRefused()) return;
  try {
    const mail = buildDs24NoticeMail(input);
    await sendDedupedEmail({
      dedupeKey:
        input.incompleteRef !== undefined
          ? ds24NoticeMailKey(`incomplete-${input.incompleteRef}`, input.event)
          : ds24NoticeMailKey(input.orderId, input.event, input.paymentId),
      to: CHECKOUT_NOTICE_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    console.error("[ds24] Inhaber-Hinweis nicht gesendet", error instanceof Error ? error.name : "error");
  }
}

/**
 * Anmeldelink wie bei /login (gleiche Vorlage, gleicher Token), genau einmal
 * pro Bestellung. Der Dedupe-Eintrag `ds24-access:<order_id>` läuft nicht ab.
 */
export async function sendDs24AccessMail(email: string, orderId: string): Promise<Ds24MailOutcome> {
  if (liveSendRefused()) return "sent";
  const key = ds24AccessMailKey(orderId);
  if ((await lookupMailDedupe(key)) === "sent") return "duplicate";
  const url = await magicLinkUrl(email, "/account");
  if (!url) return "failed";
  const mail = buildMagicLinkMail({ magicLinkUrl: url });
  const result = await sendDedupedEmail({
    dedupeKey: key,
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  // Ein laufender Versand derselben Bestellung: Digistore24 soll später wiederholen.
  if (result.duplicate) return result.inflight ? "failed" : "duplicate";
  if (result.sent) return "sent";
  if (result.stub && !isProductionRuntime()) return "sent";
  return "failed";
}

export function defaultDs24IpnDeps(): Ds24IpnDeps {
  return {
    passphrase: readDs24IpnPassphrase(),
    store: ds24AccessStore(),
    sendAccessMail: sendDs24AccessMail,
    sendOwnerNotice: notifyDs24Event,
    now: () => Date.now(),
  };
}
