/**
 * Kündigung: Phasen, 30 Tage Download/Wiederherstellung, Erinnerung 7 Tage
 * vorher, ZIP, Mails an synthetische Postfächer. Kein Versand.
 */
import { readFileSync } from "node:fs";
import {
  CANCELLATION_MAIL_FROM,
  DAY_MS,
  REMINDER_LEAD_DAYS,
  RETENTION_DAYS,
  RETENTION_WINDOW_MS,
  accessForRows,
  cancellationSendAllowed,
  cancellationStatusLabel,
  contractPurgeAllowsPath,
  emptyLifecycleRow,
  formatBerlinDate,
  isSyntheticInbox,
  lifecycleNotice,
  nextLifecycle,
  planLifecycleJob,
  subscriptionPeriodEndUnix,
  type LifecycleEvent,
  type LifecycleRow,
} from "@/lib/kuendigung";
import {
  buildCancellationConfirmMail,
  buildCancellationEndedMail,
  buildCancellationReactivatedMail,
  buildCancellationReminderMail,
} from "@/lib/kuendigung-mail";
import { lifecycleRowFromSheet, lifecycleSheetValues, LIFECYCLE_SHEET_COLUMNS } from "@/lib/kuendigung-store";
import { withoutEmailRows } from "@/lib/kuendigung-purge";
import { buildStoredZip, collectUploadLocators, zipEntryName } from "@/lib/kuendigung-zip";

const SIGNATURE = "Ihr Team von GoBD Verfahrensdoku";
const BLOCKED = "philip.cappelletti@sdc-ventures.com";
const SYNTHETIC = "kunde.kuendigung@example.com";

function fail(message: string): never {
  console.error(`check-kuendigung: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function row(partial: Partial<LifecycleRow> & Pick<LifecycleRow, "email" | "stripeSubscriptionId">): LifecycleRow {
  return {
    ...emptyLifecycleRow({
      email: partial.email,
      customerId: partial.stripeCustomerId,
      subscriptionId: partial.stripeSubscriptionId,
      updatedAt: partial.updatedAt || "2026-10-01T10:00:00.000Z",
    }),
    ...partial,
  };
}

function updated(input: {
  id: string;
  at: string;
  cancel: boolean;
  status?: string;
  periodEnd?: string;
  reason?: string;
}): LifecycleEvent {
  return {
    id: input.id,
    type: "subscription_updated",
    at: input.at,
    email: SYNTHETIC,
    customerId: "cus_test",
    subscriptionId: "sub_test",
    periodEnd: input.periodEnd || "2026-11-12T10:00:00.000Z",
    status: input.status || "active",
    cancelAtPeriodEnd: input.cancel,
    cancellationReason: input.reason || "",
  };
}

const periodEnd = "2026-11-12T10:00:00.000Z";
assert(formatBerlinDate(periodEnd) === "12.11.2026", "Berlin-Datum");
assert(
  cancellationStatusLabel(periodEnd) === "gekündigt zum 12.11.2026",
  "Statuszeile gekündigt zum Datum",
);
assert(RETENTION_DAYS === 30, "30 Tage");
assert(REMINDER_LEAD_DAYS === 7, "7 Tage Erinnerung");
assert(RETENTION_WINDOW_MS === 30 * DAY_MS, "Fenster in Millisekunden");

assert(isSyntheticInbox(SYNTHETIC), "synthetisches Postfach");
assert(!isSyntheticInbox("kunde@example.com.evil"), "keine täuschende Domain");
assert(!isSyntheticInbox(BLOCKED), "Owner-Adresse ist kein Testpostfach");
assert(cancellationSendAllowed(SYNTHETIC, true), "Testversand an example.com");
assert(!cancellationSendAllowed(BLOCKED, true), "Testversand an Owner gesperrt");
assert(cancellationSendAllowed(SYNTHETIC, false) === true, "produktiv bleibt die Kundenadresse erlaubt");

const active = row({
  email: SYNTHETIC,
  stripeSubscriptionId: "sub_test",
  stripeCustomerId: "cus_test",
  phase: "active",
});

const scheduled = nextLifecycle(active, updated({ id: "evt_cancel", at: "2026-10-12T10:00:00.000Z", cancel: true }));
assert(scheduled.mail === "confirm", "Bestätigung bei Kündigung");
assert(scheduled.row.phase === "cancel_scheduled", "Phase cancel_scheduled");
assert(scheduled.row.periodEnd === periodEnd, "Periodenende");
assert(lifecycleNotice([scheduled.row]).label === "gekündigt zum 12.11.2026", "Konto-Status");

const replay = nextLifecycle(scheduled.row, updated({ id: "evt_cancel", at: "2026-10-12T10:00:00.000Z", cancel: true }));
assert(replay.mail === "confirm", "ausstehende Bestätigung wird wiederholt");
const delivered = { ...scheduled.row, confirmMailAt: "2026-10-12T10:00:01.000Z", lastEventId: "evt_cancel" };
const again = nextLifecycle(delivered, updated({ id: "evt_cancel_2", at: "2026-10-12T11:00:00.000Z", cancel: true }));
assert(again.mail === null, "keine zweite Bestätigung");
const due = nextLifecycle(
  active,
  updated({ id: "evt_due", at: "2026-10-14T10:00:00.000Z", cancel: false, status: "past_due" }),
);
assert(due.mail === null && due.row.phase === "active", "Zahlungsrückstand startet keine Frist");

const reactivated = nextLifecycle(
  delivered,
  updated({ id: "evt_back", at: "2026-10-13T10:00:00.000Z", cancel: false }),
);
assert(reactivated.mail === "reactivated", "Mail bei Rücknahme");
assert(reactivated.row.phase === "active", "wieder aktiv");
assert(reactivated.row.purgeAt === "", "keine Löschfrist nach Rücknahme");

const endedAt = "2026-11-12T10:00:00.000Z";
const deleted = nextLifecycle(delivered, {
  id: "evt_del",
  type: "subscription_deleted",
  at: endedAt,
  email: SYNTHETIC,
  customerId: "cus_test",
  subscriptionId: "sub_test",
  periodEnd,
  endedAt,
  cancellationReason: "cancellation_requested",
});
assert(deleted.mail === null, "keine zweite Endmail nach Bestätigung");
assert(deleted.row.phase === "restore", "Phase nach Vertragsende");
assert(Date.parse(deleted.row.purgeAt) - Date.parse(endedAt) === RETENTION_WINDOW_MS, "Löschung nach 30 Tagen");
assert(accessForRows([deleted.row]).downloadsOpen, "Download in den 30 Tagen");
assert(!accessForRows([deleted.row]).writesOpen, "keine neuen Versionen nach Vertragsende");
assert(lifecycleNotice([deleted.row]).detail.includes("Download und Wiederherstellung"), "Hinweis Download und Wiederherstellung");

const immediate = nextLifecycle(active, {
  id: "evt_now",
  type: "subscription_deleted",
  at: endedAt,
  email: SYNTHETIC,
  customerId: "cus_test",
  subscriptionId: "sub_test",
  periodEnd,
  endedAt,
  cancellationReason: "payment_failed",
});
assert(immediate.mail === "ended", "Endmail ohne vorherige Bestätigung");
assert(immediate.row.endReason === "payment_failed", "Grund Zahlung");

const purgeAt = Date.parse(deleted.row.purgeAt);
const beforeReminder = planLifecycleJob([deleted.row], purgeAt - 7 * DAY_MS - 1);
assert(beforeReminder.length === 0, "keine Erinnerung vor Tag 23");
const reminder = planLifecycleJob([deleted.row], purgeAt - 7 * DAY_MS);
assert(reminder.length === 1 && reminder[0]?.type === "remind", "Erinnerung 7 Tage vorher");
const reminded = { ...deleted.row, reminderMailAt: new Date(purgeAt - 7 * DAY_MS).toISOString() };
const purge = planLifecycleJob([reminded], purgeAt);
assert(purge.length === 1 && purge[0]?.type === "purge" && purge[0].deleteContractData, "Löschung nach dem Fenster");
const late = planLifecycleJob([deleted.row], purgeAt);
assert(late.length === 1 && late[0]?.type === "remind", "ohne Erinnerung noch nicht löschen");
const sibling = row({
  email: SYNTHETIC,
  stripeSubscriptionId: "sub_live",
  phase: "active",
});
const blockedPurge = planLifecycleJob([reminded, sibling], purgeAt);
assert(
  blockedPurge.some((action) => action.type === "purge" && action.deleteContractData === false),
  "zweites lebendes Abo behält die Dateien",
);

const restored = nextLifecycle(deleted.row, {
  id: "evt_new",
  type: "checkout_completed",
  at: "2026-11-20T10:00:00.000Z",
  email: SYNTHETIC,
  customerId: "cus_test",
  subscriptionId: "sub_test",
  periodEnd: "2026-12-20T10:00:00.000Z",
});
assert(restored.row.phase === "active", "Wiederherstellung setzt aktiv");
assert(restored.row.purgeAt === "", "Löschfrist geleert");
assert(accessForRows([restored.row]).writesOpen, "Pflege nach neuem Abo");

assert(!contractPurgeAllowsPath("gobd/uploads/anon/datei.pdf"), "anon bleibt");
assert(!contractPurgeAllowsPath("gobd/readiness-lead/v1.pdf"), "Readiness bleibt");
assert(contractPurgeAllowsPath("gobd/fam1/v1.pdf"), "Vertrags-PDF wird gelöscht");
assert(
  withoutEmailRows(
    [{ email: SYNTHETIC, documentId: "d1" }, { email: "andere@example.com", documentId: "d2" }, { userEmail: SYNTHETIC, entityId: "e1" }],
    SYNTHETIC,
  ).length === 1,
  "nur fremde Zeilen bleiben",
);

const sheet = lifecycleRowFromSheet([...LIFECYCLE_SHEET_COLUMNS], lifecycleSheetValues(scheduled.row));
assert(sheet?.phase === "cancel_scheduled", "Sheet-Zeile lesbar");
assert(sheet?.cancelAtPeriodEnd === true, "Kündigungsflag");

assert(
  subscriptionPeriodEndUnix({
    items: { data: [{ current_period_end: 1_762_945_200 }] },
  }) === 1_762_945_200,
  "Periodenende am Subscription-Item",
);

const uploadLocators = new Set<string>();
collectUploadLocators({ module: { status: { m1: { uploadUrl: "gobd/uploads/owner/m/datei.pdf" } } } }, uploadLocators);
assert(uploadLocators.has("gobd/uploads/owner/m/datei.pdf"), "Upload im ZIP-Plan");

const zip = buildStoredZip([
  { name: "pdf/Verfahrensdoku-Firma-v1.pdf", data: Buffer.from("%PDF-1.4 demo") },
  { name: "../uploads/../geheim.txt", data: Buffer.from("hochgeladen") },
  { name: "inhalt.txt", data: Buffer.from("Firma\tVersion\n") },
]);
assert(zip.readUInt32LE(0) === 0x04034b50, "ZIP-Kopf");
assert(zip.includes(Buffer.from("pdf/Verfahrensdoku-Firma-v1.pdf")), "PDF-Name im ZIP");
assert(zip.includes(Buffer.from("%PDF-1.4 demo")), "PDF-Bytes im ZIP");
assert(zip.includes(Buffer.from("uploads/geheim.txt")), "Upload ohne Parent-Pfad");
assert(!zip.includes(Buffer.from("../")), "kein Parent im Namen");
assert(zipEntryName("../uploads/../geheim.txt") === "uploads/geheim.txt", "Name bereinigt");

function assertMail(label: string, mail: { subject: string; text: string; html: string }, extra: string[]) {
  if (!mail.text.includes(SIGNATURE) || !mail.html.includes(`<p>${SIGNATURE}</p>`)) {
    fail(`${label}: Signatur fehlt`);
  }
  if (/GoBD Ops/i.test(mail.text) || /GoBD Ops/i.test(mail.html)) fail(`${label}: GoBD Ops`);
  if (/\b(du|dich|dir|dein|deine)\b/i.test(mail.text)) fail(`${label}: Du-Anrede`);
  if (mail.text.includes(BLOCKED) || mail.html.includes(BLOCKED)) fail(`${label}: Owner-Adresse im Text`);
  for (const piece of extra) {
    if (!mail.text.includes(piece)) fail(`${label}: fehlt ${piece}`);
  }
}

const confirm = buildCancellationConfirmMail(scheduled.row);
assertMail("Bestätigung", confirm, ["30 Tage", "Sieben Tage", "info@gobd-doku-erstellen.de", "12.11.2026"]);
assert(confirm.subject.includes("12.11.2026"), "Betreff mit Datum");
const reminderMail = buildCancellationReminderMail(deleted.row);
assertMail("Erinnerung", reminderMail, ["löschen", "zehn Jahre"]);
assert(reminderMail.subject.startsWith("Erinnerung — Löschung"), "Erinnerungsbetreff");
assertMail("Rücknahme", buildCancellationReactivatedMail(), ["aufgehoben"]);
const ended = buildCancellationEndedMail(immediate.row);
assertMail("Ende", ended, ["Zahlung nicht abgeschlossen", "herunterladen"]);
assert(CANCELLATION_MAIL_FROM === "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>", "Absender info@");

const agb = readFileSync("content/legal/agb.md", "utf8");
assert(
  agb.includes("Nach Vertragsende kann der Kunde bereits erzeugte PDFs noch 30 Tage herunterladen."),
  "AGB §12 Abs. 4 unverändert",
);
const faq = readFileSync("content/faq.md", "utf8");
const datenschutz = readFileSync("content/legal/datenschutz.md", "utf8");
assert(faq.includes("30"), "FAQ nicht geleert");
assert(datenschutz.includes("30"), "Datenschutz nicht geleert");

console.log("check-kuendigung: ok");
