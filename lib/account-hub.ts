import type { Entity } from "@/lib/entities";
import { groupDocumentFamilies, type DocumentFamily } from "@/lib/documents";
import { isUndeliveredDraft, openDraftCompany, openDraftLabel } from "@/lib/open-drafts";
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import type { SheetRow } from "@/lib/types";

export type AccountCompanyCard = {
  entity: Entity | null;
  families: DocumentFamily[];
  continueDrafts: IntakeDraft[];
};

export type AccountHub = {
  groups: AccountCompanyCard[];
  /** Undelivered drafts. A draft that already sits on a company card is not repeated. */
  openDrafts: IntakeDraft[];
};

function normName(value: unknown): string {
  return textId(value).toLowerCase().replace(/\s+/g, " ");
}

function textId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function knownEntity(entities: readonly Entity[], entityId: unknown): Entity | null {
  const id = textId(entityId);
  if (!id) return null;
  return entities.find((entity) => entity.entityId === id) ?? null;
}

function uniqueEntityByName(entities: readonly Entity[], name: unknown): Entity | null {
  const key = normName(name);
  if (!key) return null;
  const matches = entities.filter((entity) => normName(entity.name) === key);
  return matches.length === 1 ? matches[0] ?? null : null;
}

function soleEntity(entities: readonly Entity[]): Entity | null {
  return entities.length === 1 ? entities[0] ?? null : null;
}

function entityForFamily(
  family: DocumentFamily,
  entities: readonly Entity[],
  drafts: readonly IntakeDraft[],
): Entity | null {
  const fromLatest = knownEntity(entities, family.latest.entityId);
  if (fromLatest) return fromLatest;
  for (const row of family.versions) {
    const found = knownEntity(entities, row.entityId);
    if (found) return found;
  }
  const documentIds = new Set(
    family.versions.map((row) => textId(row.documentId)).filter(Boolean),
  );
  const sessionIds = new Set(
    family.versions.map((row) => textId(row.stripeSessionId)).filter(Boolean),
  );
  for (const draft of drafts) {
    const documentId = textId(draft.documentId);
    const sessionId = textId(draft.stripeSessionId);
    const related =
      (documentId && documentIds.has(documentId)) || (sessionId && sessionIds.has(sessionId));
    if (!related) continue;
    const found = knownEntity(entities, draft.entityId);
    if (found) return found;
  }
  return (
    uniqueEntityByName(entities, family.latest.company) ?? soleEntity(entities)
  );
}

function entityByName(entities: readonly Entity[], name: unknown): Entity | null {
  const key = normName(name);
  if (!key) return null;
  return entities.find((entity) => normName(entity.name) === key) ?? null;
}

function entityForDraft(draft: IntakeDraft, entities: readonly Entity[]): Entity | null {
  return (
    knownEntity(entities, draft.entityId) ??
    uniqueEntityByName(entities, openDraftCompany(draft)) ??
    entityByName(entities, openDraftCompany(draft)) ??
    soleEntity(entities)
  );
}

function preferOpenDraft(current: IntakeDraft, next: IntakeDraft): IntakeDraft {
  const currentEntity = textId(current.entityId);
  const nextEntity = textId(next.entityId);
  if (currentEntity && !nextEntity) return current;
  if (nextEntity && !currentEntity) return next;
  return textId(next.updatedAt).localeCompare(textId(current.updatedAt)) >= 0 ? next : current;
}

/** One continue link per checkout before the intake is submitted. */
function dedupeOpenDrafts(drafts: readonly IntakeDraft[]): IntakeDraft[] {
  const bySession = new Map<string, IntakeDraft>();
  const rest: IntakeDraft[] = [];
  for (const draft of drafts) {
    const session = textId(draft.stripeSessionId);
    if (!session) {
      rest.push(draft);
      continue;
    }
    const prev = bySession.get(session);
    bySession.set(session, prev ? preferOpenDraft(prev, draft) : draft);
  }
  return [...bySession.values(), ...rest];
}

/**
 * Company cards for the hub. An open draft stays on its firm with
 * „Weiter ausfüllen“. A submitted document stays on its firm even when the
 * row itself has no entity id, as long as the firm is unambiguous.
 */
export function accountCompanyCards(
  entities: readonly Entity[],
  docs: readonly SheetRow[],
  drafts: readonly IntakeDraft[],
): AccountHub {
  const families = groupDocumentFamilies([...docs]);
  const byEntity = new Map<string, DocumentFamily[]>();
  const unbound: DocumentFamily[] = [];
  for (const family of families) {
    const entity = entityForFamily(family, entities, drafts);
    if (!entity) {
      unbound.push(family);
      continue;
    }
    const list = byEntity.get(entity.entityId) ?? [];
    list.push(family);
    byEntity.set(entity.entityId, list);
  }

  const openDrafts = dedupeOpenDrafts(drafts.filter((draft) => isUndeliveredDraft(draft, docs)));
  const draftsByEntity = new Map<string, IntakeDraft[]>();
  for (const draft of openDrafts) {
    const entity = entityForDraft(draft, entities);
    if (!entity) continue;
    const list = draftsByEntity.get(entity.entityId) ?? [];
    list.push(draft);
    draftsByEntity.set(entity.entityId, list);
  }

  const groups: AccountCompanyCard[] = entities.map((entity) => ({
    entity,
    families: byEntity.get(entity.entityId) ?? [],
    continueDrafts: draftsByEntity.get(entity.entityId) ?? [],
  }));
  if (unbound.length > 0) {
    groups.push({ entity: null, families: unbound, continueDrafts: [] });
  }
  return { groups, openDrafts };
}

/** Drafts that are not already rendered inside a company card. */
export function draftsNotOnCompanyCard(hub: AccountHub): IntakeDraft[] {
  const onCard = hub.groups.flatMap((group) => group.continueDrafts);
  const keys = new Set(onCard.map((draft) => draft.draftKey));
  const sessions = new Set(onCard.map((draft) => textId(draft.stripeSessionId)).filter(Boolean));
  const labels = new Set(
    onCard
      .map((draft) => openDraftLabel(draft))
      .filter((label) => label && label !== "Verfahrensdokumentation"),
  );
  return hub.openDrafts.filter((draft) => {
    if (keys.has(draft.draftKey)) return false;
    const session = textId(draft.stripeSessionId);
    if (session && sessions.has(session)) return false;
    const label = openDraftLabel(draft);
    return !label || !labels.has(label);
  });
}
