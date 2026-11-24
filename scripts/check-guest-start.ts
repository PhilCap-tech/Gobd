/**
 * Gaststart (Variante A), Flag INTAKE_GUEST_START_ENABLED default aus.
 * Flag aus: bisheriger Ablauf. Flag an: keine Antwort verlässt den Browser,
 * Upload zu, Übernahme nach Anmeldung mit Konfliktfrage, Sweep auf jeder Seite.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeIntakeAnswers, stripEmptyIntakeCards } from "../lib/intake-present";
import { ensureGesamt } from "../lib/module/status";
import { emptyAnswers } from "../lib/types";
import { CATALOG_STEPS, nextApplicableStep } from "../lib/intake-catalog";
import { M01_PAGE_IDS } from "../lib/intake-m01";
import {
  GUEST_ADOPT_BROWSER_LABEL,
  GUEST_ADOPT_LOCK_NAME,
  GUEST_ADOPT_MARKER_MAX_AGE_MS,
  GUEST_CONFLICT_PROMPT,
  GUEST_DEVICE_NOTICE,
  GUEST_DRAFT_LIMIT_HINT,
  GUEST_DRAFT_TRANSFER_PATHS,
  GUEST_KEEP_ACCOUNT_LABEL,
  GUEST_KEEP_LOCAL_HINT,
  GUEST_LEAD,
  GUEST_OPEN_DRAFT_LIMIT,
  GUEST_PACKAGE_LOGIN,
  GUEST_SAVE_HINT,
  GUEST_UPLOAD_HINT,
  GUEST_WAIT_LABEL,
  commitGuestAdoption,
  guestAdoptAnswersEqual,
  guestAdoptDraftQuery,
  guestAdoptPutBody,
  guestEntryRemovedAfter,
  guestLocalDraftKey,
  guestMayTransferAnswers,
  planGuestAdoption,
  readGuestDraftSnapshot,
  removeGuestDraftEntry,
  runGuestAdoptAttempt,
  sweepIntakeDraftsOnView,
  type GuestAdoptFacts,
  type GuestAdoptLock,
  transferDraftAnswers,
  transferModuleUpload,
} from "../lib/guest-start";
import { guestSavePromptVisible } from "../lib/guest-save-prompt";
import { applyLegalConditions, legalFlagsFor } from "../lib/legal-content";
import { intakeGuestStartEnabled, intakeLoginFirstEnabled } from "../lib/pricing-model";
import { INTAKE_DRAFT_STORAGE_PREFIX, clearIntakeDrafts, type StorageLike } from "../lib/browser-storage-expiry";
import { PLAN_OFFER_OBJECTION_NOTICE } from "../lib/plan-copy";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

type LegalTexts = {
  ui: string[];
  b1_alt: string;
  b1_neu: string;
  b2_alt: string;
  b2_neu: string;
  cookie_alt: string;
  cookie_neu: string;
};

const texts = JSON.parse(read("scripts/fixtures/guest-start-texts.json")) as LegalTexts;
const [lead, device, saveHint, packageLogin] = texts.ui;

const BANNED =
  /fertig|reicht|garantiert|Garantie|rechtssicher|GoBD-konform|prüfungssicher|Bestseller|\b\d+\s*Minuten\b|\bin\s+\d+\s*(?:Stunden|Tagen)\b/i;

const NEW_UI = [
  GUEST_UPLOAD_HINT,
  GUEST_CONFLICT_PROMPT,
  GUEST_ADOPT_BROWSER_LABEL,
  GUEST_KEEP_ACCOUNT_LABEL,
  GUEST_DRAFT_LIMIT_HINT,
  GUEST_KEEP_LOCAL_HINT,
  GUEST_WAIT_LABEL,
  "Paket wählen",
];

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function markerBody(markdown: string, name: string): string {
  const match = markdown.match(new RegExp(`<!-- if:${name} -->([\\s\\S]*?)<!-- endif -->`));
  assert.ok(match, `Marker ${name} fehlt`);
  return match[1];
}

function answersBody(value: unknown): string {
  return JSON.stringify(value);
}

async function main() {
  const savedGuest = process.env.INTAKE_GUEST_START_ENABLED;
  const savedModel = process.env.PRICING_MODEL;
  const savedLogin = process.env.INTAKE_LOGIN_FIRST_ENABLED;
  delete process.env.INTAKE_GUEST_START_ENABLED;
  delete process.env.PRICING_MODEL;
  delete process.env.INTAKE_LOGIN_FIRST_ENABLED;

  assert.equal(intakeLoginFirstEnabled(), false, "legacy: Login zuerst aus");
  assert.equal(intakeGuestStartEnabled(), false, "legacy: Gaststart aus");
  process.env.PRICING_MODEL = "v3";
  assert.equal(intakeLoginFirstEnabled(), true, "neues Modell: Login zuerst an");
  assert.equal(intakeGuestStartEnabled(), false, "Gaststart bleibt aus, solange das Flag fehlt");
  process.env.INTAKE_GUEST_START_ENABLED = "true";
  assert.equal(intakeGuestStartEnabled(), true, "Flag an schaltet den Gaststart ein");
  process.env.INTAKE_LOGIN_FIRST_ENABLED = "false";
  assert.equal(intakeGuestStartEnabled(), false, "ohne Login-zuerst bleibt /fragebogen der alte Weg");
  delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
  process.env.INTAKE_GUEST_START_ENABLED = "false";
  assert.equal(intakeGuestStartEnabled(), false, "Flag false ist aus");

  const page = read("app/fragebogen/page.tsx");
  const oldLead =
    "Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Anmeldelink; damit speichern wir Ihre Angaben";
  assert.ok(page.includes(oldLead), "Flag aus: der bisherige Lead bleibt im Code");
  assert.ok(page.includes("emailNotice={PLAN_OFFER_OBJECTION_NOTICE}"), "Login-Feld behält den Widerspruchshinweis");
  assert.ok(page.includes("if (!email && guestStart)"), "Gastzweig nur mit Flag");
  assert.ok(page.includes("guestMode"), "Fragebogen ohne Sitzung nutzt den Gastmodus");
  const guestBranch = page.indexOf("if (!email && guestStart)");
  const loginBranch = page.indexOf("if (!email) {");
  assert.ok(guestBranch > 0 && loginBranch > guestBranch, "ohne Flag bleibt der bisherige Login-Zweig");

  const form = read("app/intake/intake-form.tsx");
  const postAt = form.indexOf("const postServerDraft = useCallback");
  const postEnd = form.indexOf("const [autosave]", postAt);
  const postFn = form.slice(postAt, postEnd);
  const guardAt = postFn.indexOf("guestMayTransferAnswers(guestModeRef.current)");
  const fetchAt = postFn.indexOf("fetchRetrying503");
  assert.ok(guardAt > 0 && fetchAt > guardAt, "postServerDraft bricht vor dem fetch ab");
  assert.equal(guestMayTransferAnswers(true), false);
  assert.equal(guestMayTransferAnswers(false), true);
  for (const call of [
    "postServerDraft(revisionRef.current, false, signal)",
    "postServerDraft(revision)",
    'postServerDraft(revision, true)',
    "postServerDraft(revisionRef.current, false, undefined, FINAL_SAVE_RETRIES)",
  ]) {
    assert.ok(form.includes(call), `Weg bleibt an postServerDraft: ${call}`);
  }
  assert.ok(form.includes("if (guestModeRef.current)"), "Final-Save und Absenden senden im Gastmodus nichts");

  const secret = "Antwort-GAST-9f3c";
  const body = { answers: { firma: secret } };
  for (const guestMode of [true, false]) {
    const calls: string[] = [];
    for (const pathName of GUEST_DRAFT_TRANSFER_PATHS) {
      const result = await transferDraftAnswers({
        guestMode,
        path: pathName,
        body,
        fetchImpl: async (_url, init) => {
          calls.push(String(init.body));
        },
      });
      assert.equal(result, guestMode ? "blocked" : "sent", pathName);
    }
    if (guestMode) {
      assert.equal(calls.length, 0, "Gast: kein fetch auf den vier Schreibwegen");
    } else {
      assert.equal(calls.length, 4, "mit Sitzung gehen die vier Wege raus");
      assert.ok(calls.every((item) => item.includes(secret)), "der Body trägt die Antworten");
    }
  }

  const uploads: string[] = [];
  assert.equal(
    await transferModuleUpload({
      guestMode: true,
      fetchImpl: async (url) => {
        uploads.push(url);
      },
    }),
    "blocked",
  );
  assert.equal(uploads.length, 0, "Gast-Upload sendet nichts");
  const checkUi = read("components/betriebs-check.tsx");
  const disabledAt = checkUi.indexOf("uploadsDisabled ?");
  const uploadFetch = checkUi.indexOf('fetch("/api/module-upload"');
  const enabledBranch = checkUi.indexOf(") : (", disabledAt);
  assert.ok(disabledAt > 0 && enabledBranch > disabledAt && uploadFetch > enabledBranch, "der Upload steht nur im Zweig mit Sitzung");
  assert.ok(!checkUi.slice(disabledAt, enabledBranch).includes("fetch("), "der gesperrte Zweig hat kein fetch");
  assert.ok(checkUi.includes("GUEST_UPLOAD_HINT"), "kurzer Hinweis statt Datei-Upload");
  assert.ok(form.includes("uploadsDisabled={guestMode}"), "das Formular gibt den Gastmodus an den Upload weiter");

  const localAnswers = { firma: "Browser-GmbH" };
  const snapshot = {
    answers: localAnswers as never,
    step: 4,
    stepId: "step-M01e",
    savedAt: "2026-11-23T10:00:00.000Z",
    revision: 3,
  };
  assert.equal(planGuestAdoption({ hasLocalDraft: false, targetExists: false, openUnpaidCount: 0 }), "skip");
  assert.equal(planGuestAdoption({ hasLocalDraft: true, targetExists: false, openUnpaidCount: 0 }), "adopt");
  assert.equal(planGuestAdoption({ hasLocalDraft: true, targetExists: true, openUnpaidCount: 1 }), "ask");
  assert.equal(
    planGuestAdoption({ hasLocalDraft: true, targetExists: false, openUnpaidCount: GUEST_OPEN_DRAFT_LIMIT }),
    "limit",
  );
  assert.equal(planGuestAdoption({ hasLocalDraft: true, targetExists: true, openUnpaidCount: 3 }), "ask");
  assert.equal(GUEST_OPEN_DRAFT_LIMIT, 3);
  assert.ok(read("app/api/intake/draft/route.ts").includes("MAX_OPEN_UNPAID_DRAFTS = 3"));

  const storage = new MemoryStorage();
  storage.setItem(guestLocalDraftKey(), JSON.stringify(snapshot));
  assert.equal(readGuestDraftSnapshot(storage, Date.parse("2026-11-23T12:00:00.000Z"))?.stepId, "step-M01e");

  let puts = 0;
  const adopted = await commitGuestAdoption({
    action: "adopt",
    put: async () => {
      puts += 1;
      const sent = guestAdoptPutBody({
        draftKey: "email:gast@firma.de:default:gesamt",
        email: "gast@firma.de",
        entityId: "",
        modus: "gesamt",
        snapshot,
        serverRevision: 0,
      });
      assert.equal(answersBody(sent.answers), answersBody(localAnswers));
      assert.equal(sent.revision, 3);
      assert.equal("channel" in sent, false, "die Übernahme setzt keinen Messmarker");
      assert.equal("gobd_test" in sent, false);
      return true;
    },
    remove: () => removeGuestDraftEntry(storage),
  });
  assert.equal(adopted, "adopted");
  assert.equal(puts, 1);
  assert.equal(storage.getItem(guestLocalDraftKey()), null, "Gast-Eintrag nach gelungener Übernahme weg");

  storage.setItem(guestLocalDraftKey(), JSON.stringify(snapshot));
  let conflictPuts = 0;
  const waiting = await commitGuestAdoption({
    action: "ask",
    put: async () => {
      conflictPuts += 1;
      return true;
    },
    remove: () => removeGuestDraftEntry(storage),
  });
  assert.equal(waiting, "idle", "ohne Wahl kein Schreiben");
  assert.equal(conflictPuts, 0, "vorhandener Server-Entwurf wird nicht still überschrieben");
  assert.ok(storage.getItem(guestLocalDraftKey()), "ohne Entscheidung bleibt der Gast-Eintrag");

  const kept = await commitGuestAdoption({
    action: "ask",
    choice: "account",
    put: async () => {
      conflictPuts += 1;
      return true;
    },
    remove: () => removeGuestDraftEntry(storage),
  });
  assert.equal(kept, "kept-account");
  assert.equal(conflictPuts, 0, "Gespeicherten behalten schreibt den Browser-Stand nicht");
  assert.equal(storage.getItem(guestLocalDraftKey()), null, "nach der Entscheidung ist der Gast-Eintrag weg");

  storage.setItem(guestLocalDraftKey(), JSON.stringify(snapshot));
  const limited = await commitGuestAdoption({
    action: "limit",
    put: async () => {
      throw new Error("darf nicht senden");
    },
    remove: () => removeGuestDraftEntry(storage),
  });
  assert.equal(limited, "kept-local");
  assert.ok(storage.getItem(guestLocalDraftKey()), "bei 3 Entwürfen geht nichts verloren");
  assert.equal(guestEntryRemovedAfter({ action: "limit", putOk: true }), false);

  storage.setItem(guestLocalDraftKey(), JSON.stringify(snapshot));
  const failed = await commitGuestAdoption({
    action: "adopt",
    put: async () => false,
    remove: () => removeGuestDraftEntry(storage),
  });
  assert.equal(failed, "failed");
  assert.ok(storage.getItem(guestLocalDraftKey()), "fehlgeschlagene Übernahme löscht den Gast-Eintrag nicht");

  const adoptUi = read("components/guest-draft-adopt.tsx");
  assert.ok(adoptUi.includes("commitGuestAdoption"), "die Seite nutzt dieselbe Übernahme");
  assert.ok(adoptUi.includes("GUEST_CONFLICT_PROMPT"), "Konfliktdialog");
  assert.ok(adoptUi.includes("GUEST_ADOPT_BROWSER_LABEL") && adoptUi.includes("GUEST_KEEP_ACCOUNT_LABEL"));
  assert.ok(!adoptUi.includes("preferIntakeSnapshot"), "kein stilles Überschreiben über die höhere Revision");
  assert.ok(page.includes("GuestDraftAdopt"), "nach der Anmeldung auf /fragebogen");
  assert.ok(page.includes('status: "unknown"'), "Lesefehler überschreibt nichts");

  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-11-23T12:00:00.000Z");
  const home = new MemoryStorage();
  home.setItem(
    `${INTAKE_DRAFT_STORAGE_PREFIX}gast-alt`,
    JSON.stringify({ answers: { firma: "alt" }, savedAt: new Date(now - 40 * day).toISOString() }),
  );
  home.setItem(
    guestLocalDraftKey(),
    JSON.stringify({ answers: { firma: "neu" }, savedAt: new Date(now - day).toISOString() }),
  );
  sweepIntakeDraftsOnView([home], now);
  assert.equal(home.getItem(`${INTAKE_DRAFT_STORAGE_PREFIX}gast-alt`), null, "40 Tage sind weg");
  assert.ok(home.getItem(guestLocalDraftKey()), "frischer Eintrag bleibt");
  const layout = read("app/layout.tsx");
  const sweep = read("components/intake-draft-sweep.tsx");
  assert.ok(layout.includes("intakeGuestStartEnabled() ? <IntakeDraftSweep />"), "Sweep nur mit Flag, im Root-Layout");
  assert.ok(!sweep.includes("fragebogen") && !sweep.includes("pathname"), "der Sweep hängt nicht an /fragebogen");
  assert.ok(sweep.includes("sweepIntakeDraftsOnView"), "jede Seitenansicht ruft denselben Lauf");
  const logout = read("components/logout-button.tsx");
  assert.ok(logout.includes("clearIntakeDrafts(storage)"), "Abmelden löscht weiter alle Einträge");
  home.setItem(guestLocalDraftKey(), "{}");
  home.setItem(`${INTAKE_DRAFT_STORAGE_PREFIX}email:a`, "{}");
  assert.equal(clearIntakeDrafts(home), 2);
  assert.equal(home.length, 0);

  assert.deepEqual(texts.ui, [GUEST_LEAD, GUEST_DEVICE_NOTICE, GUEST_SAVE_HINT, GUEST_PACKAGE_LOGIN]);
  assert.equal(lead, GUEST_LEAD);
  assert.equal(device, GUEST_DEVICE_NOTICE);
  assert.equal(saveHint, GUEST_SAVE_HINT);
  assert.equal(packageLogin, GUEST_PACKAGE_LOGIN);
  assert.ok(page.includes("{GUEST_LEAD}"), "der Gast-Lead kommt aus dem Wortlaut");
  assert.ok(form.includes("emailHint={GUEST_SAVE_HINT}") && form.includes("emailHint={GUEST_PACKAGE_LOGIN}"));
  assert.ok(form.includes("emailNotice={PLAN_OFFER_OBJECTION_NOTICE}"));
  const paket = read("app/fragebogen/paket/page.tsx");
  assert.ok(paket.includes("emailHint={GUEST_PACKAGE_LOGIN}") && paket.includes("emailNotice={PLAN_OFFER_OBJECTION_NOTICE}"));
  assert.ok(paket.includes("if (!email) redirect(loginPath(FRAGEBOGEN_PATH))"), "Flag aus: Paketwahl leitet weiter wie bisher");
  assert.ok(PLAN_OFFER_OBJECTION_NOTICE.length > 40);

  const dse = read("content/legal/datenschutz-v3.md");
  const cookies = read("content/legal/cookies-v3.md");
  const agb = read("content/legal/agb-v3.md");
  assert.equal(markerBody(dse, "gaststart-off"), texts.b1_alt);
  assert.equal(markerBody(dse, "gaststart"), texts.b1_neu);
  const b2start = dse.indexOf(texts.b2_alt);
  assert.equal(markerBody(dse.slice(b2start - 40), "gaststart"), texts.b2_neu);
  assert.equal(markerBody(cookies, "gaststart-off"), texts.cookie_alt);
  assert.equal(markerBody(cookies, "gaststart"), texts.cookie_neu);
  assert.ok(!agb.includes("gaststart"), "AGB bleiben");
  const off = legalFlagsFor(true, false, false, false, false, false);
  const on = legalFlagsFor(true, false, false, false, false, true);
  const dseOff = applyLegalConditions(dse, off);
  const dseOn = applyLegalConditions(dse, on);
  assert.ok(dseOff.includes(texts.b1_alt) && !dseOff.includes("Sie können den Fragebogen ohne Anmeldung beginnen"));
  assert.ok(dseOn.includes(texts.b1_neu) && !dseOn.includes(texts.b1_alt));
  assert.ok(dseOff.includes(texts.b2_alt) && dseOn.includes(texts.b2_neu) && !dseOn.includes(texts.b2_alt));
  assert.ok(!dseOff.includes("<!-- if:") && !dseOn.includes("<!-- if:"));
  const cookieOff = applyLegalConditions(cookies, off);
  const cookieOn = applyLegalConditions(cookies, on);
  assert.ok(cookieOff.includes(texts.cookie_alt) && !cookieOff.includes("vor der Anmeldung der einzige Speicherort"));
  assert.ok(cookieOn.includes(texts.cookie_neu) && !cookieOn.includes(texts.cookie_alt));
  assert.ok(dseOff.includes("**Stand:** November 2026") && dseOn.includes("**Stand:** November 2026"));
  assert.ok(cookieOff.includes("**Stand:** November 2026") && cookieOn.includes("**Stand:** November 2026"));

  const bot = "/cursor/stores/bot/gaststart/legal-nacht-2026-11-23.md";
  if (existsSync(bot)) {
    const spec = readFileSync(bot, "utf8");
    for (const text of [...texts.ui, texts.b1_alt, texts.b1_neu, texts.b2_alt, texts.b2_neu, texts.cookie_alt, texts.cookie_neu]) {
      assert.ok(spec.includes(text), `Wortlaut fehlt in der Legal-Datei: ${text.slice(0, 48)}`);
    }
  }

  const answers = ensureGesamt(emptyAnswers());
  const last = CATALOG_STEPS.findIndex((step) => step.id === M01_PAGE_IDS[M01_PAGE_IDS.length - 1]);
  const after = nextApplicableStep(last, answers);
  assert.equal(guestSavePromptVisible(after, answers), true, "Hinweis auf dem ersten Schritt nach Modul 1");
  assert.equal(guestSavePromptVisible(last, answers), false, "auf der letzten Seite von Modul 1 noch nicht");
  assert.ok(form.includes("guestSavePromptVisible(step, answers)"));

  const visible = [
    ...texts.ui,
    texts.b1_neu,
    texts.b2_neu,
    texts.cookie_neu,
    ...NEW_UI,
  ];
  for (const text of visible) {
    assert.equal(BANNED.test(text), false, `Verbotswort in: ${text.slice(0, 80)}`);
  }
  for (const file of [
    "lib/guest-start.ts",
    "components/guest-draft-adopt.tsx",
    "components/intake-draft-sweep.tsx",
    "app/fragebogen/page.tsx",
    "app/fragebogen/paket/page.tsx",
  ]) {
    assert.ok(!read(file).includes("sendBeacon"), `${file}: kein Browser-Beacon`);
    assert.ok(!/guest_start|save_prompt_shown|guest_draft_adopted|prepay_view|checkout_start/.test(read(file)), `${file}: kein neuer Zähler`);
  }
  assert.ok(!read("lib/guest-start.ts").includes("localStorage"), "Messung legt nichts im Browser ab");

  const css = read("app/globals.css");
  const banner = css.slice(css.indexOf(".consent-banner {"), css.indexOf(".consent-banner {") + 180);
  assert.ok(banner.includes("position: relative"), "Cookie-Banner steht im Fluss");
  assert.ok(!banner.includes("position: fixed"));
  for (const file of ["components/guest-draft-adopt.tsx", "components/intake-draft-sweep.tsx", "app/intake/intake-form.tsx"]) {
    assert.ok(!read(file).includes("position: fixed"), `${file}: Hinweis überdeckt keine Schaltfläche`);
  }

  const adoptFacts: GuestAdoptFacts = {
    status: "ready",
    draftKey: "email:gast@firma.de:default:gesamt",
    email: "gast@firma.de",
    entityId: "",
    modus: "gesamt",
    targetExists: false,
    targetRevision: 0,
    openUnpaidCount: 0,
  };
  function mutex(): GuestAdoptLock {
    let chain = Promise.resolve();
    return (task) => {
      const previous = chain;
      let release = () => undefined as void;
      chain = new Promise((resolve) => {
        release = resolve;
      });
      return previous.then(async () => {
        try {
          return await task();
        } finally {
          release();
        }
      });
    };
  }
  const raceStorage = new MemoryStorage();
  const raceNow = Date.parse("2026-11-24T00:00:00.000Z");
  raceStorage.setItem(
    guestLocalDraftKey(),
    JSON.stringify({ answers: { firma: "Gleichzeitig" }, step: 2, savedAt: new Date(raceNow).toISOString(), revision: 4 }),
  );
  let racePuts = 0;
  const raceLock = mutex();
  const [firstTab, secondTab] = await Promise.all([
    runGuestAdoptAttempt({
      storage: raceStorage,
      now: () => raceNow,
      facts: adoptFacts,
      lock: raceLock,
      intent: "mount",
      put: async (draft) => {
        racePuts += 1;
        assert.equal("adoptStartedAt" in draft, false, "der Marker geht nicht in den Entwurf");
        await new Promise((resolve) => setTimeout(resolve, 30));
        return true;
      },
      remove: () => removeGuestDraftEntry(raceStorage),
      commit: commitGuestAdoption,
    }),
    runGuestAdoptAttempt({
      storage: raceStorage,
      now: () => raceNow,
      facts: adoptFacts,
      lock: raceLock,
      intent: "mount",
      put: async () => {
        racePuts += 1;
        return true;
      },
      remove: () => removeGuestDraftEntry(raceStorage),
      commit: commitGuestAdoption,
    }),
  ]);
  assert.equal(racePuts, 1, "zwei Tabs lösen genau ein PUT aus");
  assert.equal(raceStorage.getItem(guestLocalDraftKey()), null, "der Gast-Eintrag wird einmal entfernt");
  const raceStatuses = [firstTab.status, secondTab.status].sort();
  assert.deepEqual(raceStatuses, ["adopted", "already-adopted"]);
  const waited = firstTab.status === "already-adopted" ? firstTab : secondTab;
  assert.equal(waited.refresh, true, "der wartende Tab lädt neu und zeigt keinen Dialog");
  assert.notEqual(waited.status, "ask");

  const alone = new MemoryStorage();
  alone.setItem(guestLocalDraftKey(), JSON.stringify({ answers: { firma: "Einzeln" }, step: 1, savedAt: new Date(raceNow).toISOString(), revision: 1 }));
  let alonePuts = 0;
  const aloneResult = await runGuestAdoptAttempt({
    storage: alone,
    now: () => raceNow,
    facts: adoptFacts,
    lock: mutex(),
    intent: "mount",
    put: async () => {
      alonePuts += 1;
      return true;
    },
    remove: () => removeGuestDraftEntry(alone),
    commit: commitGuestAdoption,
  });
  assert.equal(aloneResult.status, "adopted", "ein Tab übernimmt weiter wie bisher");
  assert.equal(alonePuts, 1);
  assert.equal(aloneResult.refresh, false);

  const marked = new MemoryStorage();
  const freshMarker = `${raceNow - 1000}:anderer-tab`;
  marked.setItem(
    guestLocalDraftKey(),
    JSON.stringify({
      answers: { firma: "Marker" },
      step: 1,
      savedAt: new Date(raceNow).toISOString(),
      revision: 1,
      adoptStartedAt: freshMarker,
    }),
  );
  let markerPuts = 0;
  const blockedByMarker = await runGuestAdoptAttempt({
    storage: marked,
    now: () => raceNow,
    facts: adoptFacts,
    lock: null,
    intent: "mount",
    put: async () => {
      markerPuts += 1;
      return true;
    },
    remove: () => removeGuestDraftEntry(marked),
    commit: commitGuestAdoption,
  });
  assert.equal(markerPuts, 0, "ein frischer Marker blockt den zweiten Versuch");
  assert.equal(blockedByMarker.status, "already-adopted");
  assert.equal(blockedByMarker.refresh, true);
  assert.equal(marked.getItem(guestLocalDraftKey())?.includes(freshMarker), true, "der blockierte Tab lässt den Eintrag liegen");

  const stale = new MemoryStorage();
  stale.setItem(
    guestLocalDraftKey(),
    JSON.stringify({
      answers: { firma: "Alt" },
      step: 1,
      savedAt: new Date(raceNow).toISOString(),
      revision: 2,
      adoptStartedAt: `${raceNow - GUEST_ADOPT_MARKER_MAX_AGE_MS - 1000}:abgestuerzt`,
    }),
  );
  let stalePuts = 0;
  const staleResult = await runGuestAdoptAttempt({
    storage: stale,
    now: () => raceNow,
    facts: adoptFacts,
    lock: null,
    intent: "mount",
    put: async (draft) => {
      stalePuts += 1;
      assert.equal("adoptStartedAt" in draft, false);
      assert.equal(JSON.stringify(draft).includes("adoptStartedAt"), false);
      return true;
    },
    remove: () => removeGuestDraftEntry(stale),
    commit: commitGuestAdoption,
  });
  assert.equal(stalePuts, 1, "ein abgelaufener Marker blockt nicht");
  assert.equal(staleResult.status, "adopted");
  assert.equal(stale.getItem(guestLocalDraftKey()), null);

  const sweepMarked = new MemoryStorage();
  sweepMarked.setItem(
    guestLocalDraftKey(),
    JSON.stringify({
      answers: { firma: "alt" },
      savedAt: new Date(raceNow - 40 * 24 * 60 * 60 * 1000).toISOString(),
      adoptStartedAt: `${raceNow}:x`,
    }),
  );
  sweepIntakeDraftsOnView([sweepMarked], raceNow);
  assert.equal(sweepMarked.getItem(guestLocalDraftKey()), null, "der Marker ändert den 30-Tage-Lauf nicht");
  const keptMarked = new MemoryStorage();
  keptMarked.setItem(
    guestLocalDraftKey(),
    JSON.stringify({ answers: { firma: "neu" }, savedAt: new Date(raceNow).toISOString(), adoptStartedAt: `${raceNow}:x` }),
  );
  const stripped = readGuestDraftSnapshot(keptMarked, raceNow);
  assert.equal(stripped?.answers && "firma" in (stripped.answers as { firma?: string }), true);
  assert.equal(stripped && "adoptStartedAt" in stripped, false, "Leser ignorieren den Marker");

  assert.ok(adoptUi.includes("navigator.locks"), "die Übernahme nimmt das Web Lock");
  assert.ok(adoptUi.includes(`locks.request(${"GUEST_ADOPT_LOCK_NAME"}`), "exklusiv und wartend, ohne ifAvailable");
  assert.ok(!adoptUi.includes("ifAvailable"));
  assert.ok(adoptUi.includes("router.refresh"), "der wartende Tab lädt die Server-Ansicht einmal neu");
  assert.equal(GUEST_ADOPT_LOCK_NAME, "gobd-guest-adopt");

  const roundTripAnswers = {
    ...emptyAnswers(),
    gf: "Ada Beispiel",
    katalog: {
      B01: {
        status: "bestaetigt" as const,
        values: {
          systeme: [
            { name: "DATEV", funktion: "FiBu" },
            { name: " ", funktion: "" },
          ],
        },
      },
    },
  };
  const roundTripSnapshot = {
    answers: roundTripAnswers,
    step: 3,
    stepId: "step-M01",
    savedAt: new Date(raceNow).toISOString(),
    revision: 6,
  };
  const roundTripBody = guestAdoptPutBody({
    draftKey: adoptFacts.draftKey,
    email: adoptFacts.email,
    entityId: adoptFacts.entityId,
    modus: adoptFacts.modus,
    snapshot: roundTripSnapshot,
    serverRevision: 0,
  });
  const storedAnswers = normalizeIntakeAnswers(roundTripBody.answers as typeof roundTripAnswers);
  const fromGet = stripEmptyIntakeCards(storedAnswers);
  assert.equal(
    guestAdoptAnswersEqual(roundTripSnapshot.answers, fromGet),
    true,
    "Autosave-Form und Draft-Route ergeben denselben Vergleich",
  );
  const reversed = JSON.parse(JSON.stringify(fromGet)) as { gf?: string; katalog?: { B01?: { values?: { systeme?: unknown } } } };
  assert.equal(guestAdoptAnswersEqual(roundTripSnapshot.answers, reversed), true);

  class StickyStorage implements StorageLike {
    constructor(private inner: MemoryStorage) {}
    get length() {
      return this.inner.length;
    }
    key(index: number) {
      return this.inner.key(index);
    }
    getItem(key: string) {
      return this.inner.getItem(key);
    }
    setItem(key: string, value: string) {
      this.inner.setItem(key, value);
    }
    removeItem(key: string) {
      void key;
    }
  }

  const sharedAnswers = { ...emptyAnswers(), gf: "Gleichzeitig GmbH" };
  const stickyInner = new MemoryStorage();
  stickyInner.setItem(
    guestLocalDraftKey(),
    JSON.stringify({ answers: sharedAnswers, step: 2, savedAt: new Date(raceNow).toISOString(), revision: 4 }),
  );
  const sticky = new StickyStorage(stickyInner);
  let serverAnswers: typeof sharedAnswers | null = null;
  let serverRevision = 0;
  const order: string[] = [];
  const serverGet = async () => {
    order.push("get");
    if (!serverAnswers) return { ok: true as const, draft: null };
    const shaped = stripEmptyIntakeCards(normalizeIntakeAnswers(serverAnswers));
    return { ok: true as const, draft: { revision: serverRevision, answers: shaped } };
  };
  let sharedPuts = 0;
  const sharedLock = mutex();
  const mountBoth = {
    storage: sticky,
    now: () => raceNow,
    facts: { ...adoptFacts, targetExists: false },
    lock: sharedLock,
    intent: "mount" as const,
    loadServer: serverGet,
    put: async (draft: { answers: unknown }, revision: number) => {
      order.push("put");
      sharedPuts += 1;
      serverAnswers = draft.answers as typeof sharedAnswers;
      serverRevision = revision;
      order.push("put-done");
      return true;
    },
    remove: () => {
      order.push("remove");
      sticky.removeItem(guestLocalDraftKey());
    },
    commit: commitGuestAdoption,
  };
  const [tabA, tabB] = await Promise.all([
    runGuestAdoptAttempt(mountBoth),
    runGuestAdoptAttempt(mountBoth),
  ]);
  assert.equal(sharedPuts, 1, "veralteter Speicher: trotzdem nur ein PUT");
  assert.deepEqual([tabA.status, tabB.status].sort(), ["adopted", "already-adopted"]);
  const second = tabA.status === "already-adopted" ? tabA : tabB;
  assert.equal(second.refresh, true);
  assert.notEqual(second.status, "ask");
  const putAt = order.indexOf("put-done");
  const removeAt = order.indexOf("remove");
  const secondGet = order.indexOf("get", putAt);
  assert.ok(putAt > 0 && removeAt > putAt && secondGet > removeAt, "das Lock hält bis nach dem Entfernen");

  let equalPuts = 0;
  const equalStorage = new StickyStorage(stickyInner);
  const equalTab = await runGuestAdoptAttempt({
    storage: equalStorage,
    now: () => raceNow,
    facts: { ...adoptFacts, targetExists: true, targetRevision: 9 },
    lock: mutex(),
    intent: "mount",
    loadServer: async () => ({
      ok: true,
      draft: { revision: 4, answers: stripEmptyIntakeCards(normalizeIntakeAnswers(sharedAnswers)) },
    }),
    put: async () => {
      equalPuts += 1;
      return true;
    },
    remove: () => equalStorage.removeItem(guestLocalDraftKey()),
    commit: commitGuestAdoption,
  });
  assert.equal(equalPuts, 0, "gleicher Server-Entwurf wird nicht noch einmal geschrieben");
  assert.equal(equalTab.status, "already-adopted");
  assert.equal(equalTab.refresh, true);
  assert.notEqual(equalTab.status, "ask");

  let dialogPuts = 0;
  const dialogTab = await runGuestAdoptAttempt({
    storage: equalStorage,
    now: () => raceNow,
    facts: { ...adoptFacts, targetExists: false },
    lock: mutex(),
    intent: "mount",
    loadServer: async () => ({
      ok: true,
      draft: { revision: 2, answers: { ...emptyAnswers(), gf: "Andere GmbH" } },
    }),
    put: async () => {
      dialogPuts += 1;
      return true;
    },
    remove: () => undefined,
    commit: commitGuestAdoption,
  });
  assert.equal(dialogPuts, 0);
  assert.equal(dialogTab.status, "ask", "ein anderer Server-Entwurf bleibt der Konfliktdialog");
  assert.equal(dialogTab.refresh, false);

  const failingStorage = new MemoryStorage();
  failingStorage.setItem(guestLocalDraftKey(), JSON.stringify({ answers: sharedAnswers, step: 1, savedAt: new Date(raceNow).toISOString(), revision: 1 }));
  let failPuts = 0;
  const failedGet = await runGuestAdoptAttempt({
    storage: failingStorage,
    now: () => raceNow,
    facts: adoptFacts,
    lock: mutex(),
    intent: "mount",
    loadServer: async () => ({ ok: false }),
    put: async () => {
      failPuts += 1;
      return true;
    },
    remove: () => removeGuestDraftEntry(failingStorage),
    commit: commitGuestAdoption,
  });
  assert.equal(failPuts, 0);
  assert.equal(failedGet.status, "unknown");
  assert.equal(failedGet.refresh, false);
  assert.ok(failingStorage.getItem(guestLocalDraftKey()), "bei einem fehlgeschlagenen Lesen bleibt der Gast-Eintrag");

  assert.ok(adoptUi.includes('cache: "no-store"') && adoptUi.includes('credentials: "same-origin"'), "der frische GET umgeht den Cache");
  assert.ok(adoptUi.includes("guestAdoptDraftQuery(facts)"), "der GET nutzt dieselbe Entwurfskennung wie der PUT");
  const query = guestAdoptDraftQuery(adoptFacts);
  assert.ok(query.startsWith("/api/intake/draft?"));
  assert.ok(query.includes(`draftKey=${encodeURIComponent(adoptFacts.draftKey)}`));
  assert.ok(query.includes(`entityId=${encodeURIComponent(adoptFacts.entityId)}`) || query.includes("entityId="));
  assert.ok(query.includes("modus=gesamt"));

  if (savedGuest === undefined) delete process.env.INTAKE_GUEST_START_ENABLED;
  else process.env.INTAKE_GUEST_START_ENABLED = savedGuest;
  if (savedModel === undefined) delete process.env.PRICING_MODEL;
  else process.env.PRICING_MODEL = savedModel;
  if (savedLogin === undefined) delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
  else process.env.INTAKE_LOGIN_FIRST_ENABLED = savedLogin;

  console.log("check-guest-start: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
