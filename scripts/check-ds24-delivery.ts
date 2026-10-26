/**
 * DS24-Käufer (Zugang aus lib/digistore24-access.ts) bekommen nach dem
 * Fragebogen die Liefer-Mail und den Anmeldelink wie Stripe-Käufer.
 * Comp-Allowlist bleibt ohne Liefer-Mail. Kein Stripe, keine Mail, kein Netzwerk.
 *
 *   npx tsx scripts/check-ds24-delivery.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const key of ["RESEND_API_KEY", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN", "STRIPE_SECRET_KEY"]) {
  delete process.env[key];
}
const lifecycle = process.env.npm_lifecycle_event ?? "";
if (!lifecycle.startsWith("check:") && lifecycle !== "prebuild" && lifecycle !== "build") {
  process.env.npm_lifecycle_event = "check:ds24-delivery";
}

const DS24 = "ds24-kaeufer@firma.example";
const BLOCKED = "ds24-gesperrt@firma.example";
const COMP = "winkler@winkler-segtrop.de";
const ENTITY = "ent_ds24_delivery";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

async function main(): Promise<void> {
  const { submitIntake } = await import("../app/api/intake/route");
  type IntakeIo = import("../app/api/intake/route").IntakeIo;
  const { SESSION_COOKIE, createSessionToken } = await import("../lib/auth");
  const { emptyAnswers, emptySheetRow } = await import("../lib/types");
  type SheetRow = import("../lib/types").SheetRow;
  const { setMailDedupeTestHooks } = await import("../lib/mail-dedupe");
  const { setOwnerNoticeTestMode } = await import("../lib/owner-notice");
  const { flushLeadNoticesForTests } = await import("../lib/lead-notice");

  // Inhaber-Hinweise nur gestubbt in ein Temp-Ledger, nie echt versendet.
  const noticeDir = mkdtempSync(path.join(tmpdir(), "ds24-delivery-"));
  const notices: { subject: string; text: string }[] = [];
  setMailDedupeTestHooks({
    dir: noticeDir,
    send: async (input) => {
      notices.push({ subject: input.subject, text: input.text });
      return { stub: false, sent: true, id: `stub-${notices.length}` };
    },
  });
  setOwnerNoticeTestMode(true);

  function harness(active: Set<string>) {
    const n = { stripe: 0, customer: 0, delivery: 0, login: 0, pdf: 0 };
    const rows: SheetRow[] = [];
    const deliveries: { email: string; documentId: string; version: number }[] = [];
    const io: IntakeIo = {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
      listEntitiesByEmail: async () => [],
      getOwnedEntity: async () => null,
      findLatestStripeCustomerIdByEmail: async () => {
        n.customer += 1;
        return "";
      },
      findRowByStripeSessionId: async () => null,
      resolveCheckoutSession: async () => {
        n.stripe += 1;
        return { error: "missing" as const };
      },
      ds24Access: async (email) => active.has(email.trim().toLowerCase()),
      prepareDurableIntakeRow: async (row) => row,
      appendRecord: async (row) => {
        const stored = { ...emptySheetRow(), ...row };
        rows.push(stored);
        return { backend: "file", row: stored };
      },
      generatePdf: async (input) => {
        n.pdf += 1;
        return {
          buffer: Buffer.from("%PDF-1.4\n"),
          documentId: input.documentId || "pdf",
          plan: { status: "ready", chapters: [], openItems: [], pdf: null },
        };
      },
      storePdf: async () => ({ url: "", pathname: "memory/ds24.pdf", backend: "file" as const }),
      sendDeliveryMail: async (input) => {
        n.delivery += 1;
        deliveries.push({ email: input.email, documentId: input.documentId ?? "", version: input.version ?? 0 });
        return { stub: true, sent: false, action: "delivery" as const };
      },
      deliverLoginLink: async () => {
        n.login += 1;
        return "sent" as const;
      },
    };
    return { io, n, rows, deliveries };
  }

  const submit = (email: string, io: IntakeIo) =>
    submitIntake(
      new Request("http://localhost/api/intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${createSessionToken(email)}`,
        },
        body: JSON.stringify({ email, company: "Beispiel GmbH", entityId: ENTITY, answers: emptyAnswers() }),
      }),
      io,
    );

  // DS24-Käufer: Liefer-Mail + Anmeldelink wie Stripe-Käufer.
  const ds24 = harness(new Set([DS24]));
  const res = await submit(DS24, ds24.io);
  const body = (await res.json()) as { error?: string; documentId?: string; version?: number; loginMail?: string };
  ok(res.status === 200, `DS24 submit is 200 (got ${res.status} ${body.error ?? ""})`);
  ok(ds24.n.pdf === 1, "DS24 submit generates the PDF");
  ok(ds24.n.delivery === 1, "DS24 submit sends the delivery mail once");
  ok(
    ds24.deliveries[0]?.email === DS24 &&
      ds24.deliveries[0]?.documentId === body.documentId &&
      ds24.deliveries[0]?.version === body.version,
    "the delivery mail goes to the buyer for this document version (dedupe key delivery:<doc>:<version>)",
  );
  ok(ds24.n.login === 1 && body.loginMail === "sent", "DS24 submit sends the login link like a paid buyer");
  ok(ds24.n.stripe === 0 && ds24.n.customer === 0, "DS24 submit does not ask Stripe");
  ok(ds24.rows[0]?.email === DS24 && ds24.rows[0]?.stripeSessionId === "", "the row belongs to the DS24 buyer without a Stripe session");
  await flushLeadNoticesForTests();
  const ds24Notice = notices.find((m) => m.subject.includes("Doku abgeschlossen") && m.text.includes(DS24));
  ok(ds24Notice?.text.includes("Zugang: Digistore24") && !ds24Notice.text.includes("kostenfrei (Comp)"), "the doc owner notice shows Zugang: Digistore24 for DS24 buyers");

  // Gesperrter DS24-Zugang: kein Dokument, keine Mail.
  const blocked = harness(new Set());
  const denied = await submit(BLOCKED, blocked.io);
  ok(denied.status === 401, `a blocked DS24 buyer stays at the checkout gate (got ${denied.status})`);
  ok(blocked.n.pdf === 0 && blocked.n.delivery === 0, "a blocked DS24 buyer gets no PDF and no delivery mail");

  // Comp-Allowlist unverändert: keine Liefer-Mail, kein Anmeldelink.
  const comp = harness(new Set([COMP]));
  const compRes = await submit(COMP, comp.io);
  const compBody = (await compRes.json()) as { loginMail?: string };
  ok(compRes.status === 200 && comp.n.pdf === 1, "comp submit still generates the PDF");
  ok(comp.n.delivery === 0 && comp.n.login === 0 && compBody.loginMail === "skipped", "comp submit still sends no delivery or login mail");
  await flushLeadNoticesForTests();
  const compNotice = notices.find((m) => m.subject.includes("Doku abgeschlossen") && m.text.includes(COMP));
  ok(compNotice?.text.includes("Zugang: kostenfrei (Comp)"), "the doc owner notice still shows Zugang: kostenfrei (Comp) for comp users");
  setOwnerNoticeTestMode(false);
  setMailDedupeTestHooks(null);
  rmSync(noticeDir, { recursive: true, force: true });

  // PDF: Die bedingte Garantie (GELD_ZURUECK_MICRO) steht nur auf der Muster-Upsell-Seite,
  // nie im ausgelieferten Kunden-PDF. Daher keine DS24-Abzweigung im PDF.
  const delivery = readFileSync("lib/delivery.ts", "utf8");
  const uses = delivery.split("GELD_ZURUECK_MICRO").length - 1;
  ok(uses === 2, "GELD_ZURUECK_MICRO is imported once and drawn once in lib/delivery.ts");
  const upsell = delivery.slice(delivery.indexOf("function writeUpsellPage"), delivery.indexOf("function writeUpsellPage") + 1200);
  ok(upsell.includes("GELD_ZURUECK_MICRO"), "the guarantee line lives in writeUpsellPage");
  const calls = delivery.match(/writeUpsellPage\(doc\)/g) ?? [];
  const guarded = delivery.match(/if \(isMuster\([^)]*\)\) writeUpsellPage\(doc\)/g) ?? [];
  ok(calls.length > 0 && calls.length === guarded.length, "writeUpsellPage only runs for Muster PDFs");
  const intake = readFileSync("app/api/intake/route.ts", "utf8");
  ok(!/variant:\s*"muster"/.test(intake), "the intake PDF is never the Muster variant");
  console.log("check-ds24-delivery: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
