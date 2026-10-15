/**
 * Mitwirkende bearbeiten nur zugewiesene Module im Entwurf des Inhabers.
 *
 *   npx tsx scripts/check-membership-edit.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { postModuleUpload, type UploadIo } from "../app/api/module-upload/route";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { setCatalogValue } from "../lib/intake-catalog";
import { normalizeDraftKey, type IntakeDraft } from "../lib/intake-draft-shared";
import {
  allowedModuleIds,
  firmActiveModuleIds,
  formatSavedAt,
  memberFirmView,
} from "../lib/membership-draft";
import {
  findActiveMembership,
  insertMembership,
  replaceMembership,
  setMembershipStoreTestHooks,
} from "../lib/membership-store";
import type { Membership } from "../lib/memberships";
import { ensureGesamt, setCheckAntwort } from "../lib/module/status";
import { emptyAnswers, emptySheetRow, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const OWNER = "inhaber@nordlicht.example";
const MEMBER = "buchhaltung@nordlicht.example";
const OTHER = "fremd@example.com";
const ENTITY = "ent-nordlicht-01";
const OTHER_ENTITY = "ent-fremd-0001";
const WHEN = "2026-10-12T07:40:00.000Z";

function cookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
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

function membership(status: Membership["status"] = "active"): Membership {
  return {
    membershipId: "mem-nordlicht-buch",
    ownerEmail: OWNER,
    memberEmail: MEMBER,
    entityId: ENTITY,
    status,
    moduleIds: "m03,m08,m09",
    tokenHash: "",
    invitedAt: WHEN,
    acceptedAt: WHEN,
    revokedAt: status === "revoked" ? WHEN : "",
    invitedBy: OWNER,
    updatedAt: WHEN,
  };
}

function memoryIo(initial: IntakeDraft | null, documents: Record<string, { email: string; entityId: string }> = {}): {
  io: DraftWriteIo;
  saved: () => IntakeDraft | null;
} {
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
      findDocumentById: async (id) => {
        const hit = documents[id];
        if (!hit) return null;
        return { ...emptySheetRow(), documentId: id, email: hit.email, entityId: hit.entityId };
      },
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async () => ({ error: "invalid" }),
    findActiveMembership,
  };
  return { io, saved: () => drafts.get(initial?.draftKey ?? "") ?? [...drafts.values()][0] ?? null };
}

function put(email: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/intake/draft", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookie(email) },
    body: JSON.stringify(body),
  });
}

async function main() {
  const storeDir = mkdtempSync(path.join(tmpdir(), "member-edit-"));
  setMembershipStoreTestHooks({ dir: storeDir });
  try {
    const answers = baseAnswers();
    const active = firmActiveModuleIds(answers);
    ok(active.includes("m01") && active.includes("m09") && active.includes("m15"), "kern modules stay active");
    ok(!active.includes("m08"), "a switched-off module is not active");
    const assigned = allowedModuleIds(["m01", "m09", "m08"], answers);
    ok(assigned.includes("m01") && assigned.includes("m09"), "assignment keeps module 1 and module 9");
    ok(!assigned.includes("m08"), "a switched-off module is dropped from the assignment");
    const open = allowedModuleIds("", answers);
    ok(open.includes("m01") && open.includes("m09") && open.includes("m15"), "an empty assignment is every active module, including core");
    ok(!open.includes("m08"), "an empty assignment does not switch a module back on");

    const view = memberFirmView(
      {
        entityId: ENTITY,
        name: "Nordlicht GmbH",
        street: "Hafenstraße 4",
        zip: "20457",
        city: "Hamburg",
        stnr: "12/345/67890",
        ustId: "DE123456789",
      } as { entityId: string; name: string; street: string; zip: string; city: string },
      OWNER,
    );
    ok(view.name === "Nordlicht GmbH" && view.street === "Hafenstraße 4", "firm view keeps name and street");
    ok(view.zip === "20457" && view.city === "Hamburg", "firm view keeps zip and city");
    ok(!("stnr" in view) && !("ustId" in view), "firm view omits tax ids");
    ok(formatSavedAt(WHEN) === "12.10. 09:40", "saved-at uses the Berlin clock");

    await insertMembership(membership());
    const stored = draftOf(answers, 4, OWNER);
    const memory = memoryIo(stored);
    const changed = setCatalogValue(answers, "C01", "kanaele", ["E-Mail"]);
    const saved = await putIntakeDraft(
      put(MEMBER, {
        draftKey: normalizeDraftKey({ email: MEMBER, entityId: ENTITY, modus: "gesamt" }),
        email: MEMBER,
        entityId: ENTITY,
        modus: "gesamt",
        step: 4,
        revision: 5,
        answers: changed,
      }),
      memory.io,
    );
    const savedBody = (await saved.json()) as { draft?: IntakeDraft };
    ok(saved.status === 200, "a contributor saves an assigned module");
    const written = memory.saved();
    ok(written?.draftKey === stored.draftKey, "the blob key stays the owner's");
    ok(written?.email === OWNER, "draft.email stays the owner");
    ok(written?.updatedBy === MEMBER, "updatedBy is the contributor");
    ok(written?.answers.katalog?.C01?.values?.kanaele, "the assigned answer is stored");

    const ownerRead = await readIntakeDraft(
      new Request(
        `http://localhost/api/intake/draft?draftKey=${encodeURIComponent(stored.draftKey)}&entityId=${ENTITY}`,
        { headers: { cookie: cookie(OWNER) } },
      ),
      memory.io,
    );
    const ownerBody = (await ownerRead.json()) as { draft?: IntakeDraft };
    ok(ownerRead.status === 200 && ownerBody.draft?.email === OWNER, "the owner reads the same blob");
    ok(ownerBody.draft?.updatedBy === MEMBER, "the owner sees who saved");

    const outside = setCatalogValue(answers, "A01", "gf", "Fremde Änderung");
    const beforeOutside = JSON.stringify(memory.saved()?.answers);
    const rejected = await putIntakeDraft(
      put(MEMBER, {
        draftKey: stored.draftKey,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 6,
        answers: outside,
      }),
      memory.io,
    );
    ok(rejected.status === 403, "an answer outside the assignment is 403");
    ok(JSON.stringify(memory.saved()?.answers) === beforeOutside, "the blob stays unchanged");

    const mixed = setCatalogValue(changed, "A01", "gf", "Noch fremder");
    const mixedPut = await putIntakeDraft(
      put(MEMBER, {
        draftKey: stored.draftKey,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 6,
        answers: mixed,
      }),
      memory.io,
    );
    ok(mixedPut.status === 403, "a changed question outside the assignment rejects the whole put");
    ok(JSON.stringify(memory.saved()?.answers) === beforeOutside, "a mixed put does not trim the draft");

    const foreign = await putIntakeDraft(
      put(MEMBER, {
        draftKey: normalizeDraftKey({ email: OWNER, entityId: OTHER_ENTITY, modus: "gesamt" }),
        email: OWNER,
        entityId: OTHER_ENTITY,
        modus: "gesamt",
        revision: 6,
        answers: changed,
      }),
      memory.io,
    );
    ok(foreign.status === 403, "a foreign entity is 403");

    const docs = memoryIo(stored, {
      doc_other: { email: OTHER, entityId: OTHER_ENTITY },
      doc_own: { email: OWNER, entityId: ENTITY },
    });
    const otherDoc = await putIntakeDraft(
      put(MEMBER, {
        draftKey: "doc:doc_other",
        email: OWNER,
        entityId: ENTITY,
        revision: 5,
        answers: changed,
      }),
      docs.io,
    );
    ok(otherDoc.status === 403, "a doc key of another firm is 403");
    const otherArea = await putIntakeDraft(
      put(MEMBER, {
        draftKey: "area:doc_other:gesamt",
        email: OWNER,
        entityId: ENTITY,
        revision: 5,
        answers: changed,
      }),
      docs.io,
    );
    ok(otherArea.status === 403, "an area key of another firm is 403");
    const sessionKey = await putIntakeDraft(
      put(MEMBER, {
        draftKey: "session:cs_test_member:gesamt",
        email: OWNER,
        entityId: ENTITY,
        revision: 5,
        answers: changed,
      }),
      memory.io,
    );
    ok(sessionKey.status === 403, "a session key rejects the membership");

    const raced = memoryIo(draftOf(answers, 4, OWNER));
    const conflict = await putIntakeDraft(
      put(MEMBER, {
        draftKey: stored.draftKey,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 4,
        answers: changed,
      }),
      raced.io,
    );
    const conflictBody = (await conflict.json()) as { updatedBy?: string; error?: string };
    ok(conflict.status === 409, "an equal revision from another mail is 409");
    ok(conflictBody.updatedBy === OWNER, "the conflict names updatedBy");
    ok(JSON.stringify(raced.saved()?.answers.katalog?.C01 ?? null) === JSON.stringify(answers.katalog?.C01 ?? null), "the conflict does not write");

    const again = memoryIo(draftOf(changed, 4, MEMBER));
    const repeat = await putIntakeDraft(
      put(MEMBER, {
        draftKey: stored.draftKey,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 4,
        answers: setCatalogValue(changed, "C01", "kanaele", ["Portal"]),
      }),
      again.io,
    );
    ok(repeat.status === 200, "the same mail may write its own equal revision");
    const repeated = again.saved();
    ok(
      JSON.stringify(repeated?.answers.katalog?.C01?.values?.kanaele) === JSON.stringify(["Portal"]),
      "the repeated save keeps the new answer",
    );

    await replaceMembership({ ...membership(), status: "revoked", revokedAt: WHEN, tokenHash: "" });
    ok((await findActiveMembership(MEMBER, ENTITY)) == null, "revocation removes the active row immediately");
    const afterRevoke = await putIntakeDraft(
      put(MEMBER, {
        draftKey: stored.draftKey,
        email: OWNER,
        entityId: ENTITY,
        modus: "gesamt",
        revision: 8,
        answers: setCatalogValue(answers, "C01", "kanaele", ["Nach Widerruf"]),
      }),
      memory.io,
    );
    ok(afterRevoke.status === 403, "a withdrawn contributor loses draft access on the next request");
    ok(
      JSON.stringify(memory.saved()?.answers.katalog?.C01?.values?.kanaele) !== JSON.stringify(["Nach Widerruf"]),
      "the withdrawn save does not change the blob",
    );

    await replaceMembership(membership());
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
    const blockedForm = new FormData();
    blockedForm.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "beleg.pdf", { type: "application/pdf" }));
    blockedForm.set("modulId", "m01");
    blockedForm.set("entityId", ENTITY);
    const blockedUpload = await postModuleUpload(
      new Request("http://localhost/api/module-upload", {
        method: "POST",
        headers: { cookie: cookie(MEMBER) },
        body: blockedForm,
      }),
      uploadIo,
    );
    ok(blockedUpload.status === 403 && uploads.length === 1, "an upload outside the assignment is rejected");

    const page = readFileSync(path.join("app/account/mitwirkung/[entityId]/page.tsx"), "utf8");
    const formSource = readFileSync(path.join("app/account/mitwirkung/modul-form.tsx"), "utf8");
    ok(!page.includes("stnr") && !page.includes("ustId"), "the contributor page does not render tax ids");
    ok(page.includes("MEMBER_PDF_HINT"), "the contributor page says the PDF is not readable");
    ok(!formSource.includes("Speichern und PDF"), "the module form has no PDF button");
    ok(formSource.includes("draftConflictCopy"), "a conflict reloads instead of keeping the local edit");
    ok(savedBody.draft?.updatedBy === MEMBER, "the save response names the contributor");

    console.log("check-membership-edit: ok");
  } finally {
    setMembershipStoreTestHooks(null);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
