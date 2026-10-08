/**
 * Preview builds only: start the built server and run the HTTP draft smoke
 * against 127.0.0.1. External clients cannot pass Vercel Authentication on
 * the preview URL; this process has the preview env, including the blob token.
 * Two fetch calls, no Cookie header. Skipped outside Vercel preview builds.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
function redact(text) {
  return text.replace(/vercel_blob_rw_\S+/gi, "[redacted]");
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
  const smoke = spawn(process.execPath, [path.join(root, "scripts", "smoke-draft-blob-http.mjs"), base], {
    cwd: root,
    stdio: "inherit",
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
