/**
 * Read-only count of stored customer drafts and generated document versions
 * that still tie Buchungsbelege to the old ten-year figure.
 * No writes, no names, no addresses, no ids.
 */
import { isRetentionTestEmail } from "@/lib/retention-guards";
import { isTestEntity } from "@/lib/test-entities";
import { isAmpelAdminEmail } from "@/lib/ampel-admin";
import {
  initialFristSatzView,
  type FristSatzView,
} from "@/lib/frist-satz-view";

export const FRIST_DRAFT_PAGE = 8;
export const FRIST_VERSION_PAGE = 8;
export const FRIST_BUDGET_MS = 7_000;
const MAX_DRAFT_PAGES = 4;
const MAX_VERSION_PAGES = 3;
const PHRASE_GAP = 240;

const SKIP_KEYS = new Set([
  "email",
  "updatedBy",
  "draftKey",
  "documentId",
  "parentDocumentId",
  "entityId",
  "stripeSessionId",
  "stripeCustomerId",
  "company",
  "changedBy",
  "pdfUrl",
  "pathname",
]);

export type FristProgress = {
  phase: "drafts" | "docs" | "done";
  draftCursor: string;
  offset: number;
  drafts: number;
  pdfs: number;
  checked: number;
  pdfRead: number;
  pdfUnreadable: number;
  structuredUnread: number;
  draftUnread: number;
  draftsUnavailable: boolean;
  docsUnavailable: boolean;
  paused: boolean;
};

export type DraftListResult =
  | { paused: true }
  | { unavailable: true }
  | { pathnames: string[]; nextCursor?: string };

export type VersionRef = {
  email: string;
  entityId: string;
  /** Answers JSON or chapter JSON is stored for this version. */
  hasStructured: boolean;
  /** Resolved answer/chapter texts. Null when the stored text could not be read. */
  readStructured: () => Promise<string[] | null>;
  /**
   * PDF text when no structured payload exists.
   * Null: a PDF was stored but its text could not be read.
   * Empty: this version has no PDF.
   */
  readPdf: () => Promise<string | null>;
};

export type VersionListResult =
  | { paused: true }
  | { unavailable: true }
  | { items: VersionRef[]; done: boolean };

export type FristSatzIo = {
  listDrafts: (cursor: string | undefined, limit: number) => Promise<DraftListResult>;
  readDraft: (pathname: string) => Promise<unknown | null>;
  loadVersions: (offset: number, limit: number) => Promise<VersionListResult>;
};

/** Listed test firms and the existing test-address / testdomain allowlists. */
export function isExcludedCustomer(
  email: string | null | undefined,
  entityId: string | null | undefined,
): boolean {
  return isTestEntity(entityId) || isRetentionTestEmail(email);
}

export function formatFristSatzTime(date: Date): string {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} Uhr`;
}

export function deniedFristSatzView(now: Date): FristSatzView {
  return {
    ...initialFristSatzView,
    ran: true,
    done: true,
    at: formatFristSatzTime(now),
    note: "Keine Berechtigung.",
  };
}

const DURATION =
  /\b(\d+|acht|sechs|sieben|fuenf|fünf|drei|vier|zwei|elf|zwölf|zwoelf|zehn)\s+jahre\b/i;

/**
 * Buchungsbeleg(e) directly tied to ten years in the same comma/semicolon clause.
 * A later clause may still give books or records ten years. A single line break
 * is a wrap, not a new sentence. Each field value is checked on its own.
 */
export function textHasOutdatedBuchungsfrist(text: string): boolean {
  const prepared = text.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
  const chunks = prepared.split(/\n{2,}|(?<=[.!?])(?:[ \t]+|\n+)/);
  return chunks.some((chunk) => {
    const sentence = chunk.replace(/\s+/g, " ").trim();
    if (!sentence) return false;
    return sentence.split(/[,;]/).some((clause) => clauseLinksTenYears(clause));
  });
}

function clauseLinksTenYears(clause: string): boolean {
  const subject = /\bbuchungsbelege?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = subject.exec(clause))) {
    const after = clause.slice(match.index + match[0].length);
    const duration = DURATION.exec(after);
    if (!duration || duration.index > PHRASE_GAP) continue;
    const token = duration[1].toLowerCase();
    if (token === "10" || token === "zehn") return true;
  }
  return false;
}

/** Walk string leaves. Identity fields are not part of the sentence. */
export function jsonTextHasOutdatedBuchungsfrist(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return valueHasPhrase(JSON.parse(trimmed) as unknown);
    } catch {
      return textHasOutdatedBuchungsfrist(trimmed);
    }
  }
  return textHasOutdatedBuchungsfrist(trimmed);
}

function valueHasPhrase(value: unknown, key?: string): boolean {
  if (key && SKIP_KEYS.has(key)) return false;
  if (typeof value === "string") return textHasOutdatedBuchungsfrist(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => valueHasPhrase(item));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([childKey, child]) =>
      valueHasPhrase(child, childKey),
    );
  }
  return false;
}

function freshProgress(): FristProgress {
  return {
    phase: "drafts",
    draftCursor: "",
    offset: 0,
    drafts: 0,
    pdfs: 0,
    checked: 0,
    pdfRead: 0,
    pdfUnreadable: 0,
    structuredUnread: 0,
    draftUnread: 0,
    draftsUnavailable: false,
    docsUnavailable: false,
    paused: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function num(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) return null;
  return value;
}

export function encodeFristProgress(progress: FristProgress): string {
  const payload = {
    phase: progress.phase,
    draftCursor: progress.draftCursor,
    offset: progress.offset,
    drafts: progress.drafts,
    pdfs: progress.pdfs,
    checked: progress.checked,
    pdfRead: progress.pdfRead,
    pdfUnreadable: progress.pdfUnreadable,
    structuredUnread: progress.structuredUnread,
    draftUnread: progress.draftUnread,
    draftsUnavailable: progress.draftsUnavailable,
    docsUnavailable: progress.docsUnavailable,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFristProgress(raw: string): FristProgress | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.length > 4_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const phase = record.phase;
  if (phase !== "drafts" && phase !== "docs" && phase !== "done") return null;
  const draftCursor = record.draftCursor;
  if (typeof draftCursor !== "string" || draftCursor.length > 2_000 || /[\u0000-\u001f]/.test(draftCursor)) {
    return null;
  }
  const keys = [
    "offset",
    "drafts",
    "pdfs",
    "checked",
    "pdfRead",
    "pdfUnreadable",
    "structuredUnread",
    "draftUnread",
  ] as const;
  const values: Record<(typeof keys)[number], number> = {
    offset: 0,
    drafts: 0,
    pdfs: 0,
    checked: 0,
    pdfRead: 0,
    pdfUnreadable: 0,
    structuredUnread: 0,
    draftUnread: 0,
  };
  for (const key of keys) {
    const value = num(record[key]);
    if (value === null) return null;
    values[key] = value;
  }
  if (typeof record.draftsUnavailable !== "boolean" || typeof record.docsUnavailable !== "boolean") return null;
  return {
    phase,
    draftCursor,
    offset: values.offset,
    drafts: values.drafts,
    pdfs: values.pdfs,
    checked: values.checked,
    pdfRead: values.pdfRead,
    pdfUnreadable: values.pdfUnreadable,
    structuredUnread: values.structuredUnread,
    draftUnread: values.draftUnread,
    draftsUnavailable: record.draftsUnavailable,
    docsUnavailable: record.docsUnavailable,
    paused: false,
  };
}

function applyDraft(progress: FristProgress, body: unknown): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    progress.draftUnread += 1;
    progress.checked += 1;
    return;
  }
  const record = body as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email : "";
  const entityId = typeof record.entityId === "string" ? record.entityId : "";
  if (isExcludedCustomer(email, entityId)) return;
  progress.checked += 1;
  if (valueHasPhrase({ answers: record.answers, change: record.change })) progress.drafts += 1;
}

async function applyVersion(progress: FristProgress, item: VersionRef): Promise<void> {
  if (isExcludedCustomer(item.email, item.entityId)) return;
  progress.checked += 1;
  try {
    if (item.hasStructured) {
      const texts = await item.readStructured();
      if (texts == null) {
        progress.structuredUnread += 1;
        return;
      }
      if (texts.some((text) => jsonTextHasOutdatedBuchungsfrist(text))) progress.pdfs += 1;
      return;
    }
    const text = await item.readPdf();
    if (text == null) {
      progress.pdfUnreadable += 1;
      return;
    }
    if (!text.trim()) return;
    progress.pdfRead += 1;
    if (textHasOutdatedBuchungsfrist(text)) progress.pdfs += 1;
  } catch {
    if (item.hasStructured) progress.structuredUnread += 1;
    else progress.pdfUnreadable += 1;
  }
}

function buildNote(progress: FristProgress, done: boolean): string {
  const parts = ["Testfirmen und Testadressen sind ausgenommen."];
  if (progress.draftsUnavailable) {
    parts.push("Der Entwurfsspeicher ist nicht eingerichtet. Entwürfe wurden nicht gelesen.");
  }
  if (progress.docsUnavailable) {
    parts.push("Die Tabelle ist nicht eingerichtet. Dokumentfassungen wurden nicht gelesen.");
  }
  if (progress.paused) {
    parts.push(
      "Die Zählung pausiert, weil der Speicher oder die Tabelle kurz nicht erreichbar war. Fortsetzen liest weiter. Es wird nichts geschrieben.",
    );
  } else if (!done) {
    parts.push("Zwischenstand. Fortsetzen liest den nächsten Abschnitt.");
  }
  if (progress.pdfRead > 0) {
    const one = progress.pdfRead === 1;
    parts.push(
      `${progress.pdfRead} ${one ? "Fassung hatte" : "Fassungen hatten"} keinen Antwort- oder Kapiteltext. Der Wortlaut wurde aus der PDF gelesen.`,
    );
  }
  if (progress.pdfUnreadable > 0) {
    const one = progress.pdfUnreadable === 1;
    parts.push(
      `${progress.pdfUnreadable} ${one ? "Fassung lag" : "Fassungen lagen"} nur als PDF vor, der Text ließ sich nicht lesen. ${one ? "Sie zählt" : "Sie zählen"} nicht als Treffer.`,
    );
  }
  if (progress.structuredUnread > 0) {
    const one = progress.structuredUnread === 1;
    parts.push(
      `${progress.structuredUnread} ${one ? "Fassung hatte" : "Fassungen hatten"} gespeicherten Text, der sich nicht lesen ließ. ${one ? "Sie zählt" : "Sie zählen"} nicht als Treffer.`,
    );
  }
  if (progress.draftUnread > 0) {
    const one = progress.draftUnread === 1;
    parts.push(
      `${progress.draftUnread} ${one ? "Entwurf ließ" : "Entwürfe ließen"} sich nicht lesen. ${one ? "Er zählt" : "Sie zählen"} nicht als Treffer.`,
    );
  }
  if (done && !progress.paused && !progress.draftsUnavailable && !progress.docsUnavailable) {
    parts.push("Die Zählung ist durch.");
  }
  return parts.join(" ");
}

function toView(progress: FristProgress, now: Date, done: boolean): FristSatzView {
  return {
    ran: true,
    drafts: progress.drafts,
    pdfs: progress.pdfs,
    checked: progress.checked,
    at: formatFristSatzTime(now),
    done,
    cursor: done ? "" : encodeFristProgress(progress),
    note: buildNote(progress, done),
  };
}

export async function runFristSatzScan(options: {
  progress: FristProgress | null;
  io: FristSatzIo;
  now: Date;
  budgetMs?: number;
  draftLimit?: number;
  versionLimit?: number;
  clock?: () => number;
}): Promise<FristSatzView> {
  const clock = options.clock ?? Date.now;
  const started = clock();
  const budget = options.budgetMs ?? FRIST_BUDGET_MS;
  const draftLimit = clamp(options.draftLimit ?? FRIST_DRAFT_PAGE, 1, 20);
  const versionLimit = clamp(options.versionLimit ?? FRIST_VERSION_PAGE, 1, 20);
  const expired = () => clock() - started >= budget;
  const progress = options.progress ? { ...options.progress, paused: false } : freshProgress();
  if (progress.phase === "done") return toView(progress, options.now, true);

  let draftPages = 0;
  while (progress.phase === "drafts" && !progress.paused && !expired() && draftPages < MAX_DRAFT_PAGES) {
    draftPages += 1;
    const page = await options.io.listDrafts(progress.draftCursor || undefined, draftLimit);
    if ("paused" in page) {
      progress.paused = true;
      break;
    }
    if ("unavailable" in page) {
      progress.draftsUnavailable = true;
      progress.phase = "docs";
      progress.draftCursor = "";
      progress.offset = 0;
      break;
    }
    for (const pathname of page.pathnames) {
      let body: unknown = null;
      try {
        body = await options.io.readDraft(pathname);
      } catch {
        body = null;
      }
      applyDraft(progress, body);
    }
    if (page.nextCursor) progress.draftCursor = page.nextCursor;
    else {
      progress.phase = "docs";
      progress.draftCursor = "";
      progress.offset = 0;
    }
  }

  let versionPages = 0;
  while (progress.phase === "docs" && !progress.paused && !expired() && versionPages < MAX_VERSION_PAGES) {
    versionPages += 1;
    const page = await options.io.loadVersions(progress.offset, versionLimit);
    if ("paused" in page) {
      progress.paused = true;
      break;
    }
    if ("unavailable" in page) {
      progress.docsUnavailable = true;
      progress.phase = "done";
      break;
    }
    let processed = 0;
    for (const item of page.items) {
      if (processed > 0 && expired()) break;
      await applyVersion(progress, item);
      processed += 1;
    }
    progress.offset += processed;
    if (processed === page.items.length && page.done) progress.phase = "done";
  }

  const done = progress.phase === "done" && !progress.paused;
  return toView(progress, options.now, done);
}

export async function scanFristSatzForAdmin(
  email: string | null | undefined,
  form: { mode: string; cursor: string },
  io: FristSatzIo,
  now: Date,
  limits?: {
    budgetMs?: number;
    draftLimit?: number;
    versionLimit?: number;
    clock?: () => number;
  },
): Promise<FristSatzView> {
  if (!isAmpelAdminEmail(email)) return deniedFristSatzView(now);
  const progress = form.mode === "start" ? null : decodeFristProgress(form.cursor);
  return runFristSatzScan({
    progress,
    io,
    now,
    budgetMs: limits?.budgetMs,
    draftLimit: limits?.draftLimit,
    versionLimit: limits?.versionLimit,
    clock: limits?.clock,
  });
}
