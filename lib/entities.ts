import { emailsEqual } from "@/lib/types";

export const MAX_ENTITIES_PER_ACCOUNT = 5;
export const DEFAULT_ENTITY_NAME = "Meine Firma";

export type Entity = {
  entityId: string;
  userEmail: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  stnr: string;
  ustId: string;
  createdAt: string;
  updatedAt: string;
};

export type EntityInput = {
  name: string;
  street?: string;
  zip?: string;
  city?: string;
  stnr?: string;
  ustId?: string;
};

export const ENTITY_SHEET_COLUMNS = [
  "entity_id",
  "user_email",
  "name",
  "street",
  "zip",
  "city",
  "stnr",
  "ust_id",
  "created_at",
  "updated_at",
] as const;

export type EntitySheetColumn = (typeof ENTITY_SHEET_COLUMNS)[number];

export const ENTITY_SHEET_COLUMN_FIELDS = {
  entity_id: "entityId",
  user_email: "userEmail",
  name: "name",
  street: "street",
  zip: "zip",
  city: "city",
  stnr: "stnr",
  ust_id: "ustId",
  created_at: "createdAt",
  updated_at: "updatedAt",
} as const satisfies Record<EntitySheetColumn, keyof Entity>;

export class EntityLimitError extends Error {
  readonly code = "limit" as const;
  readonly max = MAX_ENTITIES_PER_ACCOUNT;

  constructor(readonly count: number) {
    super(`Maximal ${MAX_ENTITIES_PER_ACCOUNT} Firmen pro Konto.`);
    this.name = "EntityLimitError";
  }
}

export function emptyEntity(): Entity {
  return {
    entityId: "",
    userEmail: "",
    name: "",
    street: "",
    zip: "",
    city: "",
    stnr: "",
    ustId: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function normalizeEntityInput(input: EntityInput): EntityInput {
  return {
    name: input.name.trim(),
    street: (input.street ?? "").trim(),
    zip: (input.zip ?? "").trim(),
    city: (input.city ?? "").trim(),
    stnr: (input.stnr ?? "").trim(),
    ustId: (input.ustId ?? "").trim(),
  };
}

export function toEntity(
  email: string,
  input: EntityInput,
  entityId: string,
  createdAt = new Date().toISOString(),
): Entity {
  const fields = normalizeEntityInput(input);
  return {
    entityId,
    userEmail: email.trim().toLowerCase(),
    name: fields.name,
    street: fields.street ?? "",
    zip: fields.zip ?? "",
    city: fields.city ?? "",
    stnr: fields.stnr ?? "",
    ustId: fields.ustId ?? "",
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const ENTITY_HEADER_FIELDS: Record<string, keyof Entity> = (() => {
  const map: Record<string, keyof Entity> = {};
  for (const [column, field] of Object.entries(ENTITY_SHEET_COLUMN_FIELDS) as Array<
    [EntitySheetColumn, keyof Entity]
  >) {
    map[column] = field;
    map[normalizeHeaderKey(column)] = field;
    map[field] = field;
    map[field.toLowerCase()] = field;
  }
  return map;
})();

export function entityFieldForHeader(header: string): keyof Entity | undefined {
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  return (
    ENTITY_HEADER_FIELDS[trimmed] ?? ENTITY_HEADER_FIELDS[normalizeHeaderKey(trimmed)]
  );
}

export function entitySheetValues(
  entity: Entity,
  header: readonly string[] = ENTITY_SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field =
      entityFieldForHeader(col) ?? ENTITY_SHEET_COLUMN_FIELDS[col as EntitySheetColumn];
    return field ? entity[field] : "";
  });
}

export function parseEntity(header: string[], values: string[]): Entity {
  const entity = emptyEntity();
  header.forEach((col, index) => {
    const field = entityFieldForHeader(col);
    if (field) {
      entity[field] = String(values[index] ?? "").trim();
    }
  });
  return entity;
}

export function coerceEntity(value: unknown): Entity | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const entity = { ...emptyEntity(), ...(value as Partial<Entity>) };
  if (!entity.entityId && typeof raw.entity_id === "string") {
    entity.entityId = raw.entity_id;
  }
  if (!entity.userEmail && typeof raw.user_email === "string") {
    entity.userEmail = raw.user_email;
  }
  if (!entity.ustId && typeof raw.ust_id === "string") {
    entity.ustId = raw.ust_id;
  }
  if (!entity.createdAt && typeof raw.created_at === "string") {
    entity.createdAt = raw.created_at;
  }
  if (!entity.updatedAt && typeof raw.updated_at === "string") {
    entity.updatedAt = raw.updated_at;
  }
  return entity.entityId ? entity : null;
}

export function latestEntities(rows: Entity[]): Entity[] {
  const map = new Map<string, Entity>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const prev = map.get(row.entityId);
    if (!prev || row.updatedAt.localeCompare(prev.updatedAt) >= 0) {
      map.set(row.entityId, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    const created = a.createdAt.localeCompare(b.createdAt);
    if (created !== 0) return created;
    return a.name.localeCompare(b.name, "de");
  });
}

export function entitiesForEmail(rows: Entity[], email: string): Entity[] {
  if (!email.trim()) return [];
  return latestEntities(rows.filter((row) => emailsEqual(row.userEmail, email)));
}

export function formatEntityAddress(entity: Pick<Entity, "street" | "zip" | "city">): string {
  const line = [entity.zip, entity.city].filter((part) => part.trim()).join(" ");
  return [entity.street.trim(), line].filter(Boolean).join(", ");
}

export function entityCapReached(count: number): boolean {
  return count >= MAX_ENTITIES_PER_ACCOUNT;
}
