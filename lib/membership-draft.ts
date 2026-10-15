/**
 * Entwurf einer Mitwirkenden: derselbe Blob des Inhabers, nur zugewiesene Module.
 * Die Mitgliedschaft ist kein Besitz. PDF, Checkout und session:-Schlüssel bleiben beim Inhaber.
 */
import { emailFromDraftKey } from "@/lib/checkout-access";
import {
  draftRevision,
  incomingDraftWins,
  normalizeDraftKey,
  type IntakeDraft,
} from "@/lib/intake-draft-shared";
import { MODULE, isKernModul, modulById, modulFragen } from "@/lib/module/katalog";
import { effectiveModulStatus, isGesamt, modulFortschritt } from "@/lib/module/status";
import type { Membership } from "@/lib/memberships";
import { moduleIdList } from "@/lib/memberships";
import { emailsEqual, emptyAnswers, type IntakeAnswers } from "@/lib/types";

export type MemberRef = Pick<
  Membership,
  "ownerEmail" | "memberEmail" | "entityId" | "moduleIds" | "status"
>;

export type MemberDraftGrant = {
  ownerEmail: string;
  entityId: string;
  moduleIds: string;
  draftKey: string;
};

export type MemberDraftDecision =
  | { kind: "skip" }
  | { kind: "deny" }
  | { kind: "allow"; grant: MemberDraftGrant };

const QUESTION_MODULES = new Map<string, string[]>();

function indexQuestions(): void {
  if (QUESTION_MODULES.size > 0) return;
  for (const modul of MODULE) {
    const ids = new Set<string>([
      ...modul.catalogIds,
      ...modulFragen(modul).map((question) => question.id),
    ]);
    for (const id of ids) {
      const list = QUESTION_MODULES.get(id) ?? [];
      list.push(modul.id);
      QUESTION_MODULES.set(id, list);
    }
  }
}

export function modulesForQuestion(questionId: string): string[] {
  indexQuestions();
  return QUESTION_MODULES.get(questionId) ?? [];
}

/**
 * Module, die der Inhaber für die Firma aktiv hat.
 * Kernmodule bleiben immer dabei. „nicht vorhanden“ ist abgeschaltet.
 * Ohne Gesamtdokument sind Kern- und Regelmodule aktiv, Betriebsmodule noch nicht.
 */
export function firmActiveModuleIds(answers: IntakeAnswers | null | undefined): string[] {
  const source = answers ?? emptyAnswers();
  const gesamt = isGesamt(source);
  return MODULE.filter((modul) => {
    if (isKernModul(modul.id)) return true;
    if (!gesamt) return modul.typ === "regel";
    return effectiveModulStatus(source, modul.id).status !== "nicht_vorhanden";
  }).map((modul) => modul.id);
}

/** Leer heißt: alle aktiven Module. Eine Liste schaltet abgeschaltete Module nicht ein. */
export function allowedModuleIds(
  moduleIds: string | readonly string[],
  answers: IntakeAnswers | null | undefined,
): string[] {
  const requested = typeof moduleIds === "string" ? moduleIdList(moduleIds) : [...moduleIds];
  const active = new Set(firmActiveModuleIds(answers));
  const list = requested.length > 0 ? requested : [...active];
  return list.filter((id) => active.has(id) && modulById(id));
}

export function questionAllowed(questionId: string, allowed: ReadonlySet<string>): boolean {
  return modulesForQuestion(questionId).some((id) => allowed.has(id));
}

export function entityIdFromDraftKey(draftKey: string): string {
  if (!draftKey.startsWith("email:")) return "";
  const parts = draftKey.slice("email:".length).split(":");
  if (parts.length < 3) return "";
  return parts[parts.length - 2] ?? "";
}

export function modusFromDraftKey(draftKey: string): "gesamt" | "bereich" {
  return draftKey.endsWith(":bereich") ? "bereich" : "gesamt";
}

export function grantMemberDraft(input: {
  sessionEmail: string;
  draftKey: string;
  entityId: string;
  membership: MemberRef | null;
  document: { email: string; entityId: string } | null;
}): MemberDraftDecision {
  const membership = input.membership;
  const session = input.sessionEmail.trim();
  if (!membership || membership.status !== "active") return { kind: "skip" };
  if (!emailsEqual(membership.memberEmail, session)) return { kind: "skip" };
  if (emailsEqual(membership.ownerEmail, session)) return { kind: "skip" };
  if (!input.entityId || membership.entityId !== input.entityId) return { kind: "deny" };

  const key = input.draftKey.trim();
  if (key.startsWith("session:")) return { kind: "deny" };

  if (key.startsWith("doc:") || key.startsWith("area:")) {
    const document = input.document;
    if (!document) return { kind: "deny" };
    if (document.entityId !== membership.entityId) return { kind: "deny" };
    if (!emailsEqual(document.email, membership.ownerEmail)) return { kind: "deny" };
    return {
      kind: "allow",
      grant: {
        ownerEmail: membership.ownerEmail,
        entityId: membership.entityId,
        moduleIds: membership.moduleIds,
        draftKey: key,
      },
    };
  }

  if (key.startsWith("email:")) {
    const keyOwner = emailFromDraftKey(key);
    if (
      keyOwner &&
      !emailsEqual(keyOwner, membership.ownerEmail) &&
      !emailsEqual(keyOwner, session)
    ) {
      return { kind: "deny" };
    }
    return {
      kind: "allow",
      grant: {
        ownerEmail: membership.ownerEmail,
        entityId: membership.entityId,
        moduleIds: membership.moduleIds,
        draftKey: normalizeDraftKey({
          email: membership.ownerEmail,
          entityId: membership.entityId,
          modus: modusFromDraftKey(key),
        }),
      },
    };
  }

  return { kind: "deny" };
}

export function storedDraftMatchesMember(
  stored: { email?: string; entityId?: string } | null,
  grant: MemberDraftGrant,
): boolean {
  if (!stored) return true;
  if (stored.email && !emailsEqual(stored.email, grant.ownerEmail)) return false;
  if (stored.entityId && stored.entityId !== grant.entityId) return false;
  return true;
}

export type RevisionVerdict = "ok" | "stale" | "other";

/**
 * Höhere Revision gewinnt. Gleichstand einer anderen Mail ist ein Konflikt.
 * Dieselbe Mail darf ihren eigenen Gleichstand erneut schreiben.
 */
export function revisionDecision(input: {
  sessionEmail: string;
  incomingRevision?: number;
  clientUpdatedAt?: string;
  stored: Pick<IntakeDraft, "revision" | "updatedAt" | "updatedBy"> | null;
}): RevisionVerdict {
  if (!input.stored) return "ok";
  const wins = incomingDraftWins(
    { revision: input.incomingRevision, clientUpdatedAt: input.clientUpdatedAt },
    input.stored,
  );
  if (!wins) return "stale";
  const incoming = draftRevision({ revision: input.incomingRevision });
  const existing = draftRevision(input.stored);
  const author = input.stored.updatedBy?.trim() ?? "";
  if (
    incoming === existing &&
    author &&
    !emailsEqual(author, input.sessionEmail)
  ) {
    return "other";
  }
  return "ok";
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]));
  }
  return value ?? null;
}

function moduleControls(answers: IntakeAnswers | null | undefined): unknown {
  const state = answers?.module;
  if (!state) return null;
  return {
    version: state.version,
    check: state.check ?? {},
    status: state.status ?? {},
    stammdaten: state.stammdaten ?? {},
    vorlage: state.vorlage ?? "",
    software: state.software ?? [],
    branchenArt: state.branchenArt ?? [],
  };
}

function withoutModuleAndCatalog(answers: IntakeAnswers): unknown {
  const rest = { ...answers } as Record<string, unknown>;
  delete rest.katalog;
  delete rest.module;
  return rest;
}

/**
 * Der gesamte Entwurf wird geschrieben. Geändert werden dürfen nur Frage-IDs
 * der zugewiesenen Module. Abweichungen außerhalb davon lehnen den PUT ab.
 */
export function answersStayInAssignment(
  before: IntakeAnswers,
  after: IntakeAnswers,
  allowedIds: readonly string[],
): boolean {
  before = JSON.parse(JSON.stringify(before)) as IntakeAnswers;
  after = JSON.parse(JSON.stringify(after)) as IntakeAnswers;
  if (stable(moduleControls(before)) !== stable(moduleControls(after))) return false;
  if (stable(withoutModuleAndCatalog(before)) !== stable(withoutModuleAndCatalog(after))) {
    return false;
  }
  const allowed = new Set(allowedIds);
  const beforeKat = before.katalog ?? {};
  const afterKat = after.katalog ?? {};
  const ids = new Set([...Object.keys(beforeKat), ...Object.keys(afterKat)]);
  for (const id of ids) {
    if (stable(beforeKat[id] ?? null) === stable(afterKat[id] ?? null)) continue;
    if (!questionAllowed(id, allowed)) return false;
  }
  return true;
}

export function moduleProgressLabel(answers: IntakeAnswers, moduleId: string): string {
  const progress = modulFortschritt(answers, moduleId);
  if (progress.beantwortet <= 0) return "noch leer";
  return `${progress.beantwortet} von ${progress.gesamt} Fragen`;
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const hour = pick("hour");
  const minute = pick("minute");
  if (!day || !month || !hour || !minute) return "";
  return `${day}.${month}. ${hour}:${minute}`;
}

export type MemberFirmView = {
  entityId: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  invitedBy: string;
};

/** Firmenantwort an eine Mitwirkende: Name und Anschrift, ohne Steuernummer. */
export function memberFirmView(
  entity: { entityId: string; name: string; street: string; zip: string; city: string },
  invitedBy: string,
): MemberFirmView {
  return {
    entityId: entity.entityId,
    name: entity.name,
    street: entity.street,
    zip: entity.zip,
    city: entity.city,
    invitedBy: invitedBy.trim().toLowerCase(),
  };
}

export function memberAddressLine(view: Pick<MemberFirmView, "street" | "zip" | "city">): string {
  const place = [view.zip.trim(), view.city.trim()].filter(Boolean).join(" ");
  return [view.street.trim(), place].filter(Boolean).join(", ");
}
