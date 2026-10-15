/**
 * Kanzlei-Merkblatt: download without a mail, DOI only with the checkbox,
 * blocklist, and no automatic deletion.
 *
 *   npx tsx scripts/check-kanzlei-merkblatt.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AMPEL_CONFIRM_WINDOW_MS } from "@/lib/ampel";
import { AMPEL_PRIVACY_PARAGRAPHS } from "@/lib/ampel-questions";
import {
  KANZLEI_CONSENT_TEXT_VERSION,
  KANZLEI_DOI_PREHEADER,
  KANZLEI_DOI_SUBJECT,
  KANZLEI_EMAIL_HINT,
  KANZLEI_MAIL_FOOTER,
  KANZLEI_MERKBLATT_FILENAME,
  KANZLEI_OPT_IN,
  KANZLEI_PRIVACY_PARAGRAPHS,
  KANZLEI_SUBMIT_LABEL,
} from "@/lib/kanzlei-copy";
import { confirmKanzleiDoi } from "@/lib/kanzlei-confirm";
import { redactKanzleiLead } from "@/lib/kanzlei-lead";
import { buildKanzleiDoiMail, kanzleiUnsubscribeFooterLine, kanzleiUnsubscribeUrl } from "@/lib/kanzlei-mail";
import { submitKanzleiMerkblatt } from "@/lib/kanzlei-submit";
import { createKanzleiDoiToken, KANZLEI_DOI_TTL_MS, verifyKanzleiDoiToken } from "@/lib/kanzlei-token";
import { withdrawKanzleiMarketing } from "@/lib/kanzlei-unsubscribe";
import { createMemoryAmpelRateStore } from "@/lib/ampel-rate-limit";
import type { MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";

function fail(message: string): never {
  console.error(`check-kanzlei-merkblatt: ${message}`);
  process.exit(1);
}

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const now = Date.parse("2026-10-15T10:00:00.000Z");
const allowedLiveRecipient = "delivered@resend.dev";

function store() {
  const leads = new Map<string, ReadinessLead>();
  const sent: string[] = [];
  return {
    leads,
    sent,
    deps() {
      return {
        now: () => now,
        store: createMemoryAmpelRateStore(),
        listLeads: async (email: string) =>
          [...leads.values()].filter((lead) => lead.email === email),
        saveLead: async (lead: ReadinessLead) => {
          leads.set(lead.leadId, { ...lead });
        },
        sendDoi: async (input: { email: string; token: string }) => {
          assertOk(input.email === allowedLiveRecipient, "DOI mail stays on the Resend test inbox");
          sent.push(input.email);
          return { stub: false, sent: true, id: "doi" } as MailResult;
        },
      };
    },
  };
}

async function main() {
const plain = await submitKanzleiMerkblatt(
  { email: "Kanzlei@Example.com", optin: false, honeypot: "", ip: "203.0.113.8" },
  store().deps(),
);
assertOk(plain.ok && plain.downloadUrl.endsWith("/pdf") && plain.mailed === false, "without the checkbox there is no mail");

const box = store();
const opted = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.9" },
  box.deps(),
);
assertOk(opted.ok && opted.mailed === true && box.sent.length === 1, "the checkbox sends exactly one DOI mail");
const saved = [...box.leads.values()][0];
assertOk(saved != null, "the opt-in row is stored");
assertOk(saved.marketingOptIn === "pending" && saved.consentAt && saved.consentIp === "203.0.113.9", "consent time and IP are stored");
assertOk(saved.consentTextVersion === KANZLEI_CONSENT_TEXT_VERSION, "consent text version is 2026-10-15");
assertOk(saved.name === "" && saved.company === "" && !("kanzleiName" in saved), "no firm name is stored");
assertOk(saved.leadId.startsWith("kanzlei-"), "the lead id uses the kanzlei prefix");

const form = readFileSync("app/steuerberater/merkblatt-form.tsx", "utf8");
assertOk(form.includes("useState(false)") && !form.includes("defaultChecked"), "the checkbox starts unchecked");
assertOk(!form.includes("required") || form.includes('type="email"'), "email stays required");
assertOk(!/optin[\s\S]{0,80}required/.test(form), "the checkbox is not required");
assertOk(!form.includes("Kanzleiname") && !form.includes("kanzleiName"), "the form has no firm-name field");

const route = readFileSync("app/api/kanzlei-merkblatt/route.ts", "utf8");
assertOk(route.includes("fax_number") && !route.includes("kanzleiName") && !route.includes("Kanzleiname"), "the API schema has no firm name");

const failedSave = store();
const stillDownloads = await submitKanzleiMerkblatt(
  { email: "plain@example.com", optin: false, honeypot: "", ip: "203.0.113.10" },
  {
    ...failedSave.deps(),
    saveLead: async () => {
      throw new Error("sheet");
    },
  },
);
assertOk(stillDownloads.ok && stillDownloads.mailed === false, "a failed save still returns the download");

const token = createKanzleiDoiToken(
  { email: allowedLiveRecipient, consentAt: saved.consentAt, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION },
  now,
);
assertOk(token, "DOI token");
assertOk(verifyKanzleiDoiToken(token, now + KANZLEI_DOI_TTL_MS + 1) == null, "an expired token is rejected");
assertOk(verifyKanzleiDoiToken(`${token}x`, now) == null, "a tampered token is rejected");
assertOk(KANZLEI_DOI_TTL_MS === 48 * 60 * 60 * 1000, "the DOI link lasts 48 hours");

const confirmed = await confirmKanzleiDoi(token ?? "", {
  now: () => now,
  findLead: async (id) => box.leads.get(id) ?? null,
  saveLead: async (lead) => {
    box.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(confirmed.ok && box.leads.get(saved.leadId)?.marketingOptIn === "confirmed", "confirmation stores the opt-in");
assertOk(box.leads.get(saved.leadId)?.doiConfirmedAt, "confirmation stores the time");

const unsub = kanzleiUnsubscribeUrl(allowedLiveRecipient, saved.consentAt);
const unsubToken = new URL(unsub).searchParams.get("token") ?? "";
const withdrawn = await withdrawKanzleiMarketing(unsubToken, {
  now: () => now,
  list: async () => [...box.leads.values()],
  save: async (lead) => {
    box.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(withdrawn.ok && box.leads.get(saved.leadId)?.marketingOptIn === "withdrawn", "unsubscribe sets withdrawn");
assertOk(box.leads.get(saved.leadId)?.email === allowedLiveRecipient, "the blocklist row keeps the address");

const afterBlock = store();
afterBlock.leads.set(saved.leadId, { ...box.leads.get(saved.leadId)! });
const blocked = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.12" },
  afterBlock.deps(),
);
assertOk(blocked.ok && blocked.mailed === false && afterBlock.sent.length === 0, "a withdrawn address gets no further DOI mail");

const mail = buildKanzleiDoiMail({ confirmUrl: "https://www.gobd-doku-erstellen.de/steuerberater/merkblatt/bestaetigen?token=abc" });
assertOk(mail.subject === KANZLEI_DOI_SUBJECT, "DOI subject");
assertOk(mail.preheader === KANZLEI_DOI_PREHEADER, "DOI preheader");
assertOk(mail.text.includes(KANZLEI_MAIL_FOOTER) && mail.html.includes("Sitz der Gesellschaft: Monheim am Rhein"), "mail footer names the registered office");
assertOk(mail.html.includes("datenschutz#kanzlei-merkblatt") && mail.html.includes("Impressum"), "mail footer links impressum and privacy");
assertOk(!mail.html.includes("/abmelden") && !mail.text.includes("Abmelden:"), "the DOI mail has no unsubscribe link");
assertOk(!mail.html.includes("149") && !mail.html.includes("/checkout") && !mail.text.includes("149"), "the DOI mail has no price and no product button");
assertOk(mail.text.includes("Anmeldung bestätigen:"), "plain text spells out the confirm link");
assertOk(mail.text.includes("höchstens zweimal im Monat"), "the mail states the monthly cap");
assertOk(mail.html.includes("bereits direkt auf der Seite heruntergeladen"), "the mail says the download already happened");
assertOk(!mail.html.includes("Webinar") && !mail.text.includes("Webinar"), "the mail says Veranstaltungen, not Webinare");
const footerLine = kanzleiUnsubscribeFooterLine("https://example.test/ab");
assertOk(footerLine.startsWith("Abmelden: Keine Kanzlei-Infos mehr erhalten"), "later mails can use the unsubscribe line");
assertOk(AMPEL_CONFIRM_WINDOW_MS === 15 * 60 * 1000, "DOI dedupe uses the ampel window");

const privacyPage = readFileSync("app/datenschutz/page.tsx", "utf8");
assertOk(privacyPage.includes('id="kanzlei-merkblatt"'), "the privacy heading has the anchor");
const privacy = KANZLEI_PRIVACY_PARAGRAPHS.join("\n");
assertOk(privacy.includes("Einladungen zu Veranstaltungen") && !privacy.includes("Webinar"), "privacy uses Veranstaltungen");
assertOk(privacy.includes("Der Bestätigungslink ist 48 Stunden gültig."), "privacy states the 48-hour confirm link");
assertOk(mail.text.includes("Der Link ist 48 Stunden gültig."), "mail b states the 48-hour confirm link");
assertOk(privacy.includes("Eine automatische Löschung nach einer festen Frist findet nicht statt."), "privacy states there is no automatic deletion");
assertOk(!privacy.includes("[") && !KANZLEI_EMAIL_HINT.includes("[") && !KANZLEI_OPT_IN.includes("["), "kanzlei copy has no bracket markers");
assertOk(!AMPEL_PRIVACY_PARAGRAPHS.join("\n").includes("90 Tage"), "the ampel section no longer says 90 days");
assertOk(readFileSync("content/legal/datenschutz.md", "utf8").includes("**Stand:** 15.10.2026"), "the privacy stand date is the PR date");

const pdfRoute = readFileSync("app/steuerberater/merkblatt/pdf/route.ts", "utf8");
assertOk(pdfRoute.includes("X-Robots-Tag") && pdfRoute.includes("noindex"), "the PDF response is noindex");
assertOk(pdfRoute.includes("KANZLEI_MERKBLATT_FILENAME"), "the download name is the public filename");
assertOk(KANZLEI_MERKBLATT_FILENAME === "kanzlei-merkblatt-verfahrensdokumentation.pdf", "public filename");
const pdf = readFileSync("content/kanzlei-merkblatt.pdf");
assertOk(pdf.subarray(0, 5).toString("utf8") === "%PDF-", "the merkblatt PDF exists");
assertOk(!pdf.toString("latin1").includes("(Entwurf)"), "the PDF title is not marked as a draft");
const merkblatt = readFileSync("content/kanzlei-merkblatt.md", "utf8");
assertOk(merkblatt.startsWith("# Kanzlei-Merkblatt: Verfahrensdokumentation nach GoBD"), "merkblatt title");
assertOk(!merkblatt.includes("Webinar") && !merkblatt.includes("[klären"), "merkblatt has no draft marker and no webinar");

const submitSource = readFileSync("lib/kanzlei-submit.ts", "utf8");
assertOk(!submitSource.includes("redactKanzleiLead") && !submitSource.includes("purge"), "submit does not delete leads");
assertOk(!readFileSync("lib/store.ts", "utf8").includes("purgeExpired"), "no store path purges leads");
const redacted = redactKanzleiLead(saved);
assertOk(redacted.email === "" && redacted !== saved, "manual redaction is a separate function");
assertOk(redactKanzleiLead({ ...saved, marketingOptIn: "withdrawn" }).email === saved.email, "a blocklist row is not redacted");

assertOk(KANZLEI_SUBMIT_LABEL === "Merkblatt herunterladen (PDF)", "button label");
assertOk(!readFileSync("app/steuerberater/page.tsx", "utf8").includes("Kanzleiname"), "the partner page has no firm-name field for the magnet");

console.log("check-kanzlei-merkblatt: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
