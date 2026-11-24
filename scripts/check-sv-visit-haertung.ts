/**
 * Zählaufruf sv_visit gehärtet (GLD-5 H1–H4), echter Code-Pfad:
 * Client-fetch ohne Cookies und ohne Referer, Route liest im sv_visit-Zweig
 * keine Cookies, sv49_arm wird ohne Marketing-Einwilligung nicht gelesen,
 * die Zuteilung mit Einwilligung bleibt 50/50 wie bisher.
 */
import { NextRequest } from "next/server";

let failed = 0;
function ok(condition: unknown, label: string): void {
  if (condition) console.log(`ok   ${label}`);
  else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

// Minimaler Browser: Cookie-Lesezugriffe zählen, Schreibzugriffe mitschreiben.
let cookieJar = "";
let cookieReads = 0;
const cookieWrites: string[] = [];
const storage = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.window = {
  location: { protocol: "https:" },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};
g.document = {
  get cookie() {
    cookieReads += 1;
    return cookieJar;
  },
  set cookie(value: string) {
    cookieWrites.push(value);
  },
};

type FetchCall = { url: string; init: RequestInit };
const fetchCalls: FetchCall[] = [];
g.fetch = async (url: string, init: RequestInit) => {
  fetchCalls.push({ url, init });
  return new Response(null, { status: 204 });
};

function reset(consent: "marketing" | "essential" | null, jar: string): void {
  storage.clear();
  if (consent) storage.set("gobd_consent", JSON.stringify({ marketing: consent === "marketing" }));
  cookieJar = jar;
  cookieReads = 0;
  cookieWrites.length = 0;
}

async function main(): Promise<void> {
  const browser = await import("../components/schnellversion-browser");

  // H1/H2: echter Client-Aufruf
  fetchCalls.length = 0;
  await browser.postSvVisit();
  const visit = fetchCalls[0];
  ok(visit?.url === "/api/schnellversion/event", "sv_visit geht an /api/schnellversion/event");
  ok(visit?.init.body === JSON.stringify({ name: "sv_visit" }), "Body bleibt nur der Ereignisname");
  ok(visit?.init.credentials === "omit", "sv_visit mit credentials: omit");
  ok(visit?.init.referrerPolicy === "no-referrer", "sv_visit mit referrerPolicy: no-referrer");
  ok(visit?.init.keepalive === true, "keepalive bleibt");

  // H3: ohne Einwilligung wird sv49_arm nicht gelesen
  reset("essential", "sv49_arm=test");
  const denied = browser.syncSvArm();
  ok(denied === null, "Einwilligung verweigert: kein Arm (kein Direkt-kaufen)");
  ok(cookieReads === 0, "Einwilligung verweigert: document.cookie wird nicht gelesen");
  ok(cookieWrites.length === 1 && /^sv49_arm=; Path=\/; Max-Age=0/.test(cookieWrites[0] ?? ""), "Einwilligung verweigert: Arm-Cookie wird wie bisher gelöscht");

  reset(null, "sv49_arm=test");
  ok(browser.syncSvArm() === null, "keine Entscheidung: kein Arm (kein Direkt-kaufen)");
  ok(cookieWrites.length === 1 && cookieWrites[0]!.startsWith("sv49_arm=;"), "keine Entscheidung: kein Arm-Cookie gesetzt");

  // Zuteilung mit Einwilligung unverändert: neu 50/50 nach Math.random, bestehender Arm bleibt
  const realRandom = Math.random;
  try {
    for (const [roll, expected] of [
      [0, "control"],
      [0.49, "control"],
      [0.5, "test"],
      [0.99, "test"],
    ] as const) {
      reset("marketing", "");
      Math.random = () => roll;
      const arm = browser.syncSvArm();
      ok(arm === expected, `Einwilligung, neu, roll ${roll}: ${expected}`);
      ok(
        cookieWrites.length === 1 && cookieWrites[0] === `sv49_arm=${expected}; Path=/; Max-Age=${60 * 60 * 24 * 28}; SameSite=Lax; Secure`,
        `Einwilligung, neu, roll ${roll}: Cookie 28 Tage wie bisher`,
      );
    }
    for (const existing of ["control", "test"] as const) {
      reset("marketing", `gobd_consent=marketing; sv49_arm=${existing}`);
      Math.random = () => (existing === "control" ? 0.9 : 0.1);
      ok(browser.syncSvArm() === existing, `Einwilligung, bestehender Arm ${existing} bleibt`);
      ok(cookieReads > 0, `Einwilligung, bestehender Arm ${existing}: Cookie wird gelesen`);
    }
  } finally {
    Math.random = realRandom;
  }

  // H4: Route liest im sv_visit-Zweig keine Cookies, andere Ereignisse wie bisher.
  // Server-Module laufen ohne Browser-Globals.
  delete g.window;
  delete g.document;
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  process.env.PRICING_MODEL = "v3";
  delete process.env.VERCEL_ENV;
  const store = await import("../lib/schnellversion-store");
  store.installSvEventSheetForTest({ client: {} as never, configured: false });
  const { POST } = await import("../app/api/schnellversion/event/route");

  async function call(body: unknown, cookie: string): Promise<{ status: number; cookieAccess: number }> {
    const real = new NextRequest("https://example.test/api/schnellversion/event", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify(body),
    });
    let cookieAccess = 0;
    const headers = new Proxy(real.headers, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        if (prop === "get" && typeof value === "function") {
          return (name: string) => {
            if (name.toLowerCase() === "cookie") cookieAccess += 1;
            return value.call(target, name);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const request = new Proxy(real, {
      get(target, prop) {
        if (prop === "cookies") cookieAccess += 1;
        if (prop === "headers") return headers;
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const response = await POST(request as unknown as NextRequest);
    return { status: response.status, cookieAccess };
  }

  const visitRes = await call({ name: "sv_visit" }, "sv49_arm=test; gobd_consent=marketing");
  ok(visitRes.status === 204, "Route: sv_visit 204 wie bisher");
  ok(visitRes.cookieAccess === 0, "Route: sv_visit liest keine Cookies");
  const viewRes = await call({ name: "sv_home_view", arm: "test", variante: "b" }, "sv49_arm=test");
  ok(viewRes.status === 204 && viewRes.cookieAccess > 0, "Route: Arm-Ereignis liest sv49_arm und gilt wie bisher");
  const mismatch = await call({ name: "sv_home_view", arm: "test", variante: "b" }, "sv49_arm=control");
  ok(mismatch.status === 400, "Route: Arm passt nicht → 400 wie bisher");
  const noArm = await call({ name: "sv_home_view", arm: "test", variante: "b" }, "");
  ok(noArm.status === 400, "Route: ohne Arm-Cookie → 400 wie bisher");

  if (failed) {
    console.error(`check:sv-visit-haertung: ${failed} Fehler`);
    process.exit(1);
  }
  console.log("check:sv-visit-haertung: ok");
}

void main();
