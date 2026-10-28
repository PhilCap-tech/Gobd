/**
 * Löschlauf v3: Standard-IO über die vorhandenen Store-Helfer.
 * Kein Stripe. Blob nur über den privaten Store-Token. Sheets über die
 * bestehenden Stores; Zeilen werden geschwärzt statt entfernt.
 */
import {
  commitBlobWipe,
  defaultBlobIo,
  listBlobPrefix,
  planAccountBlobs,
  readBlobText,
} from "@/lib/admin-wipe-blobs";
import { accountRecordFromUnknown, collectAccountScope, type AccountRecord } from "@/lib/admin-wipe";
import { listAllAuditStored, replaceAuditEventForRetention } from "@/lib/audit-store";
import { ds24AccessStore } from "@/lib/digistore24-access";
import { clearIntakeDraft } from "@/lib/intake-draft";
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import { logError } from "@/lib/log-error";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { listMemberships, replaceMembership } from "@/lib/membership-store";
import { deleteDraftIndexForRetention, forgetOpenDraft } from "@/lib/open-drafts";
import { listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import { buildRetentionNoticeMail, retentionNoticeMailKey } from "@/lib/retention-mail";
import { redactedEmailFor, type DraftRecord, type RetentionIo } from "@/lib/retention-run";
import { readStoredIntakeRows, redactDocumentRowsForRetention } from "@/lib/store";

/** Höchstens so viele Entwürfe je Lauf lesen (Laufzeit/Quote). Rest am nächsten Tag. */
export const RETENTION_DRAFT_READ_LIMIT = 400;

const SITE_URL = "https://gobd-doku-erstellen.de";

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function parseDraft(text: string | null): IntakeDraft | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<IntakeDraft>;
    if (!value || typeof value !== "object" || typeof value.draftKey !== "string") return null;
    return value as IntakeDraft;
  } catch {
    return null;
  }
}

export function defaultRetentionIo(): RetentionIo {
  return {
    listPlans: () => listPlanRowsStrict(),
    async listDocRows() {
      const rows = await readStoredIntakeRows();
      return rows.map((row) => ({
        email: row.email,
        stripeSessionId: row.stripeSessionId,
        documentId: row.documentId,
        entityId: row.entityId,
      }));
    },
    async listDrafts() {
      const token = blobToken();
      if (!token) return { drafts: [], truncated: false };
      const all = (await listBlobPrefix("gobd/drafts/", defaultBlobIo, token)).filter(
        (pathname) => !pathname.slice("gobd/drafts/".length).includes("/"),
      );
      const slice = all.slice(0, RETENTION_DRAFT_READ_LIMIT);
      const drafts: DraftRecord[] = [];
      for (const pathname of slice) {
        drafts.push({ pathname, draft: parseDraft(await readBlobText(pathname, defaultBlobIo, token)) });
      }
      return { drafts, truncated: all.length > slice.length };
    },
    async ds24Known(email) {
      try {
        return (await ds24AccessStore().read(email)) !== null;
      } catch {
        return true;
      }
    },
    listMemberships: () => listMemberships({ fresh: true }),
    listAudit: () => listAllAuditStored(),
    async deleteDraft(record) {
      const draft = record.draft;
      if (!draft) return;
      await clearIntakeDraft(draft.draftKey);
      await forgetOpenDraft(draft.email, draft.draftKey);
    },
    async deleteDocs(plan, docs) {
      const email = plan.email.trim().toLowerCase();
      const records: AccountRecord[] = [];
      const stored = await readStoredIntakeRows();
      for (const row of stored) {
        if (row.email.trim().toLowerCase() !== email) continue;
        const record = accountRecordFromUnknown(row);
        if (record) records.push(record);
      }
      if (records.length === 0 && docs.length > 0) {
        for (const doc of docs) {
          const record = accountRecordFromUnknown(doc);
          if (record) records.push(record);
        }
      }
      const scope = collectAccountScope(email, records);
      const blob = await planAccountBlobs(scope, records);
      if (blob.skipped || blob.error) throw new Error("blob_plan_failed");
      await commitBlobWipe(blob.drafts);
      await commitBlobWipe(blob.documents);
      await commitBlobWipe(blob.uploads);
      if (blob.drafts.error || blob.documents.error || blob.uploads.error) throw new Error("blob_delete_failed");
      await deleteDraftIndexForRetention(email);
      await redactDocumentRowsForRetention(email, redactedEmailFor(email));
    },
    savePlan: (row) => savePlanRow(row),
    async redactMembership(row) {
      const saved = await replaceMembership(row);
      if (!saved) throw new Error("membership_missing");
    },
    async redactAudit(row) {
      const saved = await replaceAuditEventForRetention(row);
      if (!saved) throw new Error("audit_missing");
    },
    async sendNotice(input) {
      const mail = buildRetentionNoticeMail({
        stage: input.stage,
        deleteAt: input.deleteAt,
        category: input.category,
        siteUrl: SITE_URL,
      });
      try {
        const result = await sendDedupedEmail({
          dedupeKey: retentionNoticeMailKey(input.stage, input.email, input.dueAt),
          to: input.email,
          ...mail,
        });
        if (result.duplicate) return "duplicate";
        return result.sent ? "sent" : "failed";
      } catch (error) {
        logError("[retention] Hinweis fehlgeschlagen", error);
        return "failed";
      }
    },
  };
}
