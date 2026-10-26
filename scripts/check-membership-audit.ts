/**
 * Änderungshistorie und Widerruf.
 * Eine Mitwirkende schreibt nur zugewiesene Module. Nach dem Widerruf ist der
 * nächste Zugriff 403. Audit-Zeilen entstehen, ohne Antworttexte.
 * Einladung und Widerruf älter als 24 Monate werden nicht ausgeliefert.
 * Nichts wird gelöscht. Versand nur an delivered@resend.dev, und nur über den Mock.
 *
 *   npx tsx scripts/check-membership-audit.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getFirmAudit } from "../app/api/account/audit/route";
import { putIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { postModuleUpload, type UploadIo } from "../app/api/module-upload/route";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { installSheetsHandler } from "../lib/sheets-client";
import { noteInvite } from "../lib/audit-record";
import {
  DRAFT_SAVED_WINDOW_MS,
  formatAuditWhen,
  type AuditEvent,
} from "../lib/audit-log";
import {
  clearAuditSheetCache,
  ensureAuditSheet,
  listAuditForEntity,
  listAuditStored,
  readAuditPage,
  recordAudit,
  setAuditStoreTestHooks,
} from "../lib/audit-store";
import type { Entity } from "../lib/entities";
import { setCatalogValue } from "../lib/intake-catalog";
import { normalizeDraftKey, type IntakeDraft } from "../lib/intake-draft-shared";
import { setMailDedupeTestHooks } from "../lib/mail-dedupe";
import { acceptInvite, inviteMitwirkende, revokeMitwirkende } from "../lib/membership-invite";
import {
  findActiveMembership,
  insertMembership,
  setMembershipStoreTestHooks,
} from "../lib/membership-store";
import type { Membership } from "../lib/memberships";
import { ensureGesamt, setCheckAntwort } from "../lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const OWNER = "inhaber@nordlicht.example";
const MEMBER = "buchhaltung@nordlicht.example";
const INVITED = "delivered@resend.dev";
const ENTITY = "ent-nordlicht-audit";
const WHEN = "2026-10-12T07:40:00.000Z";
const SECRET = "GEHEIMANTWORT-7f3a";

function cookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function monthsAgo(months: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

function baseAnswers(): IntakeAnswers {
  return setCheckAntwort(ensureGesamt(emptyAnswers()), "bargeld", "nein");
}

function draftOf(answers: IntakeAnswers, revision: number, updatedBy = ""): IntakeDraft {
  return {
    draftKey: normalizeDraftKey({ email: OWNER, entityId: ENTITY, modus: "gesamt" }),
    email: OWNER,
    stripeSessionId: "",
    documentId: "",
    entityId: ENTITY,
    step: 4,
    answers,
    revision,
    updatedAt: WHEN,
    ...(updatedBy ? { updatedBy } : {}),
  };
}

function membership(memberEmail: string, status: Membership["status"] = "active"): Membership {
  return {
    membershipId: `mem-${memberEmail.split("@")[0]}`,
    ownerEmail: OWNER,
    memberEmail,
    entityId: ENTITY,
    status,
    moduleIds: "m03,m09",
    tokenHash: "",
    invitedAt: WHEN,
    acceptedAt: status === "active" ? WHEN : "",
    revokedAt: "",
    invitedBy: OWNER,
    updatedAt: WHEN,
  };
}

function firm(): Entity {
  return {
    entityId: ENTITY,
    userEmail: OWNER,
    name: "Nordlicht GmbH",
    street: "Hafenstraße 4",
    zip: "20457",
    city: "Hamburg",
    stnr: "12/345/67890",
    ustId: "DE123456789",
    createdAt: WHEN,
    updatedAt: WHEN,
    checkoutPrefill: "",
  };
}

function memoryIo(initial: IntakeDraft | null): { io: DraftWriteIo; saved: () => IntakeDraft | null } {
  const drafts = new Map<string, IntakeDraft>();
  if (initial) drafts.set(initial.draftKey, initial);
  const io: DraftWriteIo = {
    loadIntakeDraft: async (key) => drafts.get(key) ?? null,
    saveIntakeDraft: async (draft) => {
      drafts.set(draft.draftKey, draft);
      return { backend: "file" };
    },
    clearIntakeDraft: async (key) => {
      drafts.delete(key);
    },
    rememberOpenDraft: async () => true,
    forgetOpenDraft: async () => undefined,
    lookup: {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async () => ({ error: "invalid" }),
    findActiveMembership,
  };
  return { io, saved: () => (initial ? drafts.get(initial.draftKey) ?? null : null) };
}

function put(email: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/intake/draft", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookie(email) },
    body: JSON.stringify(body),
  });
}

function savedRows(rows: AuditEvent[], action: AuditEvent["action"]): AuditEvent[] {
  return rows.filter((row) => row.action === action);
}

const sentMail: Array<{ text: string; html: string; to: string }> = [];

function tokenFromMail(text: string): string {
  const match = text.match(/\/auth\/invite\?token=([^\s<]+)/);
  if (!match?.[1]) return "";
  return decodeURIComponent(match[1]);
}

async function main() {
  const storeDir = mkdtempSync(path.join(tmpdir(), "member-audit-"));
  const mailDir = mkdtempSync(path.join(tmpdir(), "member-audit-mail-"));
  setMembershipStoreTestHooks({ dir: storeDir });
  setAuditStoreTestHooks({ dir: storeDir });
  setMailDedupeTestHooks({
    dir: mailDir,
    send: async (input) => {
      sentMail.push({ text: input.text, html: input.html, to: input.to });
      return { stub: false, sent: true, id: "email_test" };
    },
  });
  try {
    ok(formatAuditWhen(WHEN) === "12.10.2026 09:40", "history time uses the Berlin clock");
    await insertMembership(membership(MEMBER));
    const answers = baseAnswers();
    const memory = memoryIo(draftOf(answers, 4, OWNER));
    const firstAnswers = setCatalogValue(answers, "C01", "kanaele", [SECRET]);
    const key = normalizeDraftKey({ email: OWNER, entityId: ENTITY, modus: "gesamt" });
    const first = await putIntakeDraft(
      put(MEMBER, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        step: 4,
        revision: 5,
        answers: firstAnswers,
      }),
      memory.io,
    );
    ok(first.status === 200, "a contributor saves an assigned module");
    const second = await putIntakeDraft(
      put(MEMBER, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        step: 4,
        revision: 6,
        answers: setCatalogValue(answers, "C01", "kanaele", ["Portal"]),
      }),
      memory.io,
    );
    ok(second.status === 200, "a second save in the same window succeeds");
    const bundled = savedRows(await listAuditStored(ENTITY), "draft.saved");
    ok(bundled.length === 1, "two saves within 15 minutes are one audit row");
    ok(bundled[0]?.draftRevision === 6, "the bundled row keeps the latest revision");
    ok(bundled[0]?.moduleIds === "m03", "the row names the module that changed");
    ok(bundled[0]?.actorEmail === MEMBER, "the row names the contributor");
    ok(!JSON.stringify(bundled).includes(SECRET), "the audit row has no answer text");

    const later = new Date(Date.parse(bundled[0]?.at ?? "") + DRAFT_SAVED_WINDOW_MS).toISOString();
    await recordAudit({
      at: later,
      actorEmail: MEMBER,
      actorRole: "member",
      ownerEmail: OWNER,
      entityId: ENTITY,
      action: "draft.saved",
      moduleIds: "m03",
      draftRevision: 8,
      summary: "Mitwirkung · Entwurf gespeichert · Modul 3 · Revision 8",
    });
    ok(savedRows(await listAuditStored(ENTITY), "draft.saved").length === 2, "a save after 15 minutes is a new row");

    const beforeOutside = savedRows(await listAuditStored(ENTITY), "draft.saved").length;
    const outside = await putIntakeDraft(
      put(MEMBER, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 9,
        answers: setCatalogValue(answers, "A01", "gf", SECRET),
      }),
      memory.io,
    );
    ok(outside.status === 403, "a contributor cannot change a module outside the assignment");
    ok(
      savedRows(await listAuditStored(ENTITY), "draft.saved").length === beforeOutside,
      "a rejected save writes no draft.saved row",
    );

    const raced = memoryIo(draftOf(answers, 4, OWNER));
    const conflict = await putIntakeDraft(
      put(MEMBER, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 4,
        answers: setCatalogValue(answers, "C01", "kanaele", [SECRET]),
      }),
      raced.io,
    );
    ok(conflict.status === 409, "an equal revision from another mail is 409");
    const conflicts = savedRows(await listAuditStored(ENTITY), "draft.conflict");
    ok(conflicts.length === 1, "a conflict writes an audit row");
    const again = await putIntakeDraft(
      put(MEMBER, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 4,
        answers: setCatalogValue(answers, "C01", "kanaele", ["Nochmal"]),
      }),
      raced.io,
    );
    ok(again.status === 409, "a second conflict is rejected again");
    ok(savedRows(await listAuditStored(ENTITY), "draft.conflict").length === 2, "conflicts are written every time");
    ok(!JSON.stringify(await listAuditStored(ENTITY)).includes(SECRET), "no stored audit row contains an answer");

    const uploads: string[] = [];
    const uploadIo: UploadIo = {
      lookup: {
        findDocumentById: async () => null,
        listDocumentFamily: async () => [],
        findLatestDocumentByStripeSessionId: async () => null,
      },
      resolveCheckout: async () => ({ error: "invalid" }),
      storeCustomerUpload: async (input) => {
        uploads.push(input.ownerKey);
        return {
          url: "/api/module-upload/file/x",
          pathname: "gobd/uploads/owner/m03/x.pdf",
          filename: "beleg.pdf",
          contentType: "application/pdf",
          size: 4,
          backend: "file",
        };
      },
      findActiveMembership,
      loadOwnerDraft: async () => draftOf(answers, 4, OWNER),
    };
    const form = new FormData();
    form.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "beleg.pdf", { type: "application/pdf" }));
    form.set("modulId", "m03");
    form.set("entityId", ENTITY);
    const uploaded = await postModuleUpload(
      new Request("http://localhost/api/module-upload", {
        method: "POST",
        headers: { cookie: cookie(MEMBER) },
        body: form,
      }),
      uploadIo,
    );
    ok(uploaded.status === 200 && uploads[0] === OWNER, "an assigned upload is stored under the owner");
    ok(savedRows(await listAuditStored(ENTITY), "upload.added").length === 1, "an upload writes an audit row");
    const blocked = new FormData();
    blocked.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "beleg.pdf", { type: "application/pdf" }));
    blocked.set("modulId", "m01");
    blocked.set("entityId", ENTITY);
    const blockedUpload = await postModuleUpload(
      new Request("http://localhost/api/module-upload", {
        method: "POST",
        headers: { cookie: cookie(MEMBER) },
        body: blocked,
      }),
      uploadIo,
    );
    ok(blockedUpload.status === 403, "an upload outside the assignment is rejected");
    ok(savedRows(await listAuditStored(ENTITY), "upload.added").length === 1, "a rejected upload writes no row");

    const invited = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: firm(),
      memberEmail: INVITED,
      moduleIds: ["m03", "m09"],
    });
    ok(invited.ok, "the owner can invite");
    ok(savedRows(await listAuditStored(ENTITY), "invite.sent").length === 1, "an invitation writes invite.sent");
    const sent = savedRows(await listAuditStored(ENTITY), "invite.sent")[0];
    ok(sent?.summary.includes("Einladung gesendet") && sent.summary.includes(INVITED), "the invitation line names the person");
    ok(!sent?.summary.includes("12/345") && !sent?.summary.includes("DE123"), "the invitation line has no tax id");
    ok(sentMail[0]?.to === INVITED, "the invitation mail goes only to delivered@resend.dev");
    const token = tokenFromMail(`${sentMail[0]?.text ?? ""}\n${sentMail[0]?.html ?? ""}`);
    ok(token.length > 0, "the invitation mail carries the link");
    const accepted = await acceptInvite(token, async (id) => (id === ENTITY ? firm() : null));
    ok(accepted.ok, "the invited person accepts");
    ok(savedRows(await listAuditStored(ENTITY), "invite.accepted").length === 1, "acceptance writes invite.accepted");

    const active = await findActiveMembership(INVITED, ENTITY);
    ok(active?.membershipId, "acceptance leaves an active membership");
    const revoked = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: firm(),
      membershipId: active?.membershipId ?? "",
    });
    ok(revoked.ok, "the owner withdraws access");
    ok(savedRows(await listAuditStored(ENTITY), "invite.revoked").length === 1, "withdrawal writes invite.revoked");
    ok((await findActiveMembership(INVITED, ENTITY)) == null, "withdrawal is visible on the next read");
    const after = await putIntakeDraft(
      put(INVITED, {
        draftKey: key,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 10,
        answers: setCatalogValue(answers, "C01", "kanaele", ["Nach Widerruf"]),
      }),
      memory.io,
    );
    ok(after.status === 403, "a withdrawn contributor loses access on the next request");

    await recordAudit({
      at: monthsAgo(25),
      actorEmail: OWNER,
      actorRole: "owner",
      ownerEmail: OWNER,
      entityId: ENTITY,
      action: "invite.revoked",
      moduleIds: "m03",
      summary: "Inhaber · Zugriff entzogen · alt@example.com",
    });
    await recordAudit({
      at: monthsAgo(25),
      actorEmail: MEMBER,
      actorRole: "member",
      ownerEmail: OWNER,
      entityId: ENTITY,
      action: "draft.saved",
      moduleIds: "m03",
      draftRevision: 2,
      summary: "Mitwirkung · Entwurf gespeichert · Modul 3 · Revision 2",
    });
    await noteInvite({
      action: "membership.modules_changed",
      actorEmail: OWNER,
      actorRole: "owner",
      ownerEmail: OWNER,
      entityId: ENTITY,
      memberEmail: MEMBER,
      moduleIds: ["m09"],
      at: monthsAgo(25),
    });
    const storedAll = await listAuditStored(ENTITY);
    const visible = await listAuditForEntity(ENTITY);
    ok(storedAll.some((row) => row.summary.includes("alt@example.com")), "an old revocation stays stored");
    ok(!visible.some((row) => row.summary.includes("alt@example.com")), "an old revocation is not delivered");
    ok(
      !visible.some((row) => row.action === "membership.modules_changed"),
      "an old module change is not delivered",
    );
    ok(
      visible.some((row) => row.action === "draft.saved" && row.draftRevision === 2),
      "an old content row stays readable while the firm exists",
    );

    for (let index = 0; index < 21; index += 1) {
      const at = new Date(Date.now() - index * 60_000).toISOString();
      await recordAudit({
        at,
        actorEmail: OWNER,
        actorRole: "owner",
        ownerEmail: OWNER,
        entityId: ENTITY,
        action: "invite.failed",
        summary: `Inhaber · Einladung nicht gesendet · person-${index}@example.com`,
      });
    }
    const firstPage = await readAuditPage(ENTITY, 0);
    ok(firstPage.entries.length === 20, "the history page holds 20 rows");
    ok(firstPage.nextOffset === 20, "the next page starts after the first 20");
    const secondPage = await readAuditPage(ENTITY, firstPage.nextOffset ?? 0);
    ok(secondPage.entries.length > 0 && secondPage.entries.length <= 20, "older rows load on the next page");

    const memberRead = await getFirmAudit(
      new Request(`http://localhost/api/account/audit?entityId=${ENTITY}`, {
        headers: { cookie: cookie(MEMBER) },
      }),
      async (entityId, email) => entityId === ENTITY && email === OWNER,
    );
    ok(memberRead.status === 403, "a contributor cannot read the history");
    const ownerRead = await getFirmAudit(
      new Request(`http://localhost/api/account/audit?entityId=${ENTITY}`, {
        headers: { cookie: cookie(OWNER) },
      }),
      async (entityId, email) => entityId === ENTITY && email === OWNER,
    );
    const ownerBody = (await ownerRead.json()) as { entries?: { line?: string }[] };
    ok(ownerRead.status === 200 && (ownerBody.entries?.length ?? 0) > 0, "the owner reads the history");
    ok(!JSON.stringify(ownerBody).includes(SECRET), "the history response has no answer text");

    const history = readFileSync(path.join("app/account/firma/aenderungen.tsx"), "utf8");
    const firmPage = readFileSync(path.join("app/account/firma/[id]/page.tsx"), "utf8");
    const memberPage = readFileSync(path.join("app/account/mitwirkung/[entityId]/page.tsx"), "utf8");
    ok(history.includes("AUDIT_LOAD_MORE") && history.includes("AUDIT_HEADING"), "the owner history offers older rows");
    ok(firmPage.includes("Aenderungen"), "the firm page shows the history");
    ok(!memberPage.includes("AUDIT_HEADING") && !memberPage.includes("Aenderungen"), "a contributor does not get the history");
    ok(!history.includes("Mitarbeitende"), "the history says Mitwirkende, not Mitarbeitende");

    await auditSheetCases();

    console.log("check-membership-audit: ok");
  } finally {
    setMailDedupeTestHooks(null);
    setAuditStoreTestHooks(null);
    setMembershipStoreTestHooks(null);
  }
}

async function auditSheetCases(): Promise<void> {
  const saved = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    tab: process.env.GOOGLE_SHEETS_AUDIT_TAB,
    vercel: process.env.VERCEL,
  };
  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "audit-sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-audit-test";
  delete process.env.GOOGLE_SHEETS_AUDIT_TAB;
  process.env.VERCEL = "1";
  setAuditStoreTestHooks(null);
  clearAuditSheetCache();

  let titles: string[] = [];
  let header: string[] | null = null;
  const dataRows: string[][] = [];
  let addSheetCount = 0;
  let headerWrites = 0;
  let metaReads = 0;
  let rejectCreate = false;

  installSheetsHandler(async ({ op, args }) => {
    if (op === "spreadsheets.get") {
      metaReads += 1;
      return { data: { sheets: titles.map((title) => ({ properties: { title } })) } };
    }
    if (op === "spreadsheets.batchUpdate") {
      const requests = (args.requestBody as { requests?: Array<{ addSheet?: { properties?: { title?: string } } }> })
        .requests;
      const title = requests?.[0]?.addSheet?.properties?.title ?? "";
      addSheetCount += 1;
      if (rejectCreate || titles.includes(title)) {
        throw new Error(`A sheet with the name ${title} already exists.`);
      }
      titles.push(title);
      return { data: {} };
    }
    if (op === "values.get") {
      const range = typeof args.range === "string" ? args.range : "";
      if (range.includes("!A1:")) return { data: { values: header ? [header] : [] } };
      return { data: { values: dataRows } };
    }
    if (op === "values.append") {
      const row = ((args.requestBody as { values?: string[][] }).values ?? [])[0] ?? [];
      if (row[0] === "event_id") {
        headerWrites += 1;
        header = row;
      } else {
        dataRows.push(row);
      }
      return { data: {} };
    }
    if (op === "values.update" || op === "values.batchUpdate") {
      headerWrites += 1;
      return { data: {} };
    }
    throw new Error(`unexpected ${op}`);
  });

  try {
    await Promise.all([ensureAuditSheet(), ensureAuditSheet(), ensureAuditSheet()]);
    ok(titles.length === 1 && titles[0] === "audit_log", "a missing audit tab is created once");
    ok(addSheetCount === 1, "parallel calls do not create a second audit tab");
    ok(headerWrites === 1, "the header row is written once");
    ok(metaReads === 1, "parallel calls share one exists check");
    const created = { tabs: addSheetCount, headers: headerWrites, reads: metaReads };
    await Promise.all([ensureAuditSheet(), ensureAuditSheet()]);
    await recordAudit({
      actorEmail: OWNER,
      actorRole: "owner",
      ownerEmail: OWNER,
      entityId: ENTITY,
      action: "invite.sent",
      moduleIds: "m03",
      summary: "Inhaber · Einladung gesendet · tab@example.com · Modul 3",
    });
    ok(
      addSheetCount === created.tabs && headerWrites === created.headers && metaReads === created.reads,
      "a repeated call does not create the tab or the header again",
    );

    clearAuditSheetCache();
    titles = [];
    header = null;
    headerWrites = 0;
    addSheetCount = 0;
    metaReads = 0;
    rejectCreate = true;
    await ensureAuditSheet();
    ok(addSheetCount === 1 && headerWrites === 1, "an existing tab name does not raise and still writes one header");
    await ensureAuditSheet();
    ok(addSheetCount === 1 && headerWrites === 1 && metaReads === 1, "the exists check stays cached after a raced create");

    clearAuditSheetCache();
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    };
    installSheetsHandler(async ({ args }) => {
      // Only the audit sheet fails. The subscription check reads fine (empty):
      // without a successful check no write would happen at all (fail closed).
      const ranges = [typeof args.range === "string" ? args.range : "", ...(Array.isArray(args.ranges) ? (args.ranges as string[]) : [])];
      if (ranges.some((range) => range.startsWith("subscription_lifecycle!"))) {
        return { data: { values: [], valueRanges: ranges.map(() => ({ values: [] })) } };
      }
      throw new Error("audit sheet timeout");
    });
    try {
      const answers = baseAnswers();
      const memory = memoryIo(draftOf(answers, 4, OWNER));
      const key = normalizeDraftKey({ email: OWNER, entityId: ENTITY, modus: "gesamt" });
      const saved = await putIntakeDraft(
        put(MEMBER, {
          draftKey: key,
          email: OWNER,
          entityId: ENTITY,
          modus: "gesamt",
          revision: 5,
          answers: setCatalogValue(answers, "C01", "kanaele", [SECRET]),
        }),
        memory.io,
      );
      ok(saved.status === 200, "a failed audit write still saves the module");
      const stored = memory.saved();
      ok(
        JSON.stringify(stored?.answers.katalog?.C01?.values?.kanaele) === JSON.stringify([SECRET]),
        "the draft is stored when the audit write throws",
      );
      const auditLog = logged.filter((line) => line.includes("[audit]"));
      ok(auditLog.some((line) => line.includes(ENTITY) && line.includes("draft.saved")), "the audit failure is logged with the firm id");
      ok(
        !auditLog.join(" ").includes(MEMBER) && !auditLog.join(" ").includes(OWNER) && !auditLog.join(" ").includes(SECRET),
        "the audit failure log has no mail and no answer",
      );

      const uploads: string[] = [];
      const uploaded = await postModuleUpload(
        (() => {
          const form = new FormData();
          form.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "beleg.pdf", { type: "application/pdf" }));
          form.set("modulId", "m03");
          form.set("entityId", ENTITY);
          return new Request("http://localhost/api/module-upload", {
            method: "POST",
            headers: { cookie: cookie(MEMBER) },
            body: form,
          });
        })(),
        {
          lookup: {
            findDocumentById: async () => null,
            listDocumentFamily: async () => [],
            findLatestDocumentByStripeSessionId: async () => null,
          },
          resolveCheckout: async () => ({ error: "invalid" }),
          storeCustomerUpload: async (input) => {
            uploads.push(input.ownerKey);
            return {
              url: "/api/module-upload/file/x",
              pathname: "gobd/uploads/owner/m03/x.pdf",
              filename: "beleg.pdf",
              contentType: "application/pdf",
              size: 4,
              backend: "file",
            };
          },
          findActiveMembership,
          loadOwnerDraft: async () => draftOf(answers, 4, OWNER),
        } satisfies UploadIo,
      );
      ok(uploaded.status === 200 && uploads[0] === OWNER, "a failed audit write still stores the upload");

      const invited = await inviteMitwirkende({
        ownerEmail: OWNER,
        entity: firm(),
        memberEmail: INVITED,
        moduleIds: ["m09"],
      });
      ok(invited.ok, "a failed audit write still sends the invitation");
      const token = tokenFromMail(`${sentMail.at(-1)?.text ?? ""}\n${sentMail.at(-1)?.html ?? ""}`);
      const accepted = await acceptInvite(token, async (id) => (id === ENTITY ? firm() : null));
      ok(accepted.ok, "a failed audit write still accepts the invitation");
      const active = await findActiveMembership(INVITED, ENTITY);
      const revoked = await revokeMitwirkende({
        ownerEmail: OWNER,
        entity: firm(),
        membershipId: active?.membershipId ?? "",
      });
      ok(revoked.ok === true && revoked.ok && !revoked.already, "a failed audit write still revokes access");
    } finally {
      console.error = originalError;
    }
  } finally {
    installSheetsHandler(null);
    clearAuditSheetCache();
    setAuditStoreTestHooks(null);
    restoreEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", saved.email);
    restoreEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", saved.key);
    restoreEnv("GOOGLE_SHEETS_SPREADSHEET_ID", saved.sheet);
    restoreEnv("GOOGLE_SHEETS_AUDIT_TAB", saved.tab);
    restoreEnv("VERCEL", saved.vercel);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
