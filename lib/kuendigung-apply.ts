import {
  buildCancellationConfirmMail,
  buildCancellationEndedMail,
  buildCancellationReactivatedMail,
  buildCancellationReminderMail,
  CANCELLATION_MAIL_FROM,
} from "@/lib/kuendigung-mail";
import {
  confirmIdempotencyKey,
  endedIdempotencyKey,
  guardLifecycleActions,
  jobEffects,
  LIFECYCLE_JOB_DRY_RUN,
  lifecycleActionLog,
  markMailDelivered,
  nextLifecycle,
  planLifecycleJob,
  reactivatedIdempotencyKey,
  reminderIdempotencyKey,
  type JobAction,
  type LifecycleEvent,
  type LifecycleRow,
  type MailKind,
} from "@/lib/kuendigung";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import type { MailResult } from "@/lib/mail";
import {
  findLifecycleBySubscription,
  listLifecycleRows,
  saveLifecycleRow,
} from "@/lib/kuendigung-store";
import { purgeContractData } from "@/lib/kuendigung-purge";

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

export async function applyLifecycleEvent(event: LifecycleEvent): Promise<ApplyResult> {
  const previous = await findLifecycleBySubscription(event.subscriptionId);
  const next = nextLifecycle(previous, event);
  let row = next.row;
  let mailResult: MailResult | null = null;
  if (next.mail) {
    mailResult = await deliver(row, next.mail, event.id);
    if (mailResult.sent || mailResult.stub) {
      row = markMailDelivered(row, event.id, next.mail, event.at);
    }
  }
  await saveLifecycleRow(row);
  return { row, mail: next.mail, mailResult };
}

export async function remindLifecycleRow(row: LifecycleRow, at: string): Promise<LifecycleRow> {
  if (!row.email) return row;
  const content = buildCancellationReminderMail(row);
  const contentSent = await sendDedupedEmail({
    dedupeKey: reminderIdempotencyKey(row),
    to: row.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    from: CANCELLATION_MAIL_FROM,
  });
  const mailed =
    contentSent.duplicate && !contentSent.inflight
      ? { ...contentSent, sent: true }
      : contentSent;
  if (!mailed.sent && !mailed.stub) return row;
  const saved = { ...row, reminderMailAt: at, updatedAt: at };
  await saveLifecycleRow(saved);
  return saved;
}

export async function runLifecycleJob(
  now = new Date(),
  options?: { dryRun?: boolean },
): Promise<{
  dryRun: boolean;
  reminded: number;
  purged: number;
  planned: number;
}> {
  const dryRun = options?.dryRun ?? LIFECYCLE_JOB_DRY_RUN;
  const rows = await listLifecycleRows();
  const nowMs = now.getTime();
  const guarded = guardLifecycleActions(planLifecycleJob(rows, nowMs), rows, nowMs);
  for (const action of guarded.actions) {
    console.info("[kuendigung] Lauf", lifecycleActionLog(action, dryRun));
  }
  if (guarded.skippedComp > 0 || guarded.skippedProtected > 0) {
    console.info("[kuendigung] Lauf ausgelassen", {
      skippedComp: guarded.skippedComp,
      skippedProtected: guarded.skippedProtected,
      dryRun,
    });
  }
  const actions = jobEffects(guarded.actions, dryRun);
  let reminded = 0;
  let purged = 0;
  for (const action of actions) {
    if (action.type === "remind") {
      const saved = await remindLifecycleRow(action.row, now.toISOString());
      if (saved.reminderMailAt) reminded += 1;
      continue;
    }
    await purgeLifecycleAction(action, now.toISOString());
    console.info("[kuendigung] Löschung", lifecycleActionLog(action, false));
    purged += 1;
  }
  return { dryRun, reminded, purged, planned: guarded.actions.length };
}

async function purgeLifecycleAction(action: Extract<JobAction, { type: "purge" }>, at: string) {
  if (action.deleteContractData) {
    await purgeContractData(action.row.email);
  }
  await saveLifecycleRow({
    ...action.row,
    phase: "purged",
    updatedAt: at,
  });
}
