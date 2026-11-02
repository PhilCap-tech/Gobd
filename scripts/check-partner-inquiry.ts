/**
 * Kanzlei-Anfrage (/steuerberater): Mandanten-Zahl ist optional (Philip 02.11.2026).
 *   npx tsx scripts/check-partner-inquiry.ts
 */
import { readFileSync } from "node:fs";
import { parsePartnerInquiry } from "@/lib/partner-inquiry";
import { buildPartnerInquiryMail } from "@/lib/ops";

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`check-partner-inquiry: ${message}`);
    process.exit(1);
  }
}

const base = { name: "Erika Muster", kanzlei: "Kanzlei Muster", email: "erika@example.com", message: "Bitte um Rückruf zum Kanzleizugang." };

const empty = parsePartnerInquiry({ ...base, mandantenZahl: "" });
assertOk(empty.ok && !empty.honeypot && empty.inquiry.mandantenZahl === "", "empty Mandanten-Zahl is accepted");
const missing = parsePartnerInquiry({ ...base });
assertOk(missing.ok && !missing.honeypot && missing.inquiry.mandantenZahl === "", "missing Mandanten-Zahl is accepted");
const given = parsePartnerInquiry({ ...base, mandantenZahl: " 40 " });
assertOk(given.ok && !given.honeypot && given.inquiry.mandantenZahl === "40", "a given number is normalised");
assertOk(!parsePartnerInquiry({ ...base, mandantenZahl: "0" }).ok, "0 is rejected");
assertOk(!parsePartnerInquiry({ ...base, mandantenZahl: "viele" }).ok, "text is rejected");
assertOk(!parsePartnerInquiry({ ...base, mandantenZahl: "100001" }).ok, "too large is rejected");
assertOk(!parsePartnerInquiry({ ...base, name: "" }).ok, "name stays required");

if (empty.ok && !empty.honeypot) {
  const mail = buildPartnerInquiryMail(empty.inquiry);
  assertOk(mail.text.includes("Grobe Mandanten-Zahl: keine Angabe"), "ops mail says keine Angabe");
}

const form = readFileSync("app/steuerberater/partner-inquiry-form.tsx", "utf8");
const field = form.slice(form.indexOf('id="partner-mandanten"'), form.indexOf("/>", form.indexOf('id="partner-mandanten"')));
assertOk(!field.includes("required"), "the Mandanten-Zahl input is not required");
assertOk(form.includes("Anfrage senden"), "the submit label stays „Anfrage senden“");

console.log("check-partner-inquiry: ok");
