import { createHash, randomBytes } from "node:crypto";
import { ampelStepDevice } from "@/lib/ampel-step-event";
import { getAppUrl } from "@/lib/env";
import {
  KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
  consentStatement,
  domainsMatch,
  emailDomain,
  emptyKanzleiVerification,
  isFreemailDomain,
  isKanzleiSlug,
  nameShown,
  allocateKanzleiSlug,
  newKanzleiId,
  normalizeCity,
  normalizeKanzleiEmail,
  normalizeKanzleiName,
  normalizeWebsite,
  websiteDomain,
  type KanzleiToolboxRecord,
} from "@/lib/kanzlei-toolbox";
import {
  buildKanzleiDoiMail,
  buildKanzleiToolboxMail,
  kanzleiToolboxDoiKey,
  kanzleiToolboxKitKey,
  sendKanzleiToolboxMail,
} from "@/lib/kanzlei-toolbox-mail";
import { buildKanzleiMerkblattPdf, kanzleiQrPng } from "@/lib/kanzlei-toolbox-pdf";
import {
  addKanzleiCount,
  domainBlocked,
  domainTaken,
  findKanzleiById,
  findKanzleiBySlug,
  publicKanzleiRecord,
  readKanzleiToolbox,
  updateKanzleiToolbox,
} from "@/lib/kanzlei-toolbox-store";
import { createKanzleiDoiToken, verifyKanzleiDoiToken } from "@/lib/kanzlei-toolbox-token";
import { checkImpressum } from "@/lib/kanzlei-toolbox-verify";
import type { MailResult } from "@/lib/mail";

const salt = randomBytes(16);
const buckets = new Map<string, { start: number; count: number }>();
const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_LIMIT = 5;

export type KanzleiSignupInput = {
  name: unknown;
  website: unknown;
  email: unknown;
  city: unknown;
  authority: unknown;
  terms: unknown;
  report: unknown;
  honeypot: unknown;
  ip: string;
};

export type KanzleiFlowResult =
  | { ok: true; honeypot?: boolean; confirmUrl?: string; mailed?: boolean }
  | { ok: false; error: string };

function rateKey(ip: string): string {
  return createHash("sha256").update(salt).update(ip.trim()).digest("hex");
}

export function takeKanzleiSignupRate(ip: string, now = Date.now()): boolean {
  for (const [key, bucket] of buckets) {
    if (now - bucket.start >= DAY_MS) buckets.delete(key);
  }
  const trimmed = ip.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return false;
  const key = rateKey(trimmed);
  const current = buckets.get(key);
  if (!current || now - current.start >= DAY_MS) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (current.count >= SIGNUP_LIMIT) return false;
  current.count += 1;
  return true;
}

export function clearKanzleiSignupRateForTest(): void {
  buckets.clear();
}

function checked(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

export async function submitKanzleiToolbox(
  input: KanzleiSignupInput,
  deps: { now?: () => number; fetchImpl?: typeof fetch; send?: typeof sendKanzleiToolboxMail } = {},
): Promise<KanzleiFlowResult> {
  if (typeof input.honeypot === "string" ? input.honeypot.trim() : input.honeypot) {
    return { ok: true, honeypot: true };
  }
  const now = deps.now?.() ?? Date.now();
  if (!takeKanzleiSignupRate(input.ip, now)) return { ok: false, error: "Bitte versuchen Sie es später erneut." };
  const displayName = normalizeKanzleiName(input.name);
  const website = normalizeWebsite(input.website);
  const email = normalizeKanzleiEmail(input.email);
  const city = normalizeCity(input.city);
  if (!displayName || !website || !email || !city) return { ok: false, error: "Bitte prüfen Sie Ihre Angaben." };
  if (!checked(input.authority) || !checked(input.terms)) {
    return { ok: false, error: "Bitte bestätigen Sie beide Pflichtangaben." };
  }
  const consentAt = new Date(now).toISOString();
  const record: KanzleiToolboxRecord = {
    kanzleiId: newKanzleiId(),
    slug: "",
    displayName,
    website,
    email,
    city,
    status: "pending_doi",
    test: false,
    registeredAt: consentAt,
    doiConfirmedAt: "",
    verifiedAt: "",
    removedAt: "",
    reportOptIn: checked(input.report),
    consentAt,
    consentText: consentStatement(),
    consentTextVersion: KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
    authorityConfirmed: true,
    termsAccepted: true,
    verification: emptyKanzleiVerification(),
  };
  let blocked = false;
  await updateKanzleiToolbox((file) => {
    if (domainBlocked(file, website) || domainTaken(file, email, website)) {
      blocked = true;
      return;
    }
    const taken = new Set(file.reservedSlugs.concat(file.records.map((item) => item.slug)));
    record.slug = allocateKanzleiSlug(taken, displayName);
    file.records.push(record);
    file.reservedSlugs.push(record.slug);
  });
  if (blocked || !record.slug) {
    return { ok: false, error: "Für diese Website liegt bereits eine Anmeldung vor. Schreiben Sie uns, wenn Sie den Eintrag ändern möchten." };
  }
  const token = createKanzleiDoiToken(
    {
      kanzleiId: record.kanzleiId,
      slug: record.slug,
      displayName: record.displayName,
      website: record.website,
      email: record.email,
      city: record.city,
      consentAt: record.consentAt,
      consentText: record.consentText,
      consentTextVersion: record.consentTextVersion,
      reportOptIn: record.reportOptIn,
    },
    now,
  );
  if (!token) return { ok: false, error: "Die Anmeldung konnte nicht gespeichert werden." };
  const confirmUrl = `${getAppUrl()}/steuerberater/toolbox/bestaetigen?token=${encodeURIComponent(token)}`;
  const mail = buildKanzleiDoiMail(confirmUrl);
  const send = deps.send ?? sendKanzleiToolboxMail;
  const sent = await send({ to: email, ...mail, dedupeKey: kanzleiToolboxDoiKey(record.kanzleiId) });
  const confirmForTest = email === "delivered@resend.dev" && process.env.VERCEL_ENV !== "production" ? confirmUrl : undefined;
  return { ok: true, mailed: sent.sent || sent.stub, ...(confirmForTest ? { confirmUrl: confirmForTest } : {}) };
}

async function applyVerification(
  record: KanzleiToolboxRecord,
  fetchImpl: typeof fetch | undefined,
  nowIso: string,
): Promise<void> {
  const domain = emailDomain(record.email);
  const site = websiteDomain(record.website);
  const freemail = isFreemailDomain(domain);
  const matched = domainsMatch(record.email, record.website);
  const impressum = matched && !freemail ? await checkImpressum(record.website, record.displayName, fetchImpl) : { reachable: false, url: "", nameFound: false };
  record.verification = {
    emailDomain: domain,
    websiteDomain: site,
    domainsMatch: matched,
    freemail,
    impressumUrl: impressum.url,
    impressumReachable: impressum.reachable,
    nameInImpressum: impressum.nameFound,
    verzeichnisChecked: false,
    impressumManual: false,
    checkedAt: nowIso,
    note: matched && !freemail && impressum.nameFound
      ? "Impressum abgeglichen. Verzeichnisprüfung offen."
      : "Automatischer Abgleich nicht bestanden.",
  };
  record.doiConfirmedAt = nowIso;
  if (matched && !freemail && impressum.nameFound) {
    record.status = "pending";
  } else {
    record.status = "declined";
    record.removedAt = nowIso;
  }
}

export async function confirmKanzleiToolbox(
  token: string,
  deps: { now?: () => number; fetchImpl?: typeof fetch; send?: typeof sendKanzleiToolboxMail } = {},
): Promise<
  | { ok: true; status: KanzleiToolboxRecord["status"]; slug: string; displayName: string; mailed: boolean }
  | { ok: false; error: string }
> {
  const now = deps.now?.() ?? Date.now();
  const payload = verifyKanzleiDoiToken(token, now);
  if (!payload) return { ok: false, error: "Der Bestätigungslink ist ungültig oder abgelaufen." };
  const nowIso = new Date(now).toISOString();
  let created = false;
  await updateKanzleiToolbox((file) => {
    let record = file.records.find((item) => item.kanzleiId === payload.kanzleiId);
    if (!record) {
      record = {
        kanzleiId: payload.kanzleiId,
        slug: payload.slug,
        displayName: payload.displayName,
        website: payload.website,
        email: payload.email,
        city: payload.city,
        status: "pending_doi",
        test: false,
        registeredAt: payload.consentAt,
        doiConfirmedAt: "",
        verifiedAt: "",
        removedAt: "",
        reportOptIn: payload.reportOptIn,
        consentAt: payload.consentAt,
        consentText: payload.consentText,
        consentTextVersion: payload.consentTextVersion,
        authorityConfirmed: true,
        termsAccepted: true,
        verification: emptyKanzleiVerification(),
      };
      file.records.push(record);
      if (!file.reservedSlugs.includes(record.slug)) file.reservedSlugs.push(record.slug);
      created = true;
    }
    if (record.doiConfirmedAt) return;
    record.displayName = payload.displayName;
    record.website = payload.website;
    record.email = payload.email;
    record.city = payload.city;
    record.reportOptIn = payload.reportOptIn;
    record.consentText = payload.consentText || record.consentText;
    record.consentTextVersion = payload.consentTextVersion || record.consentTextVersion;
    record.doiConfirmedAt = nowIso;
    created = true;
  });
  const current = findKanzleiById(await readKanzleiToolbox(), payload.kanzleiId);
  if (!current) return { ok: false, error: "Die Anmeldung wurde nicht gefunden." };
  if (created) {
    await applyVerification(current, deps.fetchImpl, nowIso);
    const domain = websiteDomain(current.website);
    await updateKanzleiToolbox((file) => {
      const row = file.records.find((item) => item.kanzleiId === current.kanzleiId);
      if (!row) return;
      Object.assign(row, current);
      if (domain && !file.domainLocks.includes(domain)) file.domainLocks.push(domain);
    });
  }
  const saved = findKanzleiById(await readKanzleiToolbox(), payload.kanzleiId);
  if (!saved) return { ok: false, error: "Die Anmeldung wurde nicht gefunden." };
  let mailed = false;
  if (created) {
    const built = buildKanzleiToolboxMail({
      displayName: saved.displayName,
      slug: saved.slug,
      kanzleiId: saved.kanzleiId,
      verified: nameShown(saved),
      reportOptIn: saved.reportOptIn,
    });
    if (built) {
      const link = `${getAppUrl()}/k/${saved.slug}`;
      const [qr, pdf] = await Promise.all([
        kanzleiQrPng(link),
        buildKanzleiMerkblattPdf({ displayName: saved.displayName, slug: saved.slug, link }),
      ]);
      const send = deps.send ?? sendKanzleiToolboxMail;
      const result: MailResult = await send({
        to: saved.email,
        ...built,
        dedupeKey: kanzleiToolboxKitKey(saved.kanzleiId),
        attachments: [
          { filename: "qr-code.png", content: qr, contentType: "image/png" },
          { filename: "mandanten-merkblatt.pdf", content: pdf, contentType: "application/pdf" },
        ],
      });
      mailed = result.sent || result.stub;
    }
  }
  return { ok: true, status: saved.status, slug: saved.slug, displayName: saved.displayName, mailed };
}

export async function revokeKanzleiToolbox(token: string, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const { verifyKanzleiRevokeToken } = await import("@/lib/kanzlei-toolbox-token");
  const kanzleiId = verifyKanzleiRevokeToken(token);
  if (!kanzleiId) return { ok: false, error: "Der Link ist ungültig." };
  const iso = now.toISOString();
  let found = false;
  await updateKanzleiToolbox((file) => {
    const record = file.records.find((item) => item.kanzleiId === kanzleiId);
    if (!record || record.test) return;
    found = true;
    record.status = "removed";
    record.removedAt = iso;
    record.reportOptIn = false;
  });
  if (!found) return { ok: false, error: "Der Eintrag wurde nicht gefunden." };
  return { ok: true };
}

export async function kanzleiEntryPath(slug: string, userAgent: string, requestUrl: string): Promise<string> {
  const incoming = new URL(requestUrl).searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of incoming.entries()) {
    if (!value || !key.toLowerCase().startsWith("utm_")) continue;
    next.append(key, value);
  }
  const clean = slug.trim().toLowerCase();
  if (!isKanzleiSlug(clean)) return `/ampel-check${next.size ? `?${next}` : ""}`;
  const file = await readKanzleiToolbox();
  const record = publicKanzleiRecord(findKanzleiBySlug(file, clean));
  if (!record) return `/ampel-check${next.size ? `?${next}` : ""}`;
  const device = ampelStepDevice(userAgent);
  await addKanzleiCount({ kanzleiId: record.kanzleiId, kind: "redirect", device });
  next.set("kanzlei", record.slug);
  return `/ampel-check?${next.toString()}`;
}

export async function setKanzleiVerified(kanzleiId: string, input: { verzeichnis: boolean; impressumManual?: boolean }, now = new Date()): Promise<boolean> {
  if (!input.verzeichnis) return false;
  let ok = false;
  await updateKanzleiToolbox((file) => {
    const record = file.records.find((item) => item.kanzleiId === kanzleiId && !item.test);
    if (!record || record.status === "removed" || record.status === "blocked") return;
    if (input.impressumManual) record.verification.impressumManual = true;
    record.verification.verzeichnisChecked = true;
    record.verification.checkedAt = now.toISOString();
    const impressum = record.verification.nameInImpressum || record.verification.impressumManual;
    if (!record.verification.domainsMatch || record.verification.freemail || !impressum) return;
    record.status = "verified";
    record.verifiedAt = now.toISOString();
    record.removedAt = "";
    record.verification.note = "Impressum und Verzeichnis abgeglichen.";
    ok = true;
  });
  return ok;
}

export async function setKanzleiBlocked(kanzleiId: string, reason: string, now = new Date()): Promise<boolean> {
  const iso = now.toISOString();
  let ok = false;
  await updateKanzleiToolbox((file) => {
    const record = file.records.find((item) => item.kanzleiId === kanzleiId && !item.test);
    if (!record) return;
    record.status = "blocked";
    record.removedAt = iso;
    record.reportOptIn = false;
    const domain = websiteDomain(record.website);
    if (domain && !file.blocklist.some((entry) => entry.domain === domain && entry.kanzleiId === record.kanzleiId)) {
      file.blocklist.push({ domain, kanzleiId: record.kanzleiId, reason: reason.slice(0, 200), at: iso });
    }
    ok = true;
  });
  return ok;
}
