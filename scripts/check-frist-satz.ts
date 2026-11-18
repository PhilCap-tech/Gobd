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
import { generatePdf } from "../lib/delivery";
import { createFristSatzIo, pdfKitPlainText } from "../lib/frist-satz-sources";
import { pageTexts } from "./pdf-text";
import { TEST_ENTITY_IDS } from "../lib/test-entities";
import { intakeHeaderProblem } from "../lib/intake-header";
import { BELEGFRIST_SAETZE } from "./fixtures/belegfrist-saetze";
import { emptyAnswers, emptySheetRow, type SheetRow } from "../lib/types";

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
  ok(textHasOutdatedBuchungsfrist("Die Buchungsbelege werden 10 Jahre aufbewahrt."), "a direct sentence matches");
  ok(textHasOutdatedBuchungsfrist("Der Buchungsbeleg gilt 10 Jahre."), "the singular form matches");
  ok(textHasOutdatedBuchungsfrist("Buchungsbelege\n10 Jahre"), "a wrapped line is still one sentence");
  ok(
    !textHasOutdatedBuchungsfrist("Buchungsbelege 8 Jahre, Bücher 10 Jahre."),
    "books at ten years do not make the eight-year belege a hit",
  );
  ok(
    !textHasOutdatedBuchungsfrist("Buchungsbelege acht Jahre, Bücher und Aufzeichnungen zehn Jahre."),
    "the written triad does not count",
  );
  ok(!textHasOutdatedBuchungsfrist("Buchungsbelege 8 Jahre"), "8 Jahre does not match");
  ok(textHasOutdatedBuchungsfrist("Buchungsbelege 10 Jahren"), "Jahren matches the source check");
  ok(textHasOutdatedBuchungsfrist("Buchungsbelege werden nach 10 Jahren gelöscht."), "nach 10 Jahren matches");
  ok(textHasOutdatedBuchungsfrist("Für Buchungsbelege gilt eine zehnjährige Frist."), "zehnjährige matches");
  ok(
    !textHasOutdatedBuchungsfrist("Buchungsbelege werden nicht mehr 10 Jahre, sondern 8 Jahre aufbewahrt."),
    "a negation is not the old phrase",
  );
  ok(!textHasOutdatedBuchungsfrist("Für Buchungsbelege gelten 8 statt 10 Jahre."), "8 statt 10 is not the old phrase");
  ok(
    !textHasOutdatedBuchungsfrist("Aufbewahrungsdauer (Buchungsbelege ≠ pauschal 10 Jahre)"),
    "a denied flat ten years is not the old phrase",
  );
  ok(!textHasOutdatedBuchungsfrist("Aufbewahrung 110 Jahre für Buchungsbelege"), "110 Jahre is not 10 Jahre");
  ok(
    !textHasOutdatedBuchungsfrist("Buchungsbelege sind zugeordnet. Die Frist beträgt 10 Jahre."),
    "a later sentence does not match",
  );
  ok(!textHasOutdatedBuchungsfrist("Buchungsbelege.\n10 Jahre"), "a period ends the sentence");
  const far = `Buchungsbelege ${"wort ".repeat(80)}10 Jahre`;
  ok(textHasOutdatedBuchungsfrist(far), "the same sentence counts, like the source check");
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
  for (const satz of BELEGFRIST_SAETZE) {
    ok(textHasOutdatedBuchungsfrist(satz.text) === satz.hit, `Fixture ${satz.name}`);
  }
}

function checkPdfText() {
  const one = miniPdf("(Buchungsbelege werden 10 Jahre aufbewahrt.) Tj");
  ok(pageTexts(one).join("").includes("10 Jahre"), "the existing extractor still reads one string");
  const kerned = miniPdf("(Die Buchungsbelege w) Tj (erden 10 J) Tj (ahre aufbewahrt.) Tj");
  const kernedText = pdfKitPlainText(kerned);
  ok(kernedText.includes("werden 10 Jahre"), "kerning fragments keep the stored word space");
  ok(!kernedText.includes("J ahre"), "kerning does not split Jahre");
  ok(textHasOutdatedBuchungsfrist(kernedText), "a kerned sentence matches");
  const ended = miniPdf("(Buchungsbelege. ) Tj (10 Jahre bleiben bei den Büchern.) Tj");
  ok(!textHasOutdatedBuchungsfrist(pdfKitPlainText(ended)), "a period between PDF text calls does not match");
  const cells = miniPdf(
    "(Zaehlprotokolle) Tj 1 0 0 1 188 723 Tm (8 Jahre als Buchungsbeleg; als Aufzeichnung 10 Jahre) Tj",
  );
  const separated = pdfKitPlainText(cells);
  ok(separated.includes("Zaehlprotokolle 8 Jahre"), "a new text position separates table cells");
  ok(!separated.includes("Zaehlprotokolle8"), "glued table cells are split");
  ok(!textHasOutdatedBuchungsfrist(separated), "the neighbour ten-year clause does not count");
}

async function appPdf(body: string): Promise<Buffer> {
  const { buffer } = await generatePdf({
    answers: emptyAnswers(),
    identity: {
      email: BUYER,
      company: COMPANY,
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
      entityId: NORMAL,
    },
    documentId: "frist-satz-probe",
    version: 1,
    content: { chapters: [{ id: "af", title: "Fristen", body }] },
  });
  return buffer;
}

async function checkAppPdf() {
  const directText = pdfKitPlainText(await appPdf("Die Buchungsbelege werden 10 Jahre aufbewahrt."));
  ok(directText.includes("werden 10 Jahre"), "an app PDF keeps 10 Jahre");
  ok(directText.includes("aufbewahrt"), "an app PDF keeps the rest of the word");
  ok(!directText.includes("J ahre"), "an app PDF does not kern Jahre apart");
  ok(textHasOutdatedBuchungsfrist(directText), "an app PDF with the old sentence counts");
  const triadText = pdfKitPlainText(
    await appPdf(
      "Buchungsbelege 8 Jahre, Bücher 10 Jahre. Buchungsbelege acht Jahre, Bücher und Aufzeichnungen zehn Jahre.",
    ),
  );
  ok(triadText.includes("Bücher 10 Jahre"), "the app PDF still contains the books clause");
  ok(triadText.includes("zehn Jahre"), "the app PDF still contains the written ten years");
  ok(!textHasOutdatedBuchungsfrist(triadText), "the legal triad in an app PDF does not count");
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
  ok(view.note.includes("1 Fassung") && !view.note.includes("1 Fassungen"), "one version uses the singular");
  ok(view.note.includes("1 Entwurf") && !view.note.includes("1 Entwürfe"), "one draft uses the singular");
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
      return miniPdf("(Die Buchungsbelege w) Tj (erden 10 J) Tj (ahre aufbewahrt.) Tj");
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

function functionSource(file: string, signature: string): string {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(signature);
  ok(start >= 0, `missing ${signature}`);
  const next = text.indexOf("\nexport ", start + signature.length);
  return text.slice(start, next < 0 ? text.length : next);
}

const WRITE_ORIGINALS = ["put", "del", "appendRecord", "generatePdf", "writeFile", "saveIntakeDraft", "loadDocumentPdf", "materializeIntakeHeader"];

/** Schreibt der Text über einen Alias oder über values.update/append? */
export function fristWriteCall(source: string): string | null {
  const names = new Set(WRITE_ORIGINALS);
  for (const match of source.matchAll(/import\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const bits = part.trim().split(/\s+as\s+/);
      const original = bits[0]?.replace(/^type\s+/, "").trim();
      const local = (bits[1] ?? original)?.trim();
      if (original && local && WRITE_ORIGINALS.includes(original)) names.add(local);
    }
  }
  for (const name of names) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(source)) return name;
  }
  if (/\.\s*(?:update|append|batchUpdate)\s*\(/.test(source)) {
    return /\bbatchUpdate\s*\(/.test(source) ? "batchUpdate" : "update";
  }
  if (/\[\s*["'](?:update|append|batchUpdate)["']\s*\]\s*\(/.test(source)) return "update";
  if (/\bbatchUpdate\s*\(/.test(source)) return "batchUpdate";
  return null;
}

function sliceAssignedArrow(source: string, name: string): string {
  const re = new RegExp(
    `(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_]\\w*)\\s*=>\\s*\\{`,
  );
  const match = re.exec(source);
  if (!match || match.index === undefined) return "";
  return sliceFunctionAt(source, match.index, match.index + match[0].length - 1);
}

function sliceFunctionAt(source: string, start: number, brace: number): string {
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function sliceFunction(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return "";
  const brace = source.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

/** Snapshot plus lokale Helfer, die er aufruft. Ein Write darin lässt den Check fehlschlagen. */
export function snapshotWriteBypass(fileSource: string): string | null {
  const own = sliceFunction(fileSource, "export async function readIntakeRowsSnapshot");
  if (!own) return fristWriteCall(fileSource);
  let combined = own;
  const seen = new Set<string>(["readIntakeRowsSnapshot"]);
  for (const match of own.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    for (const signature of [`async function ${name}`, `function ${name}`, `export async function ${name}`, `export function ${name}`]) {
      const body = sliceFunction(fileSource, signature);
      if (!body) continue;
      combined += `\n${body}`;
      break;
    }
    if (!combined.includes(`function ${name}`)) {
      const arrow = sliceAssignedArrow(fileSource, name);
      if (arrow) combined += `\n${arrow}`;
    }
  }
  return fristWriteCall(combined);
}

function checkHeaderAndBypass() {
  if (intakeHeaderProblem(["", " "])?.kind !== "leer") fail("Negativtest: leerer Kopf wurde nicht erkannt");
  const missing = intakeHeaderProblem(["timestamp", "email"]);
  if (missing?.kind !== "unvollstaendig" || missing.columns.join(",") !== "fragen") {
    fail("Negativtest: fehlende Spalte fragen wurde nicht erkannt");
  }
  if (intakeHeaderProblem(["timestamp", "fragen"]) !== null) fail("Negativtest: vollständiger Kopf wurde gemeldet");
  const alias = 'import { put as save } from "@vercel/blob";\nawait save("a");';
  if (fristWriteCall(alias) !== "save") fail("Negativtest: Alias save() wurde nicht erkannt");
  if (fristWriteCall('import { readFile } from "node:fs";\nreadFile("a");') !== null) fail("Negativtest: harmloser Import gilt als Write");
  const update = `export async function readIntakeRowsSnapshot() {
    const v = createSheetsClient().spreadsheets.values;
    await v.update({});
  }`;
  if (snapshotWriteBypass(update) !== "update") fail("Negativtest: values.update über eine Variable wurde nicht erkannt");
  const bracket = `export async function readIntakeRowsSnapshot() {
    const v = createSheetsClient().spreadsheets.values;
    await v["update"]({});
  }`;
  if (snapshotWriteBypass(bracket) !== "update") fail("Negativtest: v[\"update\"] wurde nicht erkannt");
  const batch = `export async function readIntakeRowsSnapshot() {
    await s.batchUpdate({});
  }`;
  if (snapshotWriteBypass(batch) !== "batchUpdate") fail("Negativtest: batchUpdate wurde nicht erkannt");
  const arrow = `export async function readIntakeRowsSnapshot() {
    return ensureHeader();
  }
  const ensureHeader = async () => {
    await materializeIntakeHeader(tab, []);
  };`;
  if (snapshotWriteBypass(arrow) !== "materializeIntakeHeader") fail("Negativtest: Arrow-Helfer wurde nicht erkannt");
  const helper = `export async function readIntakeRowsSnapshot() {
    return ensureHeader();
  }
  async function ensureHeader() {
    await materializeIntakeHeader(tab, []);
  }`;
  if (snapshotWriteBypass(helper) !== "materializeIntakeHeader") fail("Negativtest: Header-Write in einem Helfer wurde nicht erkannt");
  if (snapshotWriteBypass(readFileSync("lib/store.ts", "utf8")) !== null) fail("der echte Zeilenleser schreibt");
  if (fristWriteCall(readFileSync("lib/frist-satz.ts", "utf8")) !== null) fail("der Zählkern schreibt");
  if (fristWriteCall(readFileSync("lib/frist-satz-sources.ts", "utf8")) !== null) fail("die Quellen schreiben");
  if (fristWriteCall(readFileSync("app/admin/ampel/frist-satz-action.ts", "utf8")) !== null) fail("die Action schreibt");
}

async function checkHeaderNote() {
  const io = {
    async listDrafts() {
      return { pathnames: [] as string[] };
    },
    async readDraft() {
      return null;
    },
  };
  const empty = await scanFristSatzForAdmin(WIPE_EMAIL_ALLOWLIST[0], { mode: "start", cursor: "" }, {
    ...io,
    async loadVersions() {
      return { header: "leer" as const };
    },
  }, NOW);
  ok(empty.done && empty.cursor === "", "ein leerer Kopf bietet kein Fortsetzen");
  ok(empty.note.includes("Tabellenkopf ist leer"), "ein leerer Kopf wird benannt");
  ok(!empty.note.includes("nicht erreichbar"), "ein leerer Kopf ist kein Ausfall");
  const partial = await scanFristSatzForAdmin(WIPE_EMAIL_ALLOWLIST[0], { mode: "start", cursor: "" }, {
    ...io,
    async loadVersions() {
      return { header: "unvollstaendig" as const, columns: ["fragen"] };
    },
  }, NOW);
  ok(partial.done && partial.cursor === "", "ein unvollständiger Kopf bietet kein Fortsetzen");
  ok(partial.note.includes("unvollständiger Kopf") && partial.note.includes("Spalte fragen"), "die fehlende Spalte wird benannt");
  ok(!partial.note.includes("nicht erreichbar"), "eine fehlende Spalte ist kein Ausfall");
}

function checkSourcesAreReadOnly() {
  const action = readFileSync("app/admin/ampel/frist-satz-action.ts", "utf8");
  const sources = readFileSync("lib/frist-satz-sources.ts", "utf8");
  const core = readFileSync("lib/frist-satz.ts", "utf8");
  const section = readFileSync("app/admin/ampel/frist-satz-section.tsx", "utf8");
  const page = readFileSync("app/admin/ampel/page.tsx", "utf8");
  const writeCall =
    /\b(put|del|appendRecord|generatePdf|writeFile|saveIntakeDraft|loadDocumentPdf|materializeIntakeHeader)\s*\(/;
  ok(action.includes("use server"), "the count is a server action");
  ok(action.includes("isAmpelAdminEmail") && action.includes("getSessionEmail"), "the action reuses the admin allowlist");
  ok(action.indexOf("isAmpelAdminEmail") < action.indexOf("createFristSatzIo"), "the allowlist is checked before the stores are opened");
  ok(!writeCall.test(action), "the action does not write");
  ok(!writeCall.test(core), "the count core does not write");
  ok(!sources.includes("generatePdf") && !sources.includes("loadDocumentPdf"), "PDFs are not generated");
  ok(!sources.includes("appendRecord") && !sources.includes("saveIntakeDraft"), "drafts and rows are not written");
  ok(!sources.includes("writeFile") && !/\b(put|del)\s*\(/.test(sources), "blob writes are not called");
  ok(!sources.includes("materializeIntakeHeader"), "sources do not build the sheet header");
  ok(!sources.includes("console."), "sources do not log on their own");
  const snapshot = functionSource("lib/store.ts", "export async function readIntakeRowsSnapshot");
  ok(!snapshot.includes("materializeIntakeHeader"), "the row read does not build the header");
  ok(!snapshot.includes("appendRecord"), "the row read does not append");
  ok(!/spreadsheets\.values\.(update|append)/.test(snapshot), "the row read does not write cells");
  ok(!snapshot.includes("loadRows(") && !snapshot.includes("readSheetRows("), "the row read stays off the writing grid path");
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
  await checkAppPdf();
  await checkCount();
  await checkContinue();
  await checkSources();
  await checkPauseAndAuth();
  checkSourcesAreReadOnly();
  checkHeaderAndBypass();
  await checkHeaderNote();
  console.log("check-frist-satz: ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "check-frist-satz failed");
  process.exit(1);
});
