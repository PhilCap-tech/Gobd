/**
 * HTTP smoke for intake drafts. No cookies, no localStorage.
 *
 *   node scripts/smoke-draft-blob-http.mjs https://preview.example
 *
 * Expects the app itself (not Vercel Deployment Protection):
 * save → fresh client load → full body, storage blob, 401, 409, DELETE.
 */
const base = (process.argv[2] || process.env.DRAFT_SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("DRAFT_SMOKE_FAIL missing base url");
  process.exit(1);
}

const draftKey = `email:draft-smoke@example.com:e2e-blob-${Date.now()}:gesamt`;
const sessionId = "mock_draft_blob_smoke";
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

async function call(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    redirect: "manual",
    headers: { ...(init?.headers || {}) },
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

const params = new URLSearchParams({ draftKey, sessionId });

try {
  const denied = await call("/api/intake/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftKey,
      email: "draft-smoke@example.com",
      step: 4,
      answers,
      revision: 1,
    }),
  });
  ok(denied.status === 401 && denied.json?.error === "Kein Zugriff.", `PUT without session is 401 (got ${denied.status} ${denied.json?.error || denied.text})`);

  const saved = await call("/api/intake/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftKey,
      sessionId,
      email: "draft-smoke@example.com",
      entityId: "e2e-blob-check",
      modus: "gesamt",
      step: 4,
      answers,
      revision: 2,
    }),
  });
  ok(saved.status === 200, `save status 200 (got ${saved.status} ${saved.json?.error || ""})`);
  ok(saved.json?.backend === "blob", `save storage is blob (got ${String(saved.json?.backend)})`);

  const overwritten = await call("/api/intake/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftKey,
      sessionId,
      email: "draft-smoke@example.com",
      entityId: "e2e-blob-check",
      modus: "gesamt",
      step: 5,
      answers: replaced,
      revision: 3,
    }),
  });
  ok(overwritten.status === 200 && overwritten.json?.backend === "blob", `overwrite status 200 blob (got ${overwritten.status} ${String(overwritten.json?.backend)})`);

  const loaded = await call(`/api/intake/draft?${params}`);
  const draft = loaded.json?.draft;
  ok(loaded.status === 200, `fresh client load status 200 (got ${loaded.status})`);
  ok(draft?.answers?.katalog?.A01?.values?.company === `${marker}-neu`, "fresh client restored the overwritten company");
  ok(draft?.answers?.rechtsform === "GmbH", "fresh client restored Rechtsform");
  ok(draft?.answers?.gf === "Ada Beispiel", "fresh client restored Geschäftsleitung");
  ok(draft?.answers?.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "fresh client restored the checkbox");
  ok(draft?.answers?.branchen?.[0] === "Handel", "fresh client restored multi choice");
  ok(draft?.step === 5 && draft?.revision === 3, "fresh client restored step and revision");
  ok(JSON.stringify(draft?.answers) === JSON.stringify(replaced), "fresh client restored the full answer object");

  const hidden = await call(`/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}`);
  ok(hidden.status === 401 && hidden.json?.error === "Kein Zugriff.", `GET without session is 401 (got ${hidden.status} ${hidden.json?.error || hidden.text})`);

  const conflict = await call("/api/intake/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftKey,
      sessionId,
      email: "draft-smoke@example.com",
      step: 1,
      answers: { rechtsform: "leer" },
      revision: 1,
    }),
  });
  ok(conflict.status === 409 && conflict.json?.conflict === true, `stale save is 409 (got ${conflict.status})`);
  ok(conflict.json?.draft?.revision === 3, "409 returns the newer server draft");
  ok(conflict.json?.draft?.answers?.katalog?.A01?.values?.company === `${marker}-neu`, "409 does not replace the stored company");

  const deleted = await call(`/api/intake/draft?${params}`, { method: "DELETE" });
  ok(deleted.status === 200 && deleted.json?.ok === true, `DELETE own draft is 200 (got ${deleted.status})`);
  const gone = await call(`/api/intake/draft?${params}`);
  ok(gone.status === 200 && gone.json?.draft === null, "deleted draft stays gone for a fresh client");

  console.log("DRAFT_SMOKE_OK backend=blob fresh=full 401=ok 409=ok delete=ok");
} finally {
  await fetch(`${base}/api/intake/draft?${params}`, { method: "DELETE", redirect: "manual" }).catch(() => undefined);
}
