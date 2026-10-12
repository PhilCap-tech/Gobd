/**
 * Kündigung zum Periodenende, 30 Tage Download und Wiederherstellung, dann Löschung.
 * Die Frist folgt AGB § 12 Abs. 4. Rechtstexte werden hier nicht verändert.
 * Reine Funktionen: kein Stripe, kein Sheet, kein Versand.
 */

export const RETENTION_DAYS = 30;
export const REMINDER_LEAD_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_WINDOW_MS = RETENTION_DAYS * DAY_MS;
export const REMINDER_LEAD_MS = REMINDER_LEAD_DAYS * DAY_MS;

export const CANCELLATION_MAIL_FROM =
  "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";

/** Testläufe dürfen nur an diese Domain senden. Subdomains zählen nicht. */
export const SYNTHETIC_INBOX_DOMAIN = "example.com";

export type LifecyclePhase = "active" | "cancel_scheduled" | "restore" | "purged";

export type EndReason = "" | "customer_cancel" | "payment_failed" | "refund" | "other";

export type LifecycleRow = {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  phase: LifecyclePhase;
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
  endedAt: string;
  restoreUntil: string;
  purgeAt: string;
  endReason: EndReason;
  confirmMailAt: string;
  reminderMailAt: string;
  reactivatedAt: string;
  lastEventId: string;
  updatedAt: string;
};

export type MailKind = "confirm" | "reactivated" | "ended";

export type LifecycleEvent = {
  id: string;
  at: string;
  email: string;
  customerId: string;
  subscriptionId: string;
  periodEnd: string;
} & (
  | { type: "checkout_completed" }
  | {
      type: "subscription_updated";
      status: string;
      cancelAtPeriodEnd: boolean;
      cancellationReason: string;
    }
  | {
      type: "subscription_deleted";
      endedAt: string;
      cancellationReason: string;
    }
);

export function isSyntheticInbox(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return false;
  return normalized.slice(at + 1) === SYNTHETIC_INBOX_DOMAIN;
}

/**
 * `syntheticOnly` gilt für Testläufe. Produktiv darf die Kundenadresse
 * jede echte Mailbox sein. Die Sperre trifft nur den Testmodus.
 */
export function cancellationSendAllowed(email: string, syntheticOnly: boolean): boolean {
  if (!email.trim()) return false;
  if (!syntheticOnly) return true;
  return isSyntheticInbox(email);
}

export function formatBerlinDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function cancellationStatusLabel(periodEndIso: string): string {
  const date = formatBerlinDate(periodEndIso);
  return date ? `gekündigt zum ${date}` : "gekündigt zum Periodenende";
}

export function addMs(iso: string, ms: number): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Date(time + ms).toISOString();
}

export function emptyLifecycleRow(input: {
  email: string;
  customerId?: string;
  subscriptionId?: string;
  updatedAt: string;
}): LifecycleRow {
  return {
    email: input.email.trim().toLowerCase(),
    stripeCustomerId: input.customerId?.trim() ?? "",
    stripeSubscriptionId: input.subscriptionId?.trim() ?? "",
    phase: "active",
    cancelAtPeriodEnd: false,
    periodEnd: "",
    endedAt: "",
    restoreUntil: "",
    purgeAt: "",
    endReason: "",
    confirmMailAt: "",
    reminderMailAt: "",
    reactivatedAt: "",
    lastEventId: "",
    updatedAt: input.updatedAt,
  };
}

export function endReasonFrom(input: {
  cancellationReason: string;
  previousPhase: LifecyclePhase | null;
}): EndReason {
  const reason = input.cancellationReason.trim().toLowerCase();
  if (reason === "payment_failed" || reason === "payment_disputed") {
    return "payment_failed";
  }
  if (reason.includes("refund")) return "refund";
  if (reason === "cancellation_requested") return "customer_cancel";
  if (input.previousPhase === "cancel_scheduled") return "customer_cancel";
  return "other";
}

function pendingId(eventId: string): string {
  return `pending:${eventId}`;
}

export function isPendingEvent(lastEventId: string, eventId: string): boolean {
  return lastEventId === pendingId(eventId);
}

function withEvent(
  row: LifecycleRow,
  event: LifecycleEvent,
  mail: MailKind | null,
): LifecycleRow {
  return {
    ...row,
    email: event.email.trim().toLowerCase() || row.email,
    stripeCustomerId: event.customerId.trim() || row.stripeCustomerId,
    stripeSubscriptionId: event.subscriptionId.trim() || row.stripeSubscriptionId,
    lastEventId: mail ? pendingId(event.id) : event.id,
    updatedAt: event.at,
  };
}

function mailOnReplay(row: LifecycleRow, event: LifecycleEvent): MailKind | null {
  if (!isPendingEvent(row.lastEventId, event.id)) return null;
  if (row.phase === "cancel_scheduled" && !row.confirmMailAt) return "confirm";
  if (row.phase === "restore" && !row.confirmMailAt) return "ended";
  if (row.phase === "active" && !row.cancelAtPeriodEnd && !row.reactivatedAt) {
    return "reactivated";
  }
  return null;
}

function applyDeleted(
  previous: LifecycleRow | null,
  event: Extract<LifecycleEvent, { type: "subscription_deleted" }>,
): { row: LifecycleRow; mail: MailKind | null } {
  const base =
    previous ??
    emptyLifecycleRow({
      email: event.email,
      customerId: event.customerId,
      subscriptionId: event.subscriptionId,
      updatedAt: event.at,
    });
  const endedAt = event.endedAt || event.at;
  const restoreUntil = addMs(endedAt, RETENTION_WINDOW_MS);
  const alreadyTold = Boolean(base.confirmMailAt) && base.phase === "cancel_scheduled";
  const alreadyRestoring = base.phase === "restore" && Boolean(base.endedAt);
  const mail: MailKind | null = alreadyTold || alreadyRestoring ? null : "ended";
  const row = withEvent(
    {
      ...base,
      phase: "restore",
      cancelAtPeriodEnd: false,
      endedAt: base.endedAt || endedAt,
      restoreUntil: base.restoreUntil || restoreUntil,
      purgeAt: base.purgeAt || restoreUntil,
      endReason: endReasonFrom({
        cancellationReason: event.cancellationReason,
        previousPhase: base.phase,
      }),
      periodEnd: base.periodEnd || event.periodEnd || endedAt,
    },
    event,
    mail,
  );
  return { row, mail };
}

/**
 * Phasenwechsel aus einem Stripe-Ereignis.
 * Dieselbe `event.id` ist ein No-Op, außer eine fällige Mail ist noch nicht
 * als zugestellt markiert (`pending:` in `lastEventId`).
 */
export function nextLifecycle(
  previous: LifecycleRow | null,
  event: LifecycleEvent,
): { row: LifecycleRow; mail: MailKind | null } {
  if (previous && previous.lastEventId === event.id) {
    return { row: previous, mail: null };
  }
  if (previous && isPendingEvent(previous.lastEventId, event.id)) {
    return { row: previous, mail: mailOnReplay(previous, event) };
  }

  if (event.type === "subscription_updated" && event.status === "canceled") {
    return applyDeleted(previous, {
      ...event,
      type: "subscription_deleted",
      endedAt: event.at,
    });
  }

  if (event.type === "subscription_deleted") {
    return applyDeleted(previous, event);
  }

  const base =
    previous ??
    emptyLifecycleRow({
      email: event.email,
      customerId: event.customerId,
      subscriptionId: event.subscriptionId,
      updatedAt: event.at,
    });

  if (event.type === "checkout_completed") {
    const row = withEvent(
      {
        ...base,
        phase: "active",
        cancelAtPeriodEnd: false,
        periodEnd: event.periodEnd || base.periodEnd,
        endedAt: "",
        restoreUntil: "",
        purgeAt: "",
        endReason: "",
        reminderMailAt: "",
      },
      event,
      null,
    );
    return { row, mail: null };
  }

  const cancelNow = event.cancelAtPeriodEnd;
  const wasScheduled = base.phase === "cancel_scheduled" || base.cancelAtPeriodEnd;
  if (cancelNow) {
    const mail: MailKind | null = base.confirmMailAt && wasScheduled ? null : "confirm";
    const row = withEvent(
      {
        ...base,
        phase: "cancel_scheduled",
        cancelAtPeriodEnd: true,
        periodEnd: event.periodEnd || base.periodEnd,
        endReason: base.endReason || "customer_cancel",
        endedAt: "",
        restoreUntil: "",
        purgeAt: "",
      },
      event,
      mail,
    );
    return { row, mail };
  }

  if (wasScheduled && base.phase === "cancel_scheduled") {
    const row = withEvent(
      {
        ...base,
        phase: "active",
        cancelAtPeriodEnd: false,
        periodEnd: event.periodEnd || base.periodEnd,
        endReason: "",
        endedAt: "",
        restoreUntil: "",
        purgeAt: "",
        reactivatedAt: "",
      },
      event,
      "reactivated",
    );
    return { row, mail: "reactivated" };
  }

  const row = withEvent(
    {
      ...base,
      phase: base.phase === "restore" || base.phase === "purged" ? base.phase : "active",
      cancelAtPeriodEnd: false,
      periodEnd: event.periodEnd || base.periodEnd,
    },
    event,
    null,
  );
  return { row, mail: null };
}

export function markMailDelivered(
  row: LifecycleRow,
  eventId: string,
  mail: MailKind,
  at: string,
): LifecycleRow {
  return {
    ...row,
    lastEventId: eventId,
    updatedAt: at,
    confirmMailAt: mail === "confirm" || mail === "ended" ? at : row.confirmMailAt,
    reactivatedAt: mail === "reactivated" ? at : row.reactivatedAt,
    reminderMailAt: row.reminderMailAt,
  };
}

export type JobAction =
  | { type: "remind"; row: LifecycleRow }
  | { type: "purge"; row: LifecycleRow; deleteContractData: boolean };

export function planLifecycleJob(rows: LifecycleRow[], nowMs: number): JobAction[] {
  const actions: JobAction[] = [];
  for (const row of rows) {
    if (row.phase !== "restore" || !row.purgeAt) continue;
    const purgeMs = Date.parse(row.purgeAt);
    if (!Number.isFinite(purgeMs)) continue;
    const alive = rows.some(
      (other) =>
        other.email === row.email &&
        other.stripeSubscriptionId !== row.stripeSubscriptionId &&
        (other.phase === "active" || other.phase === "cancel_scheduled"),
    );
    if (nowMs >= purgeMs) {
      if (!row.reminderMailAt) {
        actions.push({ type: "remind", row });
      } else {
        actions.push({ type: "purge", row, deleteContractData: !alive });
      }
      continue;
    }
    if (!row.reminderMailAt && nowMs >= purgeMs - REMINDER_LEAD_MS) {
      actions.push({ type: "remind", row });
    }
  }
  return actions;
}

export function selectAccountLifecycle(rows: LifecycleRow[]): LifecycleRow | null {
  const open = rows.filter((row) => row.phase !== "purged");
  const active = open.filter((row) => row.phase === "active" && !row.cancelAtPeriodEnd);
  if (active.length > 0) {
    return [...active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }
  const scheduled = open.filter((row) => row.phase === "cancel_scheduled");
  if (scheduled.length > 0) {
    return [...scheduled].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))[0] ?? null;
  }
  const restore = open.filter((row) => row.phase === "restore");
  if (restore.length > 0) {
    return [...restore].sort((a, b) => b.restoreUntil.localeCompare(a.restoreUntil))[0] ?? null;
  }
  return null;
}

export type LifecycleAccess = {
  writesOpen: boolean;
  downloadsOpen: boolean;
  writeMessage: string;
  downloadMessage: string;
};

export function accessForRows(rows: LifecycleRow[]): LifecycleAccess {
  const selected = selectAccountLifecycle(rows);
  if (!selected) {
    const purged = rows.some((row) => row.phase === "purged");
    return {
      writesOpen: true,
      downloadsOpen: !purged,
      writeMessage: "",
      downloadMessage: purged
        ? "Die Aufbewahrungsfrist nach dem Vertragsende ist abgelaufen. Die Dokumente wurden gelöscht."
        : "",
    };
  }
  if (selected.phase === "restore") {
    const until = formatBerlinDate(selected.restoreUntil || selected.purgeAt);
    return {
      writesOpen: false,
      downloadsOpen: true,
      writeMessage: until
        ? `Online-Pflege und neue Versionen sind mit dem Vertragsende entfallen. Bereits erzeugte PDFs können Sie noch bis zum ${until} herunterladen.`
        : "Online-Pflege und neue Versionen sind mit dem Vertragsende entfallen. Bereits erzeugte PDFs können Sie noch herunterladen.",
      downloadMessage: "",
    };
  }
  return {
    writesOpen: true,
    downloadsOpen: true,
    writeMessage: "",
    downloadMessage: "",
  };
}

export type LifecycleNotice = {
  phase: LifecyclePhase | "none";
  label: string;
  detail: string;
  writesOpen: boolean;
  downloadsOpen: boolean;
  showCancel: boolean;
  showRestoreCheckout: boolean;
};

export function lifecycleNotice(rows: LifecycleRow[]): LifecycleNotice {
  const access = accessForRows(rows);
  const selected = selectAccountLifecycle(rows);
  if (!selected) {
    const purged = rows.some((row) => row.phase === "purged");
    return {
      phase: purged ? "purged" : "none",
      label: "",
      detail: purged
        ? "Ihre bisherigen Entwürfe und Dokumente wurden nach der Frist von 30 Tagen gelöscht. Ein neues Abonnement beginnt ohne diese Daten."
        : "",
      writesOpen: access.writesOpen,
      downloadsOpen: access.downloadsOpen,
      showCancel: false,
      showRestoreCheckout: purged,
    };
  }
  if (selected.phase === "cancel_scheduled") {
    const label = cancellationStatusLabel(selected.periodEnd);
    return {
      phase: "cancel_scheduled",
      label,
      detail:
        "Pflege und neue Versionen enden an diesem Datum. Bis dahin bleiben Download und weitere Versionen verfügbar. Danach können Sie bereits erzeugte PDFs noch 30 Tage herunterladen oder das Abonnement wiederherstellen.",
      writesOpen: true,
      downloadsOpen: true,
      showCancel: true,
      showRestoreCheckout: false,
    };
  }
  if (selected.phase === "restore") {
    const ended = formatBerlinDate(selected.endedAt || selected.periodEnd);
    const until = formatBerlinDate(selected.restoreUntil || selected.purgeAt);
    return {
      phase: "restore",
      label: ended ? `Abo beendet am ${ended}` : "Abo beendet",
      detail: until
        ? `Download und Wiederherstellung bis ${until}. Online-Pflege und neue Versionen sind entfallen.`
        : "Download und Wiederherstellung sind noch möglich. Online-Pflege und neue Versionen sind entfallen.",
      writesOpen: false,
      downloadsOpen: true,
      showCancel: false,
      showRestoreCheckout: true,
    };
  }
  return {
    phase: "active",
    label: "",
    detail: "",
    writesOpen: true,
    downloadsOpen: true,
    showCancel: true,
    showRestoreCheckout: false,
  };
}

/** Pfade, die eine Vertragslöschung nicht anfassen darf. */
export function contractPurgeAllowsPath(pathname: string): boolean {
  const path = pathname.replace(/^\/+/, "");
  if (!path.startsWith("gobd/") || path.includes("..") || path.includes("\\")) return false;
  if (path === "gobd/uploads/anon" || path.startsWith("gobd/uploads/anon/")) return false;
  if (path.includes("/readiness-") || path.startsWith("gobd/readiness-")) return false;
  return true;
}

export function reminderIdempotencyKey(row: LifecycleRow): string {
  return `erinnerung-${row.stripeSubscriptionId}-${row.purgeAt}`;
}

export function confirmIdempotencyKey(row: LifecycleRow): string {
  return `kuendigung-${row.stripeSubscriptionId}-${row.periodEnd}`;
}

export function endedIdempotencyKey(row: LifecycleRow): string {
  return `beendet-${row.stripeSubscriptionId}-${row.endedAt}`;
}

export function reactivatedIdempotencyKey(row: LifecycleRow, eventId: string): string {
  return `reaktivierung-${row.stripeSubscriptionId}-${eventId}`;
}

/**
 * Periodenende aus der Subscription.
 * In Stripe-API-Versionen mit Basil liegt `current_period_end` am Item,
 * nicht mehr am Abo. `cancel_at` ist der Ersatz, sobald die Kündigung steht.
 */
export function subscriptionPeriodEndUnix(subscription: {
  cancel_at?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> | null } | null;
}): number {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number" && itemEnd > 0) return itemEnd;
  if (typeof subscription.cancel_at === "number" && subscription.cancel_at > 0) {
    return subscription.cancel_at;
  }
  return 0;
}

export function unixToIso(unix: number): string {
  if (!unix) return "";
  return new Date(unix * 1000).toISOString();
}
