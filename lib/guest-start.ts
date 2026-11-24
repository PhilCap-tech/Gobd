/**
 * Gaststart (Variante A), nur bei INTAKE_GUEST_START_ENABLED.
 * Antworten bleiben im Browser, bis eine bestätigte Sitzung sie übernimmt.
 * Keine neuen Messzähler, kein Beacon, kein Speicher für die Messung.
 */
import {
  INTAKE_DRAFT_STORAGE_PREFIX,
  readIntakeDraftEntry,
  sweepIntakeDrafts,
  type StorageLike,
} from "@/lib/browser-storage-expiry";
import { draftRevision, type IntakeDraftSnapshot } from "@/lib/intake-draft-shared";

/** Kennung des Eintrags ohne Sitzung. Nicht ein Server-Schlüssel. */
export const GUEST_DRAFT_ID = "guest";

export function guestLocalDraftKey(): string {
  return `${INTAKE_DRAFT_STORAGE_PREFIX}${GUEST_DRAFT_ID}`;
}

/** Wie die Draft-Route: höchstens so viele offene unbezahlte Entwürfe. */
export const GUEST_OPEN_DRAFT_LIMIT = 3;

/** Lead auf /fragebogen ohne Sitzung. Wortlaut Legal (B) c). */
export const GUEST_LEAD =
  "Sie können ohne Anmeldung beginnen. Ihre Angaben speichern wir zunächst nur in diesem Browser auf Ihrem Gerät. Erst wenn Sie sich mit Ihrer E-Mail-Adresse über einen Anmeldelink angemeldet haben, übernehmen wir sie in Ihr Konto; vor der Paketwahl ist die Anmeldung erforderlich. Bezahlt wird erst, wenn Sie die Dokumentation erstellen lassen.";

/** Dauerhinweis, solange keine Sitzung besteht. Wortlaut Legal (B) c). */
export const GUEST_DEVICE_NOTICE = "Ihre Angaben sind bisher nur in diesem Browser gespeichert.";

/** Freiwilliger Hinweis nach Modul 1, am E-Mail-Feld. Wortlaut Legal (B) c). */
export const GUEST_SAVE_HINT =
  "Ihre Angaben sind bisher nur in diesem Browser gespeichert. Wenn Sie Ihre E-Mail-Adresse angeben, erhalten Sie einen Anmeldelink. Öffnen Sie ihn in diesem Browser; dann übernehmen wir Ihre Angaben in Ihr Konto. Ein Passwort brauchen Sie nicht. Sie können auch ohne Anmeldung weitermachen.";

/** Pflicht-Anmeldung vor der Paketwahl. Wortlaut Legal (B) c). */
export const GUEST_PACKAGE_LOGIN =
  "Für die Paketwahl melden Sie sich bitte mit Ihrer E-Mail-Adresse an. Öffnen Sie den Anmeldelink in diesem Browser; dann übernehmen wir Ihre bisherigen Angaben in Ihr Konto.";

/** Kurzer Hinweis, wenn der Datei-Upload ohne Sitzung nicht geht. */
export const GUEST_UPLOAD_HINT = "Datei-Upload ist erst nach der Anmeldung möglich.";

export const GUEST_CONFLICT_PROMPT =
  "In Ihrem Konto ist bereits ein Entwurf gespeichert. Welchen Stand möchten Sie behalten? Behalten Sie den Stand aus diesem Browser, ersetzt er den Entwurf in Ihrem Konto. Behalten Sie den Stand aus Ihrem Konto, löschen wir die Angaben in diesem Browser.";

export const GUEST_ADOPT_BROWSER_LABEL = "Stand aus diesem Browser behalten";

export const GUEST_KEEP_ACCOUNT_LABEL = "Stand aus dem Konto behalten";

export const GUEST_DRAFT_LIMIT_HINT =
  "Sie haben bereits 3 offene Entwürfe. Bitte schließen Sie zuerst einen davon ab. Ihre Angaben in diesem Browser bleiben bis dahin hier gespeichert, höchstens 30 Tage nach der letzten Speicherung; beim Abmelden werden sie gelöscht.";

export const GUEST_KEEP_LOCAL_HINT =
  "Die Angaben aus diesem Browser konnten gerade nicht in Ihr Konto übernommen werden. Sie bleiben vorerst in diesem Browser gespeichert, höchstens 30 Tage nach der letzten Speicherung; beim Abmelden werden sie gelöscht. Laden Sie die Seite später neu, um es noch einmal zu versuchen.";

export const GUEST_WAIT_LABEL = "Bitte warten…";

/** Ohne Sitzung verlässt keine Antwort das Gerät. */
export function guestMayTransferAnswers(guestMode: boolean): boolean {
  return !guestMode;
}

export function guestUploadAllowed(guestMode: boolean): boolean {
  return !guestMode;
}

export const GUEST_DRAFT_TRANSFER_PATHS = ["autosave", "reload", "pagehide", "final"] as const;

export type GuestDraftTransferPath = (typeof GUEST_DRAFT_TRANSFER_PATHS)[number];

/**
 * Die vier Schreibwege von postServerDraft. Im Gastmodus endet der Weg
 * vor jedem fetch; der Body mit den Antworten wird nicht übergeben.
 */
export async function transferDraftAnswers<T>(input: {
  guestMode: boolean;
  path: GuestDraftTransferPath;
  body: T;
  fetchImpl: (url: string, init: { method: string; body: string; keepalive?: boolean }) => Promise<unknown>;
}): Promise<"blocked" | "sent"> {
  if (!guestMayTransferAnswers(input.guestMode)) return "blocked";
  await input.fetchImpl("/api/intake/draft", {
    method: "PUT",
    body: JSON.stringify(input.body),
    keepalive: input.path === "pagehide",
  });
  return "sent";
}

export async function transferModuleUpload(input: {
  guestMode: boolean;
  fetchImpl: (url: string, init: { method: string }) => Promise<unknown>;
}): Promise<"blocked" | "sent"> {
  if (!guestUploadAllowed(input.guestMode)) return "blocked";
  await input.fetchImpl("/api/module-upload", { method: "POST" });
  return "sent";
}

export type GuestAdoptAction = "skip" | "adopt" | "ask" | "limit";

/**
 * Übernahme nur mit bekannter Serverlage.
 * Bestehender Entwurf: nachfragen, nie still überschreiben.
 * Drei offene Entwürfe und kein Ziel-Entwurf: nichts schreiben, nichts löschen.
 */
export function planGuestAdoption(input: {
  hasLocalDraft: boolean;
  targetExists: boolean;
  openUnpaidCount: number;
}): GuestAdoptAction {
  if (!input.hasLocalDraft) return "skip";
  if (!input.targetExists && input.openUnpaidCount >= GUEST_OPEN_DRAFT_LIMIT) return "limit";
  if (input.targetExists) return "ask";
  return "adopt";
}

export function guestAdoptionSendsAnswers(input: {
  action: GuestAdoptAction;
  choice?: "browser" | "account";
}): boolean {
  if (input.action === "adopt") return true;
  return input.action === "ask" && input.choice === "browser";
}

/** Gast-Eintrag erst nach gelungener Übernahme oder nach der Entscheidung weg. */
export function guestEntryRemovedAfter(input: {
  action: GuestAdoptAction;
  choice?: "browser" | "account";
  putOk: boolean;
}): boolean {
  if (input.action === "limit" || input.action === "skip") return false;
  if (input.action === "adopt") return input.putOk;
  if (input.action === "ask" && input.choice === "account") return true;
  if (input.action === "ask" && input.choice === "browser") return input.putOk;
  return false;
}

export async function commitGuestAdoption(input: {
  action: GuestAdoptAction;
  choice?: "browser" | "account";
  put: () => Promise<boolean>;
  remove: () => void;
}): Promise<"idle" | "adopted" | "kept-account" | "kept-local" | "failed"> {
  if (input.action === "limit") return "kept-local";
  if (input.action === "skip") return "idle";
  if (!guestAdoptionSendsAnswers(input)) {
    if (guestEntryRemovedAfter({ action: input.action, choice: input.choice, putOk: false })) {
      input.remove();
      return "kept-account";
    }
    return "idle";
  }
  let ok = false;
  try {
    ok = await input.put();
  } catch {
    ok = false;
  }
  if (guestEntryRemovedAfter({ action: input.action, choice: input.choice, putOk: ok })) {
    input.remove();
    return "adopted";
  }
  return "failed";
}

export function guestAdoptRevision(localRevision: number, serverRevision: number): number {
  return Math.max(draftRevision({ revision: localRevision }), draftRevision({ revision: serverRevision }), 1);
}

/** Body der Übernahme. Kein Messmarker, kein zusätzlicher Zähler. */
export function guestAdoptPutBody(input: {
  draftKey: string;
  email: string;
  entityId: string;
  modus: string;
  snapshot: IntakeDraftSnapshot;
  serverRevision: number;
}): Record<string, unknown> {
  return {
    draftKey: input.draftKey,
    email: input.email,
    entityId: input.entityId,
    modus: input.modus,
    step: input.snapshot.step,
    stepId: input.snapshot.stepId,
    answers: input.snapshot.answers,
    revision: guestAdoptRevision(draftRevision(input.snapshot), input.serverRevision),
    change: input.snapshot.change,
    clientUpdatedAt: input.snapshot.savedAt,
  };
}

export function readGuestDraftSnapshot(storage: StorageLike, now: number): IntakeDraftSnapshot | null {
  const raw = readIntakeDraftEntry(storage, guestLocalDraftKey(), now);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IntakeDraftSnapshot & { adoptStartedAt?: unknown };
    if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object") return null;
    delete parsed.adoptStartedAt;
    return parsed;
  } catch {
    return null;
  }
}

export function removeGuestDraftEntry(storage: StorageLike): void {
  try {
    storage.removeItem(guestLocalDraftKey());
  } catch {
    /* Speicher gesperrt */
  }
}

/**
 * Exklusives Web Lock über Tabs. Hält nichts fest: kein neuer Speicher-Schlüssel.
 * Fehlt die API, bleibt `lock` null und es gilt der kurze Marker im Gast-Eintrag.
 */
export const GUEST_ADOPT_LOCK_NAME = "gobd-guest-adopt";

/** Ein laufender Übernahmeversuch ohne Web Lock blockt andere Tabs so lange. */
export const GUEST_ADOPT_MARKER_MAX_AGE_MS = 30 * 1000;

const GUEST_ADOPT_MARKER = "adoptStartedAt";

export type GuestAdoptLock = <T>(run: () => Promise<T>) => Promise<T>;

export type GuestAdoptIntent = "mount" | "browser" | "account";

export type GuestAdoptRunResult = {
  status: "ready" | "already-adopted" | "ask" | "limit" | "unknown" | "adopted" | "failed" | "kept-account" | "kept-local";
  /** Zweiter Tab: kein PUT, kein Dialog, die Seite einmal neu laden. */
  refresh: boolean;
};

type GuestEntryRecord = {
  adoptStartedAt?: unknown;
  answers?: unknown;
};

function readGuestEntry(storage: StorageLike): GuestEntryRecord | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(guestLocalDraftKey());
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestEntryRecord;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Alter des Markers in ms. Unlesbar: null. Liegt in der Zukunft: 0 (gilt als frisch). */
export function guestAdoptMarkerAgeMs(value: unknown, now: number): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  if (!text) return null;
  const ms = Number(text.split(":")[0]);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, now - ms);
}

/** Jünger als die Frist: ein anderer Tab übernimmt gerade. Älter: abgestürzter Tab, Marker gilt nicht. */
export function guestAdoptMarkerIsFresh(value: unknown, now: number, maxAgeMs = GUEST_ADOPT_MARKER_MAX_AGE_MS): boolean {
  const age = guestAdoptMarkerAgeMs(value, now);
  return age !== null && age < maxAgeMs;
}

function newAdoptClaim(now: number): string {
  const token = Math.random().toString(36).slice(2, 10);
  return `${now}:${token}`;
}

/** Marker nur im bestehenden Gast-Eintrag. Rückgabe blocked: frisch belegt oder nicht mehr unseres. */
function claimGuestAdoptMarker(storage: StorageLike, now: number): "claimed" | "blocked" | "gone" {
  const entry = readGuestEntry(storage);
  if (!entry?.answers || typeof entry.answers !== "object") return "gone";
  if (guestAdoptMarkerIsFresh(entry.adoptStartedAt, now)) return "blocked";
  const claim = newAdoptClaim(now);
  try {
    storage.setItem(guestLocalDraftKey(), JSON.stringify({ ...entry, [GUEST_ADOPT_MARKER]: claim }));
  } catch {
    return "blocked";
  }
  const again = readGuestEntry(storage);
  if (!again || again.adoptStartedAt !== claim) return "blocked";
  return "claimed";
}

function clearGuestAdoptMarker(storage: StorageLike): void {
  const entry = readGuestEntry(storage);
  if (!entry || entry.adoptStartedAt === undefined) return;
  const next = { ...entry };
  delete next.adoptStartedAt;
  try {
    storage.setItem(guestLocalDraftKey(), JSON.stringify(next));
  } catch {
    /* Speicher gesperrt */
  }
}

const refreshResult: GuestAdoptRunResult = { status: "already-adopted", refresh: true };

function resultOfCommit(status: GuestAdoptRunResult["status"]): GuestAdoptRunResult {
  return { status, refresh: false };
}

async function finishAdopt(input: {
  storage: StorageLike;
  now: number;
  snapshot: IntakeDraftSnapshot;
  action: "adopt" | "ask";
  choice?: "browser";
  put: (snapshot: IntakeDraftSnapshot) => Promise<boolean>;
  remove: () => void;
  clearMarkerOnFailure: boolean;
  commit: typeof commitGuestAdoption;
}): Promise<GuestAdoptRunResult> {
  const committed = await input.commit({
    action: input.action,
    choice: input.choice,
    put: () => input.put(input.snapshot),
    remove: input.remove,
  });
  if (committed === "failed" && input.clearMarkerOnFailure) clearGuestAdoptMarker(input.storage);
  if (committed === "adopted") return resultOfCommit("adopted");
  if (committed === "failed") return resultOfCommit("failed");
  return resultOfCommit("ready");
}

async function decideMounted(input: {
  storage: StorageLike;
  now: number;
  facts: GuestAdoptFacts;
  sawEntryBeforeLock: boolean;
  put: (snapshot: IntakeDraftSnapshot) => Promise<boolean>;
  remove: () => void;
  useMarker: boolean;
  commit: typeof commitGuestAdoption;
}): Promise<GuestAdoptRunResult> {
  if (input.useMarker) {
    const entry = readGuestEntry(input.storage);
    if (!entry?.answers || typeof entry.answers !== "object") {
      return input.sawEntryBeforeLock ? refreshResult : resultOfCommit("ready");
    }
    if (guestAdoptMarkerIsFresh(entry.adoptStartedAt, input.now)) return refreshResult;
  }
  const local = readGuestDraftSnapshot(input.storage, input.now);
  if (!local) return input.sawEntryBeforeLock ? refreshResult : resultOfCommit("ready");
  if (input.facts.status === "unknown") return resultOfCommit("unknown");
  const action = planGuestAdoption({
    hasLocalDraft: true,
    targetExists: input.facts.targetExists,
    openUnpaidCount: input.facts.openUnpaidCount,
  });
  if (action === "limit") return resultOfCommit("limit");
  if (action === "ask") return resultOfCommit("ask");
  if (action !== "adopt") return resultOfCommit("ready");
  if (input.useMarker) {
    const claim = claimGuestAdoptMarker(input.storage, input.now);
    if (claim !== "claimed") return refreshResult;
  }
  const fresh = readGuestDraftSnapshot(input.storage, input.now);
  if (!fresh) return refreshResult;
  return finishAdopt({
    storage: input.storage,
    now: input.now,
    snapshot: fresh,
    action: "adopt",
    put: input.put,
    remove: input.remove,
    clearMarkerOnFailure: input.useMarker,
    commit: input.commit,
  });
}

async function decideChoice(input: {
  storage: StorageLike;
  now: number;
  choice: "browser" | "account";
  put: (snapshot: IntakeDraftSnapshot) => Promise<boolean>;
  remove: () => void;
  useMarker: boolean;
  commit: typeof commitGuestAdoption;
}): Promise<GuestAdoptRunResult> {
  if (input.useMarker) {
    const entry = readGuestEntry(input.storage);
    if (!entry?.answers) return refreshResult;
    if (guestAdoptMarkerIsFresh(entry.adoptStartedAt, input.now)) return refreshResult;
    if (input.choice === "browser" && claimGuestAdoptMarker(input.storage, input.now) !== "claimed") {
      return refreshResult;
    }
  }
  const local = readGuestDraftSnapshot(input.storage, input.now);
  if (!local) return refreshResult;
  if (input.choice === "account") {
    input.remove();
    return resultOfCommit("kept-account");
  }
  return finishAdopt({
    storage: input.storage,
    now: input.now,
    snapshot: local,
    action: "ask",
    choice: "browser",
    put: input.put,
    remove: input.remove,
    clearMarkerOnFailure: input.useMarker,
    commit: input.commit,
  });
}

/**
 * Eine Übernahme je Gast-Eintrag.
 * Mit Lock: Entscheidung und, bei `adopt` bzw. der Browser-Wahl, das PUT
 * bleiben im Lock, danach wird der Eintrag entfernt.
 * Ohne Lock: kurzer Marker im selben Eintrag, danach einmal neu lesen.
 * Ein Tab, der den Eintrag nicht mehr vorfindet, schreibt nicht und lädt neu.
 */
export async function runGuestAdoptAttempt(input: {
  storage: StorageLike;
  now: () => number;
  facts: GuestAdoptFacts;
  lock: GuestAdoptLock | null;
  intent: GuestAdoptIntent;
  put: (snapshot: IntakeDraftSnapshot) => Promise<boolean>;
  remove: () => void;
  commit?: typeof commitGuestAdoption;
}): Promise<GuestAdoptRunResult> {
  const sawEntryBeforeLock = readGuestDraftSnapshot(input.storage, input.now()) !== null;
  const useMarker = input.lock === null;
  const commit = input.commit ?? commitGuestAdoption;

  const run = async (): Promise<GuestAdoptRunResult> => {
    const now = input.now();
    if (input.intent === "mount") {
      return decideMounted({
        storage: input.storage,
        now,
        facts: input.facts,
        sawEntryBeforeLock,
        put: input.put,
        remove: input.remove,
        useMarker,
        commit,
      });
    }
    return decideChoice({
      storage: input.storage,
      now,
      choice: input.intent,
      put: input.put,
      remove: input.remove,
      useMarker,
      commit,
    });
  };

  if (!input.lock) return run();
  if (input.intent === "mount" && !sawEntryBeforeLock) return resultOfCommit("ready");
  return input.lock(run);
}

/** 30-Tage-Lauf über alle übergebenen Speicher, unabhängig von der Seite. */
export function sweepIntakeDraftsOnView(storages: readonly StorageLike[], now: number): void {
  for (const storage of storages) sweepIntakeDrafts(storage, now);
}

export type GuestAdoptFacts = {
  status: "ready" | "unknown";
  draftKey: string;
  email: string;
  entityId: string;
  modus: "gesamt";
  targetExists: boolean;
  targetRevision: number;
  openUnpaidCount: number;
};
