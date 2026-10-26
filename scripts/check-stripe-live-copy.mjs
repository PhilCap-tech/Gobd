// Fails the build when customer-facing copy still shows Stripe test-mode
// notices under a live key. `sk_live_` / `pk_live_` and unknown prefixes are
// live: branches gated on `stripeTestMode` or `isStripeTestMode()` are
// removed before the scan. Ungated "Testmodus", "Testkarte", "Testpfad",
// "Test ohne Zahlung", and the test-card fragment 4242 fail.
//
// Price IDs stay in the environment. This script does not read secrets.
// A line marked `allow-test-order` may name Testmodus. That is only for the
// 401 shown when a stored cs_test_ checkout has no paid entitlement.
import { globSync, readFileSync } from "node:fs";

/** @type {string[]} */
const COVERED = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "content/faq.md",
  "content/faq-v2.md",
  "content/legal/**/*.md",
  "content/blog/**/*.md",
  "content/readiness/**/*.md",
  "content/delivery-templates/chapters/**/*.md",
  "lib/ops.ts",
  "lib/kuendigung-mail.ts",
  "lib/mail.ts",
  "lib/mail-layout.ts",
  "lib/login-mail.ts",
  "lib/delivery.ts",
  "lib/offer-copy.ts",
  "lib/stripe.ts",
  "lib/readiness.ts",
  "lib/legal.ts",
  "lib/expired-onboarding-link.ts",
  "lib/checkout-session.ts",
  "lib/pricing.ts",
];

/** @type {{ name: string, re: RegExp }[]} */
const FORBIDDEN = [
  { name: "Testmodus", re: /Testmodus/i },
  { name: "Testkarte", re: /Testkarte/i },
  { name: "Testpfad", re: /Testpfad/i },
  { name: "Test ohne Zahlung", re: /Test ohne Zahlung/i },
  { name: "4242", re: /(?<!\d)4242(?!\d)/ },
];

/**
 * Same rule as `isStripeTestMode()` in lib/env.ts.
 * Live and unknown prefixes are not test mode.
 * @param {string | undefined} secret
 * @param {string | undefined} publishable
 */
export function stripeKeyIsTest(secret, publishable) {
  const secretKey = secret?.trim() ?? "";
  const publishableKey = publishable?.trim() ?? "";
  return secretKey.startsWith("sk_test_") || publishableKey.startsWith("pk_test_");
}

function maskComments(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (source.startsWith("/*", i)) {
      out += "  ";
      i += 2;
      while (i < source.length && !source.startsWith("*/", i)) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (source.startsWith("*/", i)) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (source.startsWith("<!--", i)) {
      out += "    ";
      i += 4;
      while (i < source.length && !source.startsWith("-->", i)) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (source.startsWith("-->", i)) {
        out += "   ";
        i += 3;
      }
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

function matchTestCond(source, i) {
  if (i > 0 && /[\w$]/.test(source[i - 1])) return "";
  const match = source
    .slice(i)
    .match(/^(?:stripeTestMode|isStripeTestMode\s*\(\s*\))/);
  return match ? match[0] : "";
}

/** Index of the ternary colon that closes the true branch, or -1. */
function skipTrueBranch(source, start) {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = null;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === "\\") {
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "(") paren += 1;
    else if (c === ")") paren -= 1;
    else if (c === "{") brace += 1;
    else if (c === "}") brace -= 1;
    else if (c === "[") bracket += 1;
    else if (c === "]") bracket -= 1;
    else if (
      c === ":" &&
      paren <= 0 &&
      brace <= 0 &&
      bracket <= 0
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Customer copy as it stands when Stripe is not in test mode.
 * Newlines stay put so hits keep the original line number.
 * @param {string} source
 */
export function liveCustomerSource(source) {
  const commented = maskComments(source);
  let out = "";
  let i = 0;
  while (i < commented.length) {
    const cond = matchTestCond(commented, i);
    if (cond) {
      let j = i + cond.length;
      while (j < commented.length && /\s/.test(commented[j])) j += 1;
      if (
        commented[j] === "?" &&
        commented[j + 1] !== "." &&
        commented[j + 1] !== "?"
      ) {
        const colon = skipTrueBranch(commented, j + 1);
        if (colon !== -1) {
          while (i <= colon) {
            out += commented[i] === "\n" ? "\n" : " ";
            i += 1;
          }
          continue;
        }
      }
    }
    out += commented[i];
    i += 1;
  }
  return out;
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/** @returns {{ line: number, name: string, text: string }[]} */
export function liveCopyHits(source) {
  const live = liveCustomerSource(source);
  /** @type {{ line: number, name: string, text: string }[]} */
  const hits = [];
  for (const rule of FORBIDDEN) {
    const flags = rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`;
    const re = new RegExp(rule.re.source, flags);
    for (const match of live.matchAll(re)) {
      const index = match.index ?? 0;
      const start = live.lastIndexOf("\n", index) + 1;
      const end = live.indexOf("\n", index);
      const line = lineAt(live, index);
      const original = source.split("\n")[line - 1] ?? "";
      if (original.includes("allow-test-order")) continue;
      const text = live.slice(start, end === -1 ? live.length : end).trim();
      hits.push({ line, name: rule.name, text });
    }
  }
  return hits;
}

function assertPolicy() {
  const cases = [
    ["sk_live_prebuild", "", false],
    ["sk_live_prebuild", "pk_live_prebuild", false],
    ["", "pk_live_prebuild", false],
    ["", "", false],
    ["sk_test_prebuild", "", true],
    ["", "pk_test_prebuild", true],
    ["sk_live_prebuild", "pk_test_prebuild", true],
    ["rk_test_prebuild", "", false],
  ];
  for (const [secret, publishable, expectTest] of cases) {
    const got = stripeKeyIsTest(secret, publishable);
    if (got !== expectTest) {
      console.error(
        `check-stripe-live-copy: key policy failed for secret=${secret} publishable=${publishable} (got ${got}, expected ${expectTest})`,
      );
      process.exit(1);
    }
  }

  const envSource = readFileSync("lib/env.ts", "utf8");
  if (
    !envSource.includes('secret.startsWith("sk_test_")') ||
    !envSource.includes('publishable.startsWith("pk_test_")')
  ) {
    console.error(
      "check-stripe-live-copy: lib/env.ts no longer gates test mode on sk_test_/pk_test_",
    );
    process.exit(1);
  }
}

function assertScan() {
  const gated = `
    <p className="hint">
      {stripeTestMode ? (
        stripeReady
          ? "Weiter zu Stripe Checkout (Testmodus)."
          : "Keine Zahlung angebunden — nach dem Absenden direkt zum Intake."
      ) : (
        "Weiter zu Stripe Checkout."
      )}
    </p>
  `;
  const gatedLive = liveCustomerSource(gated);
  if (/Testmodus/i.test(gatedLive) || !gatedLive.includes("Weiter zu Stripe Checkout.")) {
    console.error("check-stripe-live-copy: gated checkout hint leaked into live copy");
    process.exit(1);
  }
  if (liveCopyHits(gated).length !== 0) {
    console.error("check-stripe-live-copy: gated checkout hint was flagged", liveCopyHits(gated));
    process.exit(1);
  }

  const intake = `
    {stripeTestMode ? (
      session.stub ? (
        <p className="banner">
          Test ohne Zahlung. Die Angaben werden gespeichert, sobald Sie absenden.
        </p>
      ) : null
    ) : null}
  `;
  if (liveCopyHits(intake).length !== 0) {
    console.error("check-stripe-live-copy: gated intake banner was flagged", liveCopyHits(intake));
    process.exit(1);
  }

  const leak = `<p>Weiter zu Stripe Checkout (Testmodus). Karte 4242 4242 4242 4242.</p>`;
  const leakHits = liveCopyHits(leak);
  if (!leakHits.some((hit) => hit.name === "Testmodus") || !leakHits.some((hit) => hit.name === "4242")) {
    console.error("check-stripe-live-copy: ungated notice was missed", leakHits);
    process.exit(1);
  }

  const comment = `// Testmodus und Karte 4242 bleiben im Kommentar.\n<p>Weiter zu Stripe Checkout.</p>`;
  if (liveCopyHits(comment).length !== 0) {
    console.error("check-stripe-live-copy: comment was flagged", liveCopyHits(comment));
    process.exit(1);
  }

  const ordinary = `Test des Datenexports. Wiederherstellungstest. Nummer 42421.`;
  if (liveCopyHits(ordinary).length !== 0) {
    console.error("check-stripe-live-copy: ordinary wording was flagged", liveCopyHits(ordinary));
    process.exit(1);
  }

  const testpfad = `<p>E-Mail-Versand ist in diesem Testpfad nicht eingerichtet.</p>`;
  if (!liveCopyHits(testpfad).some((hit) => hit.name === "Testpfad")) {
    console.error("check-stripe-live-copy: Testpfad was missed");
    process.exit(1);
  }

  const allowedOrder =
    'export const COPY = "Diese Bestellung stammt aus dem Testmodus. Bitte melden Sie sich an oder kontaktieren Sie uns."; // allow-test-order\n<p>Testmodus</p>';
  const allowedHits = liveCopyHits(allowedOrder);
  if (allowedHits.length !== 1 || allowedHits[0]?.name !== "Testmodus") {
    console.error("check-stripe-live-copy: allow-test-order skipped the wrong line", allowedHits);
    process.exit(1);
  }
}

assertPolicy();
assertScan();

const files = [...new Set(COVERED.flatMap((pattern) => globSync(pattern)))].sort();
if (!files.some((file) => file.startsWith("app/"))) {
  console.error("check-stripe-live-copy: no app files matched");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const hit of liveCopyHits(source)) {
    console.error(`${file}:${hit.line}: ${hit.name} in live copy: ${hit.text}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(`check-stripe-live-copy: ok (${files.length} files, live key shows no Testmodus/4242)`);
