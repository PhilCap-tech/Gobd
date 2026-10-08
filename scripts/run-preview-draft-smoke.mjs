/**
 * Preview builds only: mint synthetic gobd_session cookies (no mail, no Stripe)
 * and run the HTTP draft and PDF/upload smokes against 127.0.0.1.
 * Sheets, Stripe and mail are removed from the child so the smoke cannot
 * write production rows or send mail. External clients cannot pass Vercel
 * Authentication on the preview URL. Skipped outside Vercel preview builds.
 */
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SMOKE_EMAIL = "draft-blob-smoke@example.com";
const PDF_SMOKE_EMAIL = "pdf-blob-smoke@example.com";
const PDF_SMOKE_OTHER = "pdf-blob-other@example.com";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function smokeChildEnv(extra) {
  const env = { ...process.env, ...extra, GOBD_BLOB_SMOKE: "1" };
  for (const key of [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "GOOGLE_SHEETS_TAB",
    "GOOGLE_SHEETS_READINESS_TAB",
    "GOOGLE_SHEETS_ENTITIES_TAB",
    "GOOGLE_SHEETS_PROFILES_TAB",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_SETUP_ID",
    "STRIPE_PRICE_MONTHLY_ID",
    "STRIPE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ]) {
    delete env[key];
  }
  return env;
}

function sessionToken(email) {
  const secret = process.env.MAGIC_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("DRAFT_SMOKE_FAIL MAGIC_LINK_SECRET missing on preview");
  }
  const body = Buffer.from(
    JSON.stringify({
      typ: "session",
      email,
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3217;
const base = `http://127.0.0.1:${port}`;

if (process.env.VERCEL_ENV !== "preview") {
  console.log("preview draft smoke: skip (not a Vercel preview build)");
  process.exit(0);
}
if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
  console.error("DRAFT_SMOKE_FAIL BLOB_READ_WRITE_TOKEN missing on preview");
  process.exit(1);
}
if (!process.env.MAGIC_LINK_SECRET?.trim()) {
  console.error("DRAFT_SMOKE_FAIL MAGIC_LINK_SECRET missing on preview");
  process.exit(1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: smokeChildEnv({ PORT: String(port), HOSTNAME: "127.0.0.1" }),
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
function redact(text) {
  const secret = process.env.MAGIC_LINK_SECRET?.trim();
  let out = text.replace(/vercel_blob_rw_\S+/gi, "[redacted]");
  if (secret) out = out.split(secret).join("[redacted]");
  return out;
}
server.stdout.on("data", (chunk) => {
  log = (log + chunk.toString()).slice(-4000);
});
server.stderr.on("data", (chunk) => {
  log = (log + chunk.toString()).slice(-4000);
});

function stop() {
  if (!server.killed) server.kill("SIGTERM");
}

async function waitUntilReady() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${base}/api/intake/draft`);
      const text = await response.text();
      if (response.status === 400 && text.includes("draftKey fehlt")) return;
    } catch {
      // not listening yet
    }
    await delay(400);
  }
  throw new Error("next start did not become ready");
}

try {
  await waitUntilReady();
  const cookieA = sessionToken(SMOKE_EMAIL);
  await delay(5);
  const cookieB = sessionToken(SMOKE_EMAIL);
  const smoke = spawn(process.execPath, [path.join(root, "scripts", "smoke-draft-blob-http.mjs"), base], {
    cwd: root,
    stdio: "inherit",
    env: smokeChildEnv({
      DRAFT_SMOKE_EMAIL: SMOKE_EMAIL,
      DRAFT_SMOKE_COOKIE_A: cookieA,
      DRAFT_SMOKE_COOKIE_B: cookieB,
    }),
  });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      smoke.kill("SIGTERM");
      reject(new Error("draft http smoke timed out"));
    }, 60_000);
    smoke.on("exit", (status) => {
      clearTimeout(timer);
      resolve(status ?? 1);
    });
    smoke.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  if (code !== 0) process.exit(code);

  await delay(5);
  const pdfCookieA = sessionToken(PDF_SMOKE_EMAIL);
  await delay(5);
  const pdfCookieB = sessionToken(PDF_SMOKE_EMAIL);
  const pdfCookieOther = sessionToken(PDF_SMOKE_OTHER);
  const pdfSmoke = spawn(process.execPath, [path.join(root, "scripts", "smoke-pdf-blob-http.mjs"), base], {
    cwd: root,
    stdio: "inherit",
    env: smokeChildEnv({
      PDF_SMOKE_COOKIE_A: pdfCookieA,
      PDF_SMOKE_COOKIE_B: pdfCookieB,
      PDF_SMOKE_COOKIE_OTHER: pdfCookieOther,
    }),
  });
  const pdfCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pdfSmoke.kill("SIGTERM");
      reject(new Error("pdf http smoke timed out"));
    }, 120_000);
    pdfSmoke.on("exit", (status) => {
      clearTimeout(timer);
      resolve(status ?? 1);
    });
    pdfSmoke.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  if (pdfCode !== 0) process.exit(pdfCode);
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : "preview draft smoke failed"));
  console.error(redact(log).slice(-1500));
  process.exit(1);
} finally {
  stop();
  await delay(300);
  if (server.exitCode === null) server.kill("SIGKILL");
}
