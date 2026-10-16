import {
  buildCancellationConfirmMail,
  buildCancellationEndedMail,
  buildCancellationReactivatedMail,
  CANCELLATION_MAIL_FROM,
} from "@/lib/kuendigung-mail";
import {
  confirmIdempotencyKey,
  endedIdempotencyKey,
  markMailDelivered,
  nextLifecycle,
  reactivatedIdempotencyKey,
  type LifecycleEvent,
  type LifecycleRow,
  type MailKind,
} from "@/lib/kuendigung";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import type { MailResult } from "@/lib/mail";
import { findLifecycleBySubscription, saveLifecycleRow } from "@/lib/kuendigung-store";

export type ApplyResult = {
  row: LifecycleRow;
  mail: MailKind | null;
  mailResult: MailResult | null;
};

function mailFor(kind: MailKind, row: LifecycleRow, eventId: string): {
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
} {
  if (kind === "confirm") {
    const mail = buildCancellationConfirmMail(row);
    return { ...mail, idempotencyKey: confirmIdempotencyKey(row) };
  }
  if (kind === "ended") {
    const mail = buildCancellationEndedMail(row);
    return { ...mail, idempotencyKey: endedIdempotencyKey(row) };
  }
  const mail = buildCancellationReactivatedMail();
  return { ...mail, idempotencyKey: reactivatedIdempotencyKey(row, eventId) };
}

async function deliver(
  row: LifecycleRow,
  kind: MailKind,
  eventId: string,
): Promise<MailResult> {
  if (!row.email) return { stub: true, sent: false };
  const content = mailFor(kind, row, eventId);
  const result = await sendDedupedEmail({
    dedupeKey: content.idempotencyKey,
    to: row.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    from: CANCELLATION_MAIL_FROM,
  });
  if (result.duplicate && !result.inflight) return { ...result, sent: true };
  return result;
}

export async function applyLifecycleEvent(
  event: LifecycleEvent,
  options?: { suppressCustomerMail?: boolean },
): Promise<ApplyResult> {
  const previous = await findLifecycleBySubscription(event.subscriptionId);
  const next = nextLifecycle(previous, event);
  let row = next.row;
  let mailResult: MailResult | null = null;
  if (next.mail && !options?.suppressCustomerMail) {
    mailResult = await deliver(row, next.mail, event.id);
    if (mailResult.sent || mailResult.stub) {
      row = markMailDelivered(row, event.id, next.mail, event.at);
    }
  }
  await saveLifecycleRow(row);
  return { row, mail: next.mail, mailResult };
}
