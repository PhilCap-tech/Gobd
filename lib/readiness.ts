import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { stripFrontmatter, writeMarkdownish } from "@/lib/pdf-markdown";
import {
  isReadinessBelegweg,
  resolveReadinessBranche,
  readinessBrancheLabel,
  type ReadinessBelegweg,
  type ReadinessBrancheId,
} from "@/lib/readiness-options";
import { emailsEqual } from "@/lib/types";

export {
  isReadinessBelegweg,
  isReadinessBrancheId,
  READINESS_BELEGWEGE,
  READINESS_BRANCHEN,
  resolveReadinessBranche,
  readinessBrancheLabel,
  type ReadinessBelegweg,
  type ReadinessBrancheId,
} from "@/lib/readiness-options";

export type ReadinessAnswers = {
  branche: ReadinessBrancheId;
  brancheFreitext: string;
  rechtsform: string;
  mitarbeitende: string;
  belegweg: ReadinessBelegweg;
  software: string;
  verantwortliche: string;
};

export type ReadinessLead = {
  timestamp: string;
  leadId: string;
  accessToken: string;
  name: string;
  email: string;
  company: string;
  branche: string;
  brancheFreitext: string;
  rechtsform: string;
  mitarbeitende: string;
  belegweg: string;
  software: string;
  verantwortliche: string;
  status: string;
  pdfUrl: string;
  mailStatus: string;
};

export const READINESS_SHEET_COLUMNS = [
  "timestamp",
  "lead_id",
  "access_token",
  "name",
  "email",
  "company",
  "branche",
  "branche_freitext",
  "rechtsform",
  "mitarbeitende",
  "belegweg",
  "software",
  "verantwortliche",
  "status",
  "pdf_url",
  "mail_status",
] as const;

export type ReadinessSheetColumn = (typeof READINESS_SHEET_COLUMNS)[number];

export const READINESS_SHEET_COLUMN_FIELDS = {
  timestamp: "timestamp",
  lead_id: "leadId",
  access_token: "accessToken",
  name: "name",
  email: "email",
  company: "company",
  branche: "branche",
  branche_freitext: "brancheFreitext",
  rechtsform: "rechtsform",
  mitarbeitende: "mitarbeitende",
  belegweg: "belegweg",
  software: "software",
  verantwortliche: "verantwortliche",
  status: "status",
  pdf_url: "pdfUrl",
  mail_status: "mailStatus",
} as const satisfies Record<ReadinessSheetColumn, keyof ReadinessLead>;

export function emptyReadinessLead(): ReadinessLead {
  return {
    timestamp: "",
    leadId: "",
    accessToken: "",
    name: "",
    email: "",
    company: "",
    branche: "",
    brancheFreitext: "",
    rechtsform: "",
    mitarbeitende: "",
    belegweg: "",
    software: "",
    verantwortliche: "",
    status: "",
    pdfUrl: "",
    mailStatus: "",
  };
}

export function createReadinessAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newReadinessLeadId(): string {
  return randomUUID();
}

export function formatReadinessDate(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function applyReadinessPlaceholders(
  markdown: string,
  values: { Branche: string; Firma: string; Datum: string },
): string {
  return markdown.replace(
    /\{\{\s*(Branche|Firma|Datum)\s*\}\}/g,
    (_, key: keyof typeof values) => values[key],
  );
}

function moduleFileName(id: ReadinessBrancheId): string {
  return `${id}.md`;
}

export function readinessContentDir(): string {
  return path.join(process.cwd(), "content", "readiness");
}

export async function loadReadinessModuleMarkdown(
  branche: string,
): Promise<{ id: ReadinessBrancheId; body: string }> {
  const id = resolveReadinessBranche(branche);
  const file = path.join(readinessContentDir(), moduleFileName(id));
  try {
    const raw = await readFile(file, "utf8");
    return { id, body: stripFrontmatter(raw).trim() };
  } catch (error) {
    if (id !== "allgemein") {
      console.warn("[readiness] Modul fehlt — falle auf allgemein zurück", file, error);
      return loadReadinessModuleMarkdown("allgemein");
    }
    throw error;
  }
}

export function readinessFirmaLabel(company: string): string {
  const trimmed = company.trim();
  return trimmed || "dein Unternehmen";
}

export function renderReadinessMarkdown(lead: Pick<
  ReadinessLead,
  "branche" | "company"
> & { markdown: string }): string {
  return applyReadinessPlaceholders(lead.markdown, {
    Branche: readinessBrancheLabel(lead.branche),
    Firma: readinessFirmaLabel(lead.company),
    Datum: formatReadinessDate(),
  });
}

export async function generateReadinessPdf(lead: Pick<
  ReadinessLead,
  "branche" | "company" | "leadId"
>): Promise<{ buffer: Buffer; brancheId: ReadinessBrancheId; title: string }> {
  const { id, body } = await loadReadinessModuleMarkdown(lead.branche);
  const title = `GoBD-Grundlagen für ${readinessBrancheLabel(id)}`;
  const markdown = renderReadinessMarkdown({
    ...lead,
    branche: id,
    markdown: body,
  });

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: title,
        Author: "GoBD Verfahrensdoku",
        Subject: "Readiness-Arbeitshilfe — kein Steuerberatungsersatz",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.lineGap(2.2);
    writeMarkdownish(doc, markdown, 480, 1.35);
    doc.end();
  });

  console.info("[readiness] pdf", {
    leadId: lead.leadId,
    branche: id,
    bytes: buffer.length,
  });

  return { buffer, brancheId: id, title };
}

export function readinessPdfDownloadName(lead: Pick<ReadinessLead, "branche" | "company">): string {
  const branche = readinessBrancheLabel(lead.branche)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  const company = lead.company
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return company
    ? `GoBD-Grundlagen-${branche}-${company}.pdf`
    : `GoBD-Grundlagen-${branche}.pdf`;
}

export function readinessSheetValues(
  lead: ReadinessLead,
  header: readonly string[] = READINESS_SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field = READINESS_SHEET_COLUMN_FIELDS[col as ReadinessSheetColumn];
    return field ? lead[field] : "";
  });
}

export function parseReadinessLead(header: string[], values: string[]): ReadinessLead {
  const lead = emptyReadinessLead();
  header.forEach((col, index) => {
    const key = col.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const field =
      READINESS_SHEET_COLUMN_FIELDS[key as ReadinessSheetColumn] ??
      READINESS_SHEET_COLUMN_FIELDS[col as ReadinessSheetColumn];
    if (field) {
      lead[field] = String(values[index] ?? "").trim();
    }
  });
  return lead;
}

export function coerceReadinessLead(value: unknown): ReadinessLead | null {
  if (!value || typeof value !== "object") return null;
  return { ...emptyReadinessLead(), ...(value as Partial<ReadinessLead>) };
}

export function toReadinessLead(input: {
  name: string;
  email: string;
  company: string;
  answers: ReadinessAnswers;
  leadId: string;
  accessToken: string;
  pdfUrl?: string;
  mailStatus?: string;
}): ReadinessLead {
  return {
    timestamp: new Date().toISOString(),
    leadId: input.leadId,
    accessToken: input.accessToken,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company.trim(),
    branche: input.answers.branche,
    brancheFreitext: input.answers.brancheFreitext.trim(),
    rechtsform: input.answers.rechtsform.trim(),
    mitarbeitende: input.answers.mitarbeitende.trim(),
    belegweg: input.answers.belegweg,
    software: input.answers.software.trim(),
    verantwortliche: input.answers.verantwortliche.trim(),
    status: "readiness_submitted",
    pdfUrl: input.pdfUrl ?? "",
    mailStatus: input.mailStatus ?? "",
  };
}

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function canAccessReadinessLead(
  lead: Pick<ReadinessLead, "email" | "accessToken">,
  access: { email?: string | null; token?: string | null },
): boolean {
  const email = access.email?.trim() ?? "";
  if (email && emailsEqual(email, lead.email)) return true;
  const token = access.token?.trim() ?? "";
  if (token && lead.accessToken && tokensEqual(token, lead.accessToken)) {
    return true;
  }
  return false;
}

export function readinessDownloadPath(leadId: string, token?: string): string {
  const base = `/api/readiness/${encodeURIComponent(leadId)}/download`;
  if (!token) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function readinessSuccessPath(leadId: string, token: string): string {
  const params = new URLSearchParams({ lead_id: leadId, token });
  return `/readiness/success?${params}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseReadinessRequest(body: unknown):
  | { ok: true; name: string; email: string; company: string; answers: ReadinessAnswers }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Ungültige Anfrage" };
  }
  const v = body as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.trim() : "";
  const email = typeof v.email === "string" ? v.email.trim() : "";
  const company = typeof v.company === "string" ? v.company.trim() : "";
  if (!name) return { ok: false, error: "Name fehlt." };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "Gültige E-Mail fehlt." };

  const branche = resolveReadinessBranche(
    typeof v.branche === "string" ? v.branche : "",
  );
  if (!v.branche || typeof v.branche !== "string") {
    return { ok: false, error: "Branche fehlt." };
  }
  const belegweg = typeof v.belegweg === "string" ? v.belegweg.trim() : "";
  if (!isReadinessBelegweg(belegweg)) {
    return { ok: false, error: "Belegweg fehlt." };
  }
  const rechtsform = typeof v.rechtsform === "string" ? v.rechtsform.trim() : "";
  const mitarbeitende =
    typeof v.mitarbeitende === "string" ? v.mitarbeitende.trim() : "";
  if (!rechtsform || !mitarbeitende) {
    return { ok: false, error: "Größe und Rechtsform fehlen." };
  }

  return {
    ok: true,
    name,
    email,
    company,
    answers: {
      branche,
      brancheFreitext:
        typeof v.brancheFreitext === "string" ? v.brancheFreitext : "",
      rechtsform,
      mitarbeitende,
      belegweg,
      software: typeof v.software === "string" ? v.software : "",
      verantwortliche:
        typeof v.verantwortliche === "string" ? v.verantwortliche : "",
    },
  };
}
