/**
 * Outdated-sentence count. Fake drafts and document versions only.
 * Does not read Sheets, Blob, or a live PDF.
 */
import { readFileSync } from "node:fs";
import { WIPE_EMAIL_ALLOWLIST } from "../lib/admin-wipe";
import { isAmpelAdminEmail } from "../lib/ampel-admin";
import { encodeChapterContentRef } from "../lib/document-content";
import { encodeIntakePayloadRef } from "../lib/intake-payload";
import {
  decodeFristProgress,
  isExcludedCustomer,
  jsonTextHasOutdatedBuchungsfrist,
  scanFristSatzForAdmin,
  textHasOutdatedBuchungsfrist,
  type FristSatzIo,
  type VersionRef,
} from "../lib/frist-satz";
import { createFristSatzIo, pdfKitPlainText } from "../lib/frist-satz-sources";
import { orderedPageTexts, pageTexts } from "./pdf-text";
import { TEST_ENTITY_IDS } from "../lib/test-entities";
import { emptySheetRow, type SheetRow } from "../lib/types";

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const LISTED = TEST_ENTITY_IDS[0];
const NORMAL = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BUYER = "buyer@nordlicht-handel.example";
const COMPANY = "Nordlicht Handel GmbH";
const PHRASE = "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)";
const NOW = new Date("2026-11-17T16:24:00.000Z");

function fail(message: string): never {
  console.error(`check-frist-satz: ${message}`);
  process.exit(1);
}

function ok(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function draft(input: {
  email?: string;
  entityId?: string;
  company?: string;
  answers?: unknown;
}): unknown {
  return {
    draftKey: "email:hidden",
    email: input.email ?? BUYER,
    entityId: input.entityId ?? NORMAL,
    company: input.company ?? COMPANY,
    answers: input.answers ?? {},
  };
}

function answersWith(value: string): unknown {
  return { katalog: { AF01: { values: { zuordnung: value } } } };
}

function chapterJson(body: string): string {
  return JSON.stringify({
    cover: "Deckblatt",
    chapters: [{ id: "af", title: "Fristen", body }],
  });
}

function row(patch: Partial<SheetRow>): SheetRow {
  return { ...emptySheetRow(), documentId: "doc-hidden", ...patch };
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  const body = new Response(text).body;
  if (!body) fail("stream missing");
  return body;
}

function miniPdf(streamBody: string): Buffer {
  const stream = `BT /F1 12 Tf ${streamBody} ET`;
  const length = Buffer.byteLength(stream, "latin1");
  return Buffer.from(`/Length ${length} >>\nstream\n${stream}\nendstream`, "latin1");
}

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value);
  return (
    text.includes(BUYER) ||
    text.includes(COMPANY) ||
    text.includes(LISTED) ||
    text.includes(NORMAL) ||
    text.includes(OTHER) ||
    text.includes("@") ||
    text.includes("Buchungsbelege")
  );
}

function checkMatcher() {
  ok(textHasOutdatedBuchungsfrist(PHRASE), "the stored template sentence matches");
  ok(
    textHasOutdatedBuchungsfrist("Buchungsbelege und Abschlussunterlagen 10 Jahre, Handelsbriefe 6 Jahre"),
    "words between Buchungsbelege and the years still match",
  );
  ok(textHasOutdatedBuchungsfrist("Für Buchungsbelege gelten zehn Jahre."), "zehn Jahre matches");
  ok(textHasOutdatedBuchungsfrist("Buchungsbelege\n10 Jahre"), "a wrapped line is still one sentence");
  ok(!textHasOutdatedBuchungsfrist("Buchungsbelege 8 Jahre"), "8 Jahre does not match");
  ok(!textHasOutdatedBuchungsfrist("Buchungsbelege 10 Jahren"), "Jahren is not the phrase");
  ok(!textHasOutdatedBuchungsfrist("Aufbewahrung 110 Jahre für Buchungsbelege"), "110 Jahre is not 10 Jahre");
  ok(
    !textHasOutdatedBuchungsfrist("Buchungsbelege sind zugeordnet. Die Frist beträgt 10 Jahre."),
    "a later sentence does not match",
  );
  ok(!textHasOutdatedBuchungsfrist("Buchungsbelege.\n10 Jahre"), "a period ends the sentence");
  const far = `Buchungsbelege ${"wort ".repeat(80)}10 Jahre`;
  ok(!textHasOutdatedBuchungsfrist(far), "a long gap inside one sentence does not match");
  ok(
    jsonTextHasOutdatedBuchungsfrist(
      JSON.stringify({
        a: "Buchungsbelege",
        b: "10 Jahre",
      }),
    ) === false,
    "two fields do not form one sentence",
  );
  ok(
    jsonTextHasOutdatedBuchungsfrist(JSON.stringify(answersWith(PHRASE))),
    "the answer field matches",
  );
  ok(
    jsonTextHasOutdatedBuchungsfrist(
      JSON.stringify({ email: PHRASE, answers: { katalog: { AF01: { values: { zuordnung: "8 Jahre" } } } } }),
    ) === false,
    "an identity field is not searched",
  );
}

function checkPdfText() {
  const one = miniPdf("(Buchungsbelege 10 Jahre) Tj");
  ok(pageTexts(one).join("").includes("Buchungsbelege 10 Jahre"), "the existing extractor still reads one string");
  const split = miniPdf("(Buchungsbelege) Tj (10 Jahre) Tj");
  ok(orderedPageTexts(split).join(" ").includes("Buchungsbelege 10 Jahre"), "neighbouring text calls stay in order");
  ok(textHasOutdatedBuchungsfrist(pdfKitPlainText(split)), "a PDF without structured data can match");
  const ended = miniPdf("(Buchungsbelege.) Tj (10 Jahre) Tj");
  ok(!textHasOutdatedBuchungsfrist(pdfKitPlainText(ended)), "a period between PDF text calls does not match");
}

function version(input: {
  email?: string;
  entityId?: string;
  hasStructured: boolean;
  texts?: string[] | null;
  pdf?: string | null;
  structuredCalls: { n: number };
  pdfCalls: { n: number };
}): VersionRef {
  return {
    email: input.email ?? BUYER,
    entityId: input.entityId ?? NORMAL,
    hasStructured: input.hasStructured,
    async readStructured() {
      input.structuredCalls.n += 1;
      if (!input.hasStructured) fail("structured read on a PDF-only version");
      return input.texts === undefined ? [PHRASE] : input.texts;
    },
    async readPdf() {
      input.pdfCalls.n += 1;
      if (input.hasStructured) fail("PDF read although structured text exists");
      return input.pdf === undefined ? PHRASE : input.pdf;
    },
  };
}

async function checkCount() {
  const structuredCalls = { n: 0 };
  const pdfCalls = { n: 0 };
  const bodies = new Map<string, unknown | null>([
    ["gobd/drafts/a.json", draft({ answers: answersWith(PHRASE) })],
    ["gobd/drafts/b.json", draft({ answers: answersWith("Buchungsbelege 8 Jahre") })],
    ["gobd/drafts/c.json", draft({ email: BUYER, entityId: LISTED, answers: answersWith(PHRASE) })],
    ["gobd/drafts/d.json", draft({ email: "smoke@example.com", entityId: OTHER, answers: answersWith(PHRASE) })],
    ["gobd/drafts/e.json", null],
    [
      "gobd/drafts/f.json",
      draft({
        answers: {
          katalog: {
            AF01: { values: { zuordnung: "Buchungsbelege sind zugeordnet. Die Frist beträgt 10 Jahre." } },
          },
        },
      }),
    ],
    [
      "gobd/drafts/g.json",
      draft({
        answers: { katalog: { AF01: { values: { art: "Buchungsbelege", frist: "10 Jahre" } } } },
      }),
    ],
    ["gobd/drafts/h.json", draft({ answers: answersWith("Für Buchungsbelege gelten zehn Jahre.") })],
    [
      "gobd/drafts/i.json",
      draft({
        company: "Buchungsbelege 10 Jahre GmbH",
        answers: answersWith(PHRASE),
      }),
    ],
    [
      "gobd/drafts/j.json",
      draft({
        company: PHRASE,
        answers: answersWith("Fristenliste im Archiv"),
      }),
    ],
  ]);
  const versions: VersionRef[] = [
    version({ hasStructured: true, texts: [chapterJson(PHRASE)], structuredCalls, pdfCalls }),
    version({
      hasStructured: true,
      texts: [JSON.stringify(answersWith(PHRASE))],
      structuredCalls,
      pdfCalls,
    }),
    version({
      hasStructured: true,
      texts: [chapterJson("Buchungsbelege 8 Jahre")],
      structuredCalls,
      pdfCalls,
    }),
    version({ hasStructured: false, pdf: PHRASE, structuredCalls, pdfCalls }),
    version({ hasStructured: false, pdf: null, structuredCalls, pdfCalls }),
    version({ hasStructured: false, pdf: "", structuredCalls, pdfCalls }),
    version({
      email: "intern@ikat-gmbh.de",
      hasStructured: true,
      texts: [chapterJson(PHRASE)],
      structuredCalls,
      pdfCalls,
    }),
    version({ hasStructured: true, texts: null, structuredCalls, pdfCalls }),
  ];
  const io: FristSatzIo = {
    async listDrafts() {
      return { pathnames: [...bodies.keys()] };
    },
    async readDraft(pathname) {
      return bodies.get(pathname) ?? null;
    },
    async loadVersions(offset, limit) {
      const items = versions.slice(offset, offset + limit);
      return { items, done: offset + items.length >= versions.length };
    },
  };
  const view = await scanFristSatzForAdmin(WIPE_EMAIL_ALLOWLIST[0], { mode: "start", cursor: "" }, io, NOW, {
    draftLimit: 20,
    versionLimit: 20,
    budgetMs: 60_000,
  });
  ok(isAmpelAdminEmail(WIPE_EMAIL_ALLOWLIST[0]), "the allowlist address may open the count");
  ok(view.drafts === 3, "three in-scope drafts contain the sentence");
  ok(view.pdfs === 3, "three document versions contain the sentence");
  ok(view.checked === 15, "test firms and test addresses are not part of the checked count");
  ok(view.done, "the fake batch finishes");
  ok(view.at.includes("17.11.2026") && view.at.includes("17:24"), "the timestamp is Europe/Berlin");
  ok(view.note.includes("Testfirmen und Testadressen"), "the note names the exclusion");
  ok(view.note.includes("PDF"), "a PDF-only version is explained");
  ok(view.note.includes("nicht lesen"), "unreadable objects are explained");
  ok(!leaked(view), "the result has no name, address, id, or sentence text");
  ok(pdfCalls.n === 3, "PDF text is read only when the version has no structured payload");
  ok(structuredCalls.n === 4, "the listed test firm is not opened");
}

async function checkContinue() {
  const pages = [
    ["gobd/drafts/p1.json", "gobd/drafts/p2.json"],
    ["gobd/drafts/p3.json"],
  ];
  let now = 0;
  let reads = 0;
  const io: FristSatzIo = {
    async listDrafts(cursor) {
      const index = cursor === "page-2" ? 1 : 0;
      const pathnames = pages[index] ?? [];
      return index === 0 ? { pathnames, nextCursor: "page-2" } : { pathnames };
    },
    async readDraft() {
      reads += 1;
      if (reads >= 2) now = 5_000;
      return draft({ answers: answersWith(PHRASE) });
    },
    async loadVersions() {
      return { items: [], done: true };
    },
  };
  const first = await scanFristSatzForAdmin(WIPE_EMAIL_ALLOWLIST[0], { mode: "start", cursor: "" }, io, NOW, {
    draftLimit: 2,
    budgetMs: 1_000,
    clock: () => now,
  });
  ok(!first.done && first.drafts === 2 && first.checked === 2, "the first page stops with a continuation");
  const progress = decodeFristProgress(first.cursor);
  ok(progress?.phase === "drafts" && progress.draftCursor === "page-2", "the continuation keeps the next page");
  ok(!leaked(first.cursor), "the continuation has no customer data");
  now = 0;
  reads = 0;
  const second = await scanFristSatzForAdmin(
    WIPE_EMAIL_ALLOWLIST[0],
    { mode: "continue", cursor: first.cursor },
    io,
    NOW,
    { draftLimit: 2, budgetMs: 1_000, clock: () => now },
  );
  ok(second.drafts === 3 && second.checked === 3 && second.done, "Fortsetzen adds the remaining draft");
  const restart = await scanFristSatzForAdmin(
    WIPE_EMAIL_ALLOWLIST[0],
    { mode: "start", cursor: first.cursor },
    {
      async listDrafts() {
        return { pathnames: [] };
      },
      async readDraft() {
        return null;
      },
      async loadVersions() {
        return { unavailable: true };
      },
    },
    NOW,
  );
  ok(restart.drafts === 0 && restart.checked === 0, "Von vorn ignores the previous continuation");
}

async function checkSources() {
  const pdfUrls: string[] = [];
  const answerReads: number[] = [];
  const chapterReads: number[] = [];
  const phraseAnswers = JSON.stringify(answersWith(PHRASE));
  const rows: SheetRow[] = [
    row({
      email: BUYER,
      entityId: NORMAL,
      chapterContent: chapterJson(PHRASE),
      pdfUrl: "gobd/family/v1.pdf",
    }),
    row({
      email: BUYER,
      entityId: NORMAL,
      documentId: "doc-answers",
      fragen: encodeIntakePayloadRef("gobd/family/doc-answers/v1-answers.json", ""),
      pdfUrl: "gobd/family/v2.pdf",
    }),
    row({
      email: BUYER,
      entityId: NORMAL,
      documentId: "doc-pdf",
      pdfUrl: "gobd/family/v3.pdf",
    }),
    row({
      email: "smoke@example.com",
      entityId: NORMAL,
      documentId: "doc-test",
      chapterContent: chapterJson(PHRASE),
      pdfUrl: "gobd/family/v4.pdf",
    }),
    row({
      email: BUYER,
      entityId: OTHER,
      documentId: "",
      pdfUrl: "",
      company: COMPANY,
    }),
  ];
  const io = createFristSatzIo({
    blobConfigured: () => true,
    sheetsConfigured: () => true,
    token: () => "fake-token",
    list: async () => ({
      blobs: [
        { pathname: "gobd/drafts/hit.json" },
        { pathname: "gobd/drafts/test.json" },
        { pathname: "gobd/other/skip.json" },
      ],
      hasMore: false,
    }),
    get: async (pathname) => ({
      statusCode: 200,
      stream: streamOf(
        JSON.stringify(
          pathname.endsWith("test.json")
            ? draft({ email: "gobd-test@mail.grokbot.com", answers: answersWith(PHRASE) })
            : draft({ answers: answersWith(PHRASE) }),
        ),
      ),
    }),
    readRows: async () => rows,
    readAnswers: async () => {
      answerReads.push(1);
      return phraseAnswers;
    },
    readChapters: async (raw) => {
      chapterReads.push(1);
      return raw;
    },
    readPdf: async (pdfUrl) => {
      pdfUrls.push(pdfUrl);
      return miniPdf("(Buchungsbelege) Tj (10 Jahre) Tj");
    },
  });
  const view = await scanFristSatzForAdmin(WIPE_EMAIL_ALLOWLIST[0], { mode: "start", cursor: "" }, io, NOW, {
    budgetMs: 60_000,
  });
  ok(view.drafts === 1, "the test mailbox draft is excluded");
  ok(view.pdfs === 3, "chapter text, answer JSON, and a PDF-only file each count once");
  ok(answerReads.length === 1, "the answer pointer is resolved");
  ok(chapterReads.length === 0, "inline chapter JSON is not fetched again");
  ok(pdfUrls.length === 1 && pdfUrls[0] === "gobd/family/v3.pdf", "only the version without structured text opens a PDF");
  ok(view.checked === 4, "the checkout row without a document and the test address are not checked");
  ok(!leaked(view), "the wired result has no customer data");
  ok(encodeChapterContentRef("gobd/family/v1-chapters.json").includes("__gobdContent"), "chapter pointers stay the existing shape");
}

async function checkPauseAndAuth() {
  const poisonous = new Error(`${BUYER} ${PHRASE}`);
  (poisonous as { status?: number }).status = 429;
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(JSON.stringify(args));
  };
  try {
    const paused = await scanFristSatzForAdmin(
      WIPE_EMAIL_ALLOWLIST[0],
      { mode: "start", cursor: "" },
      createFristSatzIo({
        blobConfigured: () => false,
        sheetsConfigured: () => true,
        readRows: async () => {
          throw poisonous;
        },
        readPdf: async () => {
          fail("a sheet failure must not open a PDF");
        },
      }),
      NOW,
    );
    ok(!paused.done && paused.drafts === 0 && paused.pdfs === 0, "a sheet failure pauses without a zero-success");
    ok(paused.note.includes("pausiert") && paused.note.includes("Entwurfsspeicher"), "the pause is explained");
    ok(!leaked(paused), "the pause result has no customer data");
    ok(logged.length > 0, "the failure is recorded");
    ok(logged.every((line) => !line.includes(BUYER) && !line.includes("Buchungsbelege")), "the log has no address and no text");
  } finally {
    console.error = original;
  }

  let called = false;
  const denied = await scanFristSatzForAdmin("buyer@nordlicht-handel.example", { mode: "start", cursor: "" }, {
    async listDrafts() {
      called = true;
      return { pathnames: [] };
    },
    async readDraft() {
      called = true;
      return null;
    },
    async loadVersions() {
      called = true;
      return { items: [], done: true };
    },
  }, NOW);
  ok(!called && denied.note === "Keine Berechtigung." && denied.drafts === 0, "a foreign session does not read");
  ok(isExcludedCustomer("smoke@example.com", NORMAL), "example.com stays excluded");
  ok(isExcludedCustomer(BUYER, LISTED), "the listed firm id stays excluded");
  ok(!isExcludedCustomer(BUYER, NORMAL), "a normal firm is counted");
  ok(!isExcludedCustomer(BUYER, ""), "a company name is not an allowlist");
}

function checkSourcesAreReadOnly() {
  const action = readFileSync("app/admin/ampel/frist-satz-action.ts", "utf8");
  const sources = readFileSync("lib/frist-satz-sources.ts", "utf8");
  const section = readFileSync("app/admin/ampel/frist-satz-section.tsx", "utf8");
  const page = readFileSync("app/admin/ampel/page.tsx", "utf8");
  ok(action.includes("use server"), "the count is a server action");
  ok(action.includes("isAmpelAdminEmail") && action.includes("getSessionEmail"), "the action reuses the admin allowlist");
  ok(action.indexOf("isAmpelAdminEmail") < action.indexOf("createFristSatzIo"), "the allowlist is checked before the stores are opened");
  ok(!/\b(put|del|appendRecord|generatePdf|writeFile|saveIntakeDraft|loadDocumentPdf)\s*\(/.test(action), "the action does not write");
  ok(!sources.includes("generatePdf") && !sources.includes("loadDocumentPdf"), "PDFs are not generated");
  ok(!sources.includes("appendRecord") && !sources.includes("saveIntakeDraft"), "drafts and rows are not written");
  ok(!sources.includes("writeFile") && !/\b(put|del)\s*\(/.test(sources), "blob writes are not called");
  ok(!sources.includes("console."), "sources do not log on their own");
  ok(section.includes("useActionState") && section.includes('name="mode"'), "the section counts from a form");
  ok(!section.includes("useEffect"), "opening the page does not start the count");
  ok(!section.includes("/api/"), "there is no public count route");
  ok(page.includes("<FristSatzSection />"), "the section sits on the existing admin page");
  ok(!page.includes("createFristSatzIo") && !page.includes("runFristSatzScan"), "the page render does not count");
  ok(page.includes("isAmpelAdminEmail") && page.includes("notFound("), "the page still refuses other sessions");
}

async function main() {
  checkMatcher();
  checkPdfText();
  await checkCount();
  await checkContinue();
  await checkSources();
  await checkPauseAndAuth();
  checkSourcesAreReadOnly();
  console.log("check-frist-satz: ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "check-frist-satz failed");
  process.exit(1);
});
