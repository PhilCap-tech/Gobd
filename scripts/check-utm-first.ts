/**
 * Prebuild: first-touch UTM storage stays gone.
 *
 * `gobd_utm_first` may be removed once, via sessionStorage.removeItem
 * inside try/catch, without consent. A read or a write fails the build.
 * fbq and gtag event params must not carry utm_* from storage.
 *
 *   npx tsx scripts/check-utm-first.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  removeLegacyFirstTouchUtm,
  resetTrackingForChecks,
  saveConsent,
  trackAmpelResult,
  trackAmpelStart,
  trackPurchaseConversion,
  trackReadinessSubmit,
  trackRoute,
} from "../lib/tracking";

const KEY = "gobd_utm_first";
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage", ".vercel"]);
const CODE = /\.(ts|tsx|js|mjs|cjs)$/;
const EVENT_ROOTS = ["app/", "components/", "lib/"];
const SELF = "scripts/check-utm-first.ts";

type StorageOp = {
  kind: "read" | "write" | "remove";
  allowed: boolean;
  text: string;
};

function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function readBalanced(source: string, openIndex: number, open: string, close: string): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return "";
}

function readExpression(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (depth === 0) return source.slice(start, i).trim();
      depth -= 1;
    } else if ((ch === ";" || ch === "\n") && depth === 0) {
      return source.slice(start, i).trim();
    }
  }
  return source.slice(start).trim();
}

function keyAliases(source: string): Set<string> {
  const names = new Set<string>();
  const re =
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*["']gobd_utm_first["']/g;
  for (const match of source.matchAll(re)) names.add(match[1]);
  return names;
}

function isKeyToken(token: string, aliases: Set<string>): boolean {
  const trimmed = token.trim();
  if (trimmed === `"${KEY}"` || trimmed === `'${KEY}'` || trimmed === `\`${KEY}\``) return true;
  return aliases.has(trimmed);
}

function receiverOf(source: string, dotIndex: number): string {
  const before = source.slice(Math.max(0, dotIndex - 80), dotIndex);
  const match = before.match(/((?:window\s*\.\s*)?[A-Za-z_$][\w$]*)\s*$/);
  return (match?.[1] ?? "").replace(/\s/g, "");
}

function storageOps(source: string, aliases: Set<string>): StorageOp[] {
  const ops: StorageOp[] = [];
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    const re = new RegExp(`\\.${method}\\s*\\(`, "g");
    for (const match of source.matchAll(re)) {
      const open = match.index! + match[0].length - 1;
      const args = readBalanced(source, open, "(", ")");
      const first = args.split(",")[0] ?? "";
      if (!isKeyToken(first, aliases)) continue;
      const receiver = receiverOf(source, match.index!);
      const text = `${receiver}.${method}(${first.trim()})`;
      const allowed =
        method === "removeItem" &&
        (receiver === "sessionStorage" || receiver === "window.sessionStorage") &&
        (first.trim() === `"${KEY}"` || first.trim() === `'${KEY}'`);
      ops.push({
        kind: method === "getItem" ? "read" : method === "setItem" ? "write" : "remove",
        allowed,
        text,
      });
    }
  }
  const bracket =
    /(?:window\s*\.\s*)?(sessionStorage|localStorage)\s*\[\s*([^\]\n]+?)\s*\]/g;
  for (const match of source.matchAll(bracket)) {
    if (!isKeyToken(match[2], aliases)) continue;
    const after = source.slice(match.index! + match[0].length).trimStart();
    ops.push({
      kind: after.startsWith("=") && !after.startsWith("==") ? "write" : "read",
      allowed: false,
      text: match[0].replace(/\s/g, ""),
    });
  }
  return ops;
}

function storageProblems(rel: string, source: string): string[] {
  const clean = stripComments(source);
  const aliases = keyAliases(clean);
  return storageOps(clean, aliases)
    .filter((op) => !op.allowed)
    .map((op) => `${rel}: ${op.kind} of ${KEY} via ${op.text}`);
}

function allowedRemovals(source: string): number {
  return storageOps(stripComments(source), keyAliases(stripComments(source))).filter(
    (op) => op.allowed,
  ).length;
}

function callsIn(expr: string): string[] {
  const names: string[] = [];
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of expr.matchAll(re)) {
    if (["if", "for", "while", "switch", "catch", "function", "return", "typeof"].includes(match[1])) {
      continue;
    }
    names.push(match[1]);
  }
  return names;
}

function functionBody(source: string, name: string): string | null {
  const decl = new RegExp(`\\bfunction\\s+${name}\\s*\\(`);
  const match = decl.exec(source);
  if (!match) return null;
  const paren = match.index + match[0].lastIndexOf("(");
  const after = paren + readBalanced(source, paren, "(", ")").length + 2;
  const brace = source.indexOf("{", after);
  if (brace < 0 || brace - after > 160) return null;
  return readBalanced(source, brace, "{", "}");
}

function bindingInitializer(source: string, name: string): string | null {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*(?::[^=;]+)?=\\s*`);
  const match = re.exec(source);
  if (!match) return null;
  return readExpression(source, match.index + match[0].length);
}

function storedUtmHit(
  source: string,
  expr: string,
  aliases: Set<string>,
  seen: Set<string>,
): string | null {
  if (/\butm_[A-Za-z0-9_]*/.test(expr)) return "utm_* in event params";
  const hit = storageOps(expr, aliases).find((op) => op.kind === "read" || op.kind === "write");
  if (hit) return hit.text;
  const names = new Set<string>();
  const whole = expr.trim();
  const wholeCall = whole.match(/^([A-Za-z_$][\w$]*)\s*\(/);
  const wholeIdent = whole.match(/^([A-Za-z_$][\w$]*)$/);
  if (wholeCall) names.add(wholeCall[1]);
  else if (wholeIdent) names.add(wholeIdent[1]);
  else for (const name of callsIn(expr)) names.add(name);
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const body = functionBody(source, name);
    if (body) {
      const nested = storedUtmHit(source, body, aliases, seen);
      if (nested) return `${name} → ${nested}`;
    }
    const init = bindingInitializer(source, name);
    if (init) {
      const nested = storedUtmHit(source, init, aliases, seen);
      if (nested) return `${name} → ${nested}`;
    }
  }
  return null;
}

function findCalls(source: string, name: string): string[] {
  const re = new RegExp(`\\b${name}\\b`, "g");
  const calls: string[] = [];
  for (const match of source.matchAll(re)) {
    let i = match.index! + name.length;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (source.startsWith("?.", i)) i += 2;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (source[i] !== "(") continue;
    calls.push(readBalanced(source, i, "(", ")"));
  }
  return calls;
}

function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(args.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = args.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function eventProblems(rel: string, source: string): string[] {
  const clean = stripComments(source);
  const aliases = keyAliases(clean);
  const problems: string[] = [];
  const inspect = (label: string, params: string) => {
    if (!params) return;
    const hit = storedUtmHit(clean, params, aliases, new Set());
    if (hit) problems.push(`${rel}: ${label} params include utm from storage (${hit})`);
  };
  for (const args of findCalls(clean, "fbq")) {
    const parts = splitArgs(args);
    const kind = parts[0]?.replace(/^['"]|['"]$/g, "");
    if (kind !== "track" && kind !== "trackCustom") continue;
    inspect(`fbq ${kind}`, parts.slice(2).join(", "));
  }
  for (const args of findCalls(clean, "gtag")) {
    const parts = splitArgs(args);
    const kind = parts[0]?.replace(/^['"]|['"]$/g, "");
    if (kind !== "event") continue;
    inspect(`gtag ${parts[1] ?? "event"}`, parts.slice(2).join(", "));
  }
  return problems;
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CODE.test(entry.name)) out.push(full);
  }
}

function removalShape(source: string): string | null {
  const clean = stripComments(source);
  const at = clean.indexOf(`sessionStorage.removeItem("${KEY}")`);
  if (at < 0) return "the one-time sessionStorage.removeItem is missing";
  const fn = clean.lastIndexOf("function removeLegacyFirstTouchUtm", at);
  if (fn < 0) return "removeItem is not inside removeLegacyFirstTouchUtm";
  const head = clean.slice(fn, at);
  if (!head.includes("try")) return "removeItem is not inside try";
  if (head.includes("hasMarketingConsent") || head.includes("getItem") || head.includes("setItem")) {
    return "the removal reads, writes, or waits for consent";
  }
  const tail = clean.slice(at, at + 220);
  if (!tail.includes("catch")) return "removeItem has no catch";
  return null;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function installDom(search: string) {
  const local = memoryStorage();
  const session = memoryStorage();
  const scripts: { id: string; src: string }[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    localStorage: local,
    sessionStorage: session,
    location: {
      protocol: "https:",
      search,
      pathname: "/",
      origin: "https://www.gobd-doku-erstellen.de",
    },
    dataLayer: [] as unknown[],
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((fn) => fn());
      return true;
    },
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set<() => void>();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
  };
  const doc = {
    cookie: "",
    getElementById(id: string) {
      return scripts.find((script) => script.id === id) ?? null;
    },
    createElement() {
      return { id: "", src: "", async: false };
    },
    head: {
      appendChild(el: { id: string; src: string }) {
        scripts.push(el);
      },
    },
  };
  globalThis.window = win as unknown as Window & typeof globalThis;
  globalThis.document = doc as unknown as Document;
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  resetTrackingForChecks();
  return session;
}

function fbqQueue(): unknown[][] {
  const fbq = window.fbq as { queue?: unknown[][] } | undefined;
  return fbq?.queue ?? [];
}

function gtagEvents(): { name: unknown; params: unknown }[] {
  const layer = (window.dataLayer ?? []) as unknown[][];
  return layer
    .filter((cmd) => cmd[0] === "event")
    .map((cmd) => ({ name: cmd[1], params: cmd[2] }));
}

function assertNoUtmParams(label: string) {
  for (const args of fbqQueue()) {
    const blob = JSON.stringify(args);
    assert.equal(blob.includes("utm_"), false, `${label}: fbq ${blob}`);
    const kind = args[0];
    if (kind === "track" || kind === "trackCustom") {
      assert.equal(args.length, 2, `${label}: ${String(kind)} ${String(args[1])} has params`);
    }
  }
  for (const event of gtagEvents()) {
    const params =
      event.params && typeof event.params === "object"
        ? { ...(event.params as Record<string, unknown>) }
        : null;
    // page_location may carry the live allowlisted utm query. That is not stored utm.
    if (params) {
      delete params.page_location;
      delete params.page_referrer;
    }
    const blob = JSON.stringify(params);
    assert.equal(blob.includes("utm_"), false, `${label}: gtag ${String(event.name)} ${blob}`);
    if (event.params && typeof event.params === "object") {
      for (const key of Object.keys(event.params as object)) {
        assert.equal(key.startsWith("utm_"), false, `${label}: gtag param ${key}`);
      }
    }
  }
}

const badRead = storageProblems(
  "sample.ts",
  `const UTM_STORAGE_KEY = "gobd_utm_first";
   sessionStorage.getItem(UTM_STORAGE_KEY);`,
);
assert.equal(badRead.length, 1, "a getItem of the key fails");

const badWrite = storageProblems(
  "sample.ts",
  `sessionStorage.setItem("gobd_utm_first", JSON.stringify({ utm_source: "x" }));`,
);
assert.equal(badWrite.length, 1, "a setItem of the key fails");

const badBracket = storageProblems("sample.ts", `const raw = sessionStorage["gobd_utm_first"];`);
assert.equal(badBracket.length, 1, "a bracket read of the key fails");

const goodRemoval = storageProblems(
  "lib/tracking.ts",
  `export function removeLegacyFirstTouchUtm(): void {
     try { sessionStorage.removeItem("gobd_utm_first"); } catch { /* private mode */ }
   }`,
);
assert.deepEqual(goodRemoval, [], "the one-time removeItem is allowed");

const oldEvents = `
const UTM_STORAGE_KEY = "${KEY}";
function readFirstTouchUtms() {
  const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
function eventParams() {
  return readFirstTouchUtms() || undefined;
}
window.fbq?.("track", "PageView", eventParams());
window.gtag("event", "page_view", eventParams());
`;
assert.ok(eventProblems("lib/tracking.ts", oldEvents).length >= 2, "stored utm params fail");

const inlineUtm = `window.fbq?.("track", "PageView", { utm_source: "x", utm_campaign: "y" });`;
assert.equal(eventProblems("lib/tracking.ts", inlineUtm).length, 1, "literal utm event params fail");

const plainEvents = `
window.fbq?.("track", "PageView");
window.fbq?.("trackCustom", "ReadinessStart");
window.gtag("event", "conversion", {
  send_to: sendTo,
  value: 198,
  currency: "EUR",
  transaction_id: id,
});
window.gtag("event", "readiness_submit", { send_to: gaId });
window.gtag?.("event", "page_view", { page_path: pathname, send_to: gaId });
`;
assert.deepEqual(eventProblems("lib/tracking.ts", plainEvents), [], "consent events without utm pass");

const files: string[] = [];
walk(process.cwd(), files);
const storageHits: string[] = [];
const eventHits: string[] = [];
let removals = 0;
for (const full of files) {
  const rel = path.relative(process.cwd(), full).replaceAll("\\", "/");
  if (rel === SELF) continue;
  const source = readFileSync(full, "utf8");
  storageHits.push(...storageProblems(rel, source));
  removals += allowedRemovals(source);
  if (EVENT_ROOTS.some((root) => rel.startsWith(root))) {
    eventHits.push(...eventProblems(rel, source));
  }
}
assert.deepEqual(storageHits, [], storageHits.join("\n"));
assert.equal(removals, 1, `expected one removeItem of ${KEY}, found ${removals}`);
assert.deepEqual(eventHits, [], eventHits.join("\n"));

const tracking = stripComments(readFileSync("lib/tracking.ts", "utf8"));
const pixel = readFileSync("components/marketing-pixel.tsx", "utf8");
assert.equal(removalShape(tracking), null, removalShape(tracking) ?? "");
for (const dead of [
  "captureFirstTouchUtms",
  "readFirstTouchUtms",
  "UTM_STORAGE_KEY",
  "UTM_KEYS",
  "function eventParams",
]) {
  assert.equal(tracking.includes(dead), false, `tracking still has ${dead}`);
  assert.equal(pixel.includes(dead), false, `pixel still has ${dead}`);
}
const effect = pixel.slice(pixel.indexOf("useEffect("));
const clearAt = effect.indexOf("removeLegacyFirstTouchUtm()");
const inviteAt = effect.indexOf('pathname.startsWith("/auth/invite")');
assert.ok(clearAt !== -1 && inviteAt !== -1 && clearAt < inviteAt, "page load removes the entry before the invite return");
assert.equal(effect.slice(0, clearAt).includes("hasMarketingConsent"), false, "removal does not wait for consent");
console.log("ok: source has one unguarded removeItem and no stored utm event params");

const saved = {
  ads: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  ga: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  purchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO,
  meta: process.env.NEXT_PUBLIC_META_PIXEL_ID,
};
process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-586367190";
process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-RJ4KLBP1SF";
process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = "AW-586367190/PURCHASELABEL";
process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890";

try {
  {
    const session = installDom("?utm_source=x&utm_campaign=y");
    trackRoute("/");
    trackRoute("/readiness");
    trackReadinessSubmit();
    trackAmpelStart();
    trackPurchaseConversion("cs_test_paid_session_1");
    assert.equal(session.getItem(KEY), null, "without consent the key is not written");
    assertNoUtmParams("without consent");
    console.log("ok: utm url without consent does not store or send utm params");
  }
  {
    const session = installDom("?utm_source=x&utm_campaign=y");
    saveConsent(true);
    trackRoute("/");
    trackRoute("/readiness");
    trackReadinessSubmit();
    trackAmpelStart();
    trackAmpelResult();
    trackPurchaseConversion("cs_test_paid_session_1");
    assert.equal(session.getItem(KEY), null, "with consent the key is not written");
    assert.ok(fbqQueue().some((args) => args[0] === "track" && args[1] === "PageView"), "PageView fired");
    assert.ok(gtagEvents().some((event) => event.name === "readiness_submit"), "readiness_submit fired");
    assertNoUtmParams("with consent");
    console.log("ok: utm url with consent does not store or append utm params");
  }
  {
    const session = installDom("/");
    session.setItem(KEY, JSON.stringify({ utm_source: "x", utm_campaign: "y" }));
    removeLegacyFirstTouchUtm();
    assert.equal(session.getItem(KEY), null, "reload without consent removes the stored entry");
    console.log("ok: pre-seeded entry is removed without consent");
  }
  {
    const session = installDom("?utm_source=x&utm_campaign=y");
    session.setItem(KEY, JSON.stringify({ utm_source: "x", utm_campaign: "y" }));
    saveConsent(true);
    removeLegacyFirstTouchUtm();
    assert.equal(session.getItem(KEY), null, "reload with consent removes the stored entry");
    trackRoute("/");
    trackReadinessSubmit();
    assert.equal(session.getItem(KEY), null, "later events do not write the key back");
    assertNoUtmParams("after removal");
    console.log("ok: pre-seeded entry is removed with consent and stays out of events");
  }
  {
    installDom("/");
    globalThis.sessionStorage = {
      ...memoryStorage(),
      removeItem() {
        throw new Error("private");
      },
    } as Storage;
    assert.doesNotThrow(() => removeLegacyFirstTouchUtm(), "private mode is ignored");
    console.log("ok: removeItem errors are swallowed");
  }
} finally {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = saved.ads;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = saved.ga;
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = saved.purchase;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = saved.meta;
}

console.log("check-utm-first: ok");
