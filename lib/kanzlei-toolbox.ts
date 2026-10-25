import { createHash, randomBytes } from "node:crypto";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  KANZLEI_TOOLBOX_AUTHORITY_TEXT,
  KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
  KANZLEI_TOOLBOX_TERMS_TEXT,
} from "@/lib/kanzlei-toolbox-copy";

export { KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION };

/** Opaque id. No name, no slug, no domain. */
export const KANZLEI_ID_RE = /^k_[a-f0-9]{16}$/;

/** Public slug: a name fragment plus 4 random characters. */
export const KANZLEI_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{4}$/;

export const KANZLEI_TOOLBOX_STATUSES = [
  "pending_doi",
  "pending",
  "verified",
  "declined",
  "removed",
  "blocked",
] as const;

export type KanzleiToolboxStatus = (typeof KANZLEI_TOOLBOX_STATUSES)[number];

export type KanzleiDevice = "mobile" | "desktop";

export type KanzleiCountKind = "redirect" | "start" | "complete";

export type KanzleiVerification = {
  emailDomain: string;
  websiteDomain: string;
  domainsMatch: boolean;
  freemail: boolean;
  impressumUrl: string;
  impressumReachable: boolean;
  nameInImpressum: boolean;
  /** Set only by a person after a single lookup. Never by an automatic fetch. */
  verzeichnisChecked: boolean;
  impressumManual: boolean;
  checkedAt: string;
  note: string;
};

export type KanzleiToolboxRecord = {
  kanzleiId: string;
  slug: string;
  displayName: string;
  website: string;
  email: string;
  city: string;
  status: KanzleiToolboxStatus;
  test: boolean;
  registeredAt: string;
  doiConfirmedAt: string;
  verifiedAt: string;
  removedAt: string;
  reportOptIn: boolean;
  consentAt: string;
  consentText: string;
  consentTextVersion: string;
  authorityConfirmed: boolean;
  termsAccepted: boolean;
  verification: KanzleiVerification;
};

export type KanzleiCountRow = {
  date: string;
  kanzleiId: string;
  device: KanzleiDevice;
  kind: KanzleiCountKind;
  n: number;
};

export type KanzleiAttribution = {
  leadId: string;
  kanzleiId: string;
  at: string;
};

export type KanzleiConsentProof = {
  kanzleiId: string;
  consentText: string;
  consentTextVersion: string;
  registeredAt: string;
  doiConfirmedAt: string;
  revokedAt: string;
};

export type KanzleiBlockEntry = {
  domain: string;
  kanzleiId: string;
  reason: string;
  at: string;
};

/** Deletion log. Count, kind and date only. No name, e-mail, slug or token. */
export const KANZLEI_PURGE_KINDS = ["pending_doi", "contact", "consent_proof", "blocklist", "attribution", "count"] as const;

export type KanzleiPurgeKind = (typeof KANZLEI_PURGE_KINDS)[number];

export type KanzleiPurgeLogRow = {
  date: string;
  kind: KanzleiPurgeKind;
  n: number;
};

export type KanzleiPurgeResult = {
  changed: boolean;
  deleted: KanzleiPurgeLogRow[];
};

/**
 * Prepared Google Sheet tab `kanzlei_toolbox`. Stays off until this is set
 * to true after approval. While false, no sheet call is made.
 */
export const KANZLEI_TOOLBOX_SHEET_ENABLED = false;

export type KanzleiToolboxFile = {
  records: KanzleiToolboxRecord[];
  reservedSlugs: string[];
  /** Domains that already completed double opt-in. Further slugs are manual. */
  domainLocks: string[];
  counts: KanzleiCountRow[];
  attributions: KanzleiAttribution[];
  consentProofs: KanzleiConsentProof[];
  blocklist: KanzleiBlockEntry[];
  purgeLog: KanzleiPurgeLogRow[];
};

export const KANZLEI_RETENTION = {
  contactDays: 30,
  unconfirmedDays: 30,
  attributionMonths: 12,
  aggregateMonths: 24,
  blockYears: 3,
  consentYears: 3,
  reportMinimum: 5,
} as const;

const FREEMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "web.de",
  "yahoo.com",
  "yahoo.de",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "t-online.de",
  "posteo.de",
  "mailbox.org",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "freenet.de",
  "arcor.de",
  "online.de",
]);

const NAME_BLOCK = ["finanzamt", "kammer", "datev", "ikat"] as const;

const NAME_ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} &.'-]{0,79}$/u;

export function emptyKanzleiVerification(): KanzleiVerification {
  return {
    emailDomain: "",
    websiteDomain: "",
    domainsMatch: false,
    freemail: false,
    impressumUrl: "",
    impressumReachable: false,
    nameInImpressum: false,
    verzeichnisChecked: false,
    impressumManual: false,
    checkedAt: "",
    note: "",
  };
}

export function emptyKanzleiFile(): KanzleiToolboxFile {
  return {
    records: [],
    reservedSlugs: [],
    domainLocks: [],
    counts: [],
    attributions: [],
    consentProofs: [],
    blocklist: [],
    purgeLog: [],
  };
}

export function newKanzleiId(): string {
  return `k_${randomBytes(8).toString("hex")}`;
}

export function isKanzleiId(value: string): boolean {
  return KANZLEI_ID_RE.test(value);
}

export function isKanzleiSlug(value: string): boolean {
  return KANZLEI_SLUG_RE.test(value);
}

/** Well-formed public slug from a request field. Empty when absent. */
export function kanzleiFlowSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  const slug = value.trim().toLowerCase();
  return isKanzleiSlug(slug) ? slug : "";
}

/** Preview fixture. Not used when VERCEL_ENV is production. No live write. */
export const KANZLEI_PREVIEW_SEED: KanzleiToolboxRecord = {
  kanzleiId: "k_0c0ffee0c0ffee01",
  slug: "musterkanzlei-t3st",
  displayName: "Musterkanzlei Demo",
  website: "https://example.com",
  email: "delivered@resend.dev",
  city: "Monheim am Rhein",
  status: "verified",
  test: true,
  registeredAt: "2026-10-25T00:00:00.000Z",
  doiConfirmedAt: "2026-10-25T00:00:00.000Z",
  verifiedAt: "2026-10-25T00:00:00.000Z",
  removedAt: "",
  reportOptIn: false,
  consentAt: "2026-10-25T00:00:00.000Z",
  consentText: `${KANZLEI_TOOLBOX_AUTHORITY_TEXT} ${KANZLEI_TOOLBOX_TERMS_TEXT}`,
  consentTextVersion: KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
  authorityConfirmed: true,
  termsAccepted: true,
  verification: {
    emailDomain: "example.com",
    websiteDomain: "example.com",
    domainsMatch: true,
    freemail: false,
    impressumUrl: "https://example.com/impressum",
    impressumReachable: true,
    nameInImpressum: true,
    verzeichnisChecked: true,
    impressumManual: true,
    checkedAt: "2026-10-25T00:00:00.000Z",
    note: "Vorschau-Eintrag, keine echte Kanzlei",
  },
};

export function kanzleiPreviewSeedEnabled(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

export function normalizeKanzleiEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  if (email.length > 254 || email.includes(" ") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1) : "";
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL.has(domain.trim().toLowerCase());
}

export function websiteDomain(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeWebsite(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /\s/.test(trimmed)) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return "";
    if (url.username || url.password || url.port) return "";
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host.endsWith(".local") || host === "localhost") return "";
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function normalizeCity(value: unknown): string {
  if (typeof value !== "string") return "";
  const city = value.replace(/\s+/g, " ").trim();
  if (city.length < 2 || city.length > 80) return "";
  if (!/^[\p{L}\p{N} .'-]+$/u.test(city)) return "";
  return city;
}

export function normalizeKanzleiName(value: unknown): string {
  if (typeof value !== "string") return "";
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return "";
  if (/https?:|www\.|@/i.test(name)) return "";
  if (!NAME_ALLOWED.test(name)) return "";
  const folded = name.toLowerCase();
  for (const blocked of NAME_BLOCK) {
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${blocked}(?=$|[^\\p{L}\\p{N}])`, "iu");
    if (pattern.test(folded)) return "";
  }
  return name;
}

/** Picks a public slug that is not already reserved. The draw supplies the random suffix. */
export function allocateKanzleiSlug(
  taken: ReadonlySet<string>,
  name: string,
  draw: (name: string) => string = slugFromName,
): string {
  let slug = draw(name);
  for (let guard = 0; guard < 8 && (taken.has(slug) || !isKanzleiSlug(slug)); guard += 1) {
    slug = draw(name);
  }
  return slug;
}

export function slugFromName(name: string): string {
  const ascii = name
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let suffix = "";
  const bytes = randomBytes(4);
  for (let index = 0; index < 4; index += 1) {
    suffix += alphabet[bytes[index]! % alphabet.length];
  }
  const base = ascii || "kanzlei";
  return `${base}-${suffix}`;
}

export function domainsMatch(email: string, website: string): boolean {
  const left = emailDomain(email);
  const right = websiteDomain(website);
  return Boolean(left && right && left === right);
}

export function nameShown(record: KanzleiToolboxRecord): boolean {
  if (record.status !== "verified" || record.removedAt) return false;
  const check = record.verification;
  const impressum = check.nameInImpressum || check.impressumManual;
  return check.domainsMatch && !check.freemail && impressum && check.verzeichnisChecked;
}

export function consentStatement(): string {
  return `${KANZLEI_TOOLBOX_AUTHORITY_TEXT}\n${KANZLEI_TOOLBOX_TERMS_TEXT}`;
}

export function hashLeadKey(leadId: string, kanzleiId: string): string {
  return createHash("sha256").update(`${leadId}\n${kanzleiId}`).digest("hex").slice(0, 16);
}

export const KANZLEI_SUPPORT_EMAIL = LEGAL_OPERATOR.email;

export function reportValue(count: number): string {
  if (!Number.isInteger(count) || count < KANZLEI_RETENTION.reportMinimum) return "unter 5";
  return String(count);
}

export type KanzleiMonthReport = {
  month: string;
  calls: string;
  starts: string;
  completes: string;
};

export function buildMonthReport(counts: readonly KanzleiCountRow[], kanzleiId: string, month: string): KanzleiMonthReport {
  let calls = 0;
  let starts = 0;
  let completes = 0;
  for (const row of counts) {
    if (row.kanzleiId !== kanzleiId || !row.date.startsWith(month)) continue;
    if (row.kind === "redirect") calls += row.n;
    if (row.kind === "start") starts += row.n;
    if (row.kind === "complete") completes += row.n;
  }
  return {
    month,
    calls: reportValue(calls),
    starts: reportValue(starts),
    completes: reportValue(completes),
  };
}
