/**
 * HTTP smoke for intake drafts.
 * No localStorage, no shared cookie jar, no mail, no Stripe session id.
 *
 * Auth is a gobd_session cookie minted in the preview build
 * (see scripts/run-preview-draft-smoke.mjs). Client B uses a second token.
 *
 *   DRAFT_SMOKE_COOKIE_A=… DRAFT_SMOKE_COOKIE_B=… \
 *     node scripts/smoke-draft-blob-http.mjs http://127.0.0.1:3217
 */
const base = (process.argv[2] || process.env.DRAFT_SMOKE_BASE_URL || "").replace(/\/$/, "");
const email = (process.env.DRAFT_SMOKE_EMAIL || "draft-blob-smoke@example.com").trim().toLowerCase();
const cookieA = process.env.DRAFT_SMOKE_COOKIE_A || "";
const cookieB = process.env.DRAFT_SMOKE_COOKIE_B || "";

if (!base) {
  console.error("DRAFT_SMOKE_FAIL missing base url");
  process.exit(1);
}
if (!cookieA || !cookieB) {
  console.error("DRAFT_SMOKE_FAIL missing synthetic session cookies");
  process.exit(1);
}
if (/cappelletti|sdc-ventures/i.test(email)) {
  console.error("DRAFT_SMOKE_FAIL refused real mailbox");
  process.exit(1);
}

const draftKey = `email:${email}:e2e-blob-${Date.now()}:gesamt`;
const marker = `blob-smoke-${Date.now()}`;
const answers = {
  branchen: ["Handel"],
  rechtsform: "GmbH",
  mitarbeitende: "3",
  fibu: ["lexoffice"],
  weitereSysteme: "",
  eingangsbelege: ["mail"],
  ausgangsrechnungen: ["tool"],
  archiv: "cloud",
  hosting: "vercel",
  backup: ["taeglich"],
  zugriff: "gf",
  gf: "Ada Beispiel",
  buchhaltung: "intern",
  it: "extern",
  steuerberater: "Kanzlei Nord",
  katalog: {
    A01: { status: "bestaetigt", values: { company: marker, rechtsform: "GmbH" } },
    A04: { values: { gueltigAb: "2020-05-01", keineRueckdatierungBestaetigt: true } },
  },
};
const replaced = {
  ...answers,
  katalog: {
    ...answers.katalog,
    A01: { status: "bestaetigt", values: { company: `${marker}-neu`, rechtsform: "GmbH" } },
  },
};

function ok(cond, msg) {
  if (!cond) throw new Error(`DRAFT_SMOKE_FAIL ${msg}`);
  console.log("ok:", msg);
}

function headers(cookie, json) {
  const out = {};
  if (json) out["Content-Type"] = "application/json";
  if (cookie) out.Cookie = `gobd_session=${cookie}`;
  return out;
}

async function call(path, { method = "GET", cookie = "", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: headers(cookie, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (text.includes("Protected deployment") || text.includes("Protected by Vercel Authentication")) {
    throw new Error("DRAFT_SMOKE_FAIL Vercel Deployment Protection answered before the app");
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text: text.slice(0, 180) };
}

const query = new URLSearchParams({ draftKey });

try {
  const denied = await call("/api/intake/draft", {
    method: "PUT",
    body: { draftKey, email, step: 4, answers, revision: 1 },
  });
  ok(
    denied.status === 401 && denied.json?.error === "Kein Zugriff.",
    `PUT without session is 401 (got ${denied.status} ${denied.json?.error || denied.text})`,
  );

  const saved = await call("/api/intake/draft", {
    method: "PUT",
    cookie: cookieA,
    body: {
      draftKey,
      email,
      entityId: "e2e-blob-smoke",
      modus: "gesamt",
      step: 4,
      answers,
      revision: 2,
    },
  });
  ok(saved.status === 200, `save status 200 (got ${saved.status} ${saved.json?.error || ""})`);
  ok(saved.json?.backend === "blob", `save storage is blob (got ${String(saved.json?.backend)})`);
  ok(saved.json?.draft?.email === email, "saved draft keeps the synthetic email");

  const overwritten = await call("/api/intake/draft", {
    method: "PUT",
    cookie: cookieA,
    body: {
      draftKey,
      email,
      entityId: "e2e-blob-smoke",
      modus: "gesamt",
      step: 5,
      answers: replaced,
      revision: 3,
    },
  });
  ok(
    overwritten.status === 200 && overwritten.json?.backend === "blob",
    `overwrite status 200 blob (got ${overwritten.status} ${String(overwritten.json?.backend)})`,
  );

  const loaded = await call(`/api/intake/draft?${query}`, { cookie: cookieB });
  const draft = loaded.json?.draft;
  ok(loaded.status === 200, `fresh session load status 200 (got ${loaded.status})`);
  ok(draft?.answers?.katalog?.A01?.values?.company === `${marker}-neu`, "fresh session restored the overwritten company");
  ok(draft?.answers?.rechtsform === "GmbH", "fresh session restored Rechtsform");
  ok(draft?.answers?.gf === "Ada Beispiel", "fresh session restored Geschäftsleitung");
  ok(draft?.answers?.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "fresh session restored the checkbox");
  ok(draft?.answers?.branchen?.[0] === "Handel", "fresh session restored multi choice");
  ok(draft?.step === 5 && draft?.revision === 3, "fresh session restored step and revision");
  ok(JSON.stringify(draft?.answers) === JSON.stringify(replaced), "fresh session restored the full answer object");

  const hidden = await call(`/api/intake/draft?${query}`);
  ok(
    hidden.status === 401 && hidden.json?.error === "Kein Zugriff.",
    `GET without session is 401 (got ${hidden.status} ${hidden.json?.error || hidden.text})`,
  );

  const conflict = await call("/api/intake/draft", {
    method: "PUT",
    cookie: cookieA,
    body: { draftKey, email, step: 1, answers: { rechtsform: "leer" }, revision: 1 },
  });
  ok(conflict.status === 409 && conflict.json?.conflict === true, `stale save is 409 (got ${conflict.status})`);
  ok(conflict.json?.draft?.revision === 3, "409 returns the newer server draft");
  ok(
    conflict.json?.draft?.answers?.katalog?.A01?.values?.company === `${marker}-neu`,
    "409 does not replace the stored company",
  );

  const deleted = await call(`/api/intake/draft?${query}`, { method: "DELETE", cookie: cookieA });
  ok(deleted.status === 200 && deleted.json?.ok === true, `DELETE own draft is 200 (got ${deleted.status})`);
  const gone = await call(`/api/intake/draft?${query}`, { cookie: cookieB });
  ok(gone.status === 200 && gone.json?.draft === null, "deleted draft stays gone for a fresh session");

  console.log("DRAFT_SMOKE_OK backend=blob fresh=full 401=ok 409=ok delete=ok email=synthetic");
} finally {
  await call(`/api/intake/draft?${query}`, { method: "DELETE", cookie: cookieA }).catch(() => undefined);
}
