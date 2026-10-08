/**
 * Preview builds only: mint two synthetic gobd_session cookies (no mail,
 * no Stripe) and run the HTTP draft smoke against 127.0.0.1.
 * External clients cannot pass Vercel Authentication on the preview URL.
 * Skipped outside Vercel preview builds, so production data is not touched.
 */
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SMOKE_EMAIL = "draft-blob-smoke@example.com";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionToken(email) {
  const secret = process.env.MAGIC_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("DRAFT_SMOKE_FAIL MAGIC_LINK_SECRET missing on preview");
  }
  const body = Buffer.from(
    JSON.stringify({
      typ: "session",
      email,
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
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
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
    env: {
      ...process.env,
      DRAFT_SMOKE_EMAIL: SMOKE_EMAIL,
      DRAFT_SMOKE_COOKIE_A: cookieA,
      DRAFT_SMOKE_COOKIE_B: cookieB,
    },
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
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : "preview draft smoke failed"));
  console.error(redact(log).slice(-1500));
  process.exit(1);
} finally {
  stop();
  await delay(300);
  if (server.exitCode === null) server.kill("SIGKILL");
}
