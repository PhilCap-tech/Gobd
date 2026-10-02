/**
 * Account-hub display name. Login stays the session e-mail.
 * Persisted on the `profiles` sheet (or `.data/profiles.json`), not in the cookie.
 */

export const PROFILE_NAME_MAX = 80;

export class ProfileNameError extends Error {
  readonly code = "name" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProfileNameError";
  }
}

export type AccountProfile = {
  email: string;
  name: string;
  updatedAt: string;
};

export const PROFILE_SHEET_COLUMNS = ["email", "name", "updated_at"] as const;

export type ProfileSheetColumn = (typeof PROFILE_SHEET_COLUMNS)[number];

export const PROFILE_SHEET_COLUMN_FIELDS = {
  email: "email",
  name: "name",
  updated_at: "updatedAt",
} as const satisfies Record<ProfileSheetColumn, keyof AccountProfile>;

export function emptyAccountProfile(): AccountProfile {
  return { email: "", name: "", updatedAt: "" };
}

/** Trimmed contact name. Empty clears the display name. Over-long names are rejected. */
export function normalizeProfileName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > PROFILE_NAME_MAX) {
    throw new ProfileNameError(
      `Der Name darf höchstens ${PROFILE_NAME_MAX} Zeichen haben.`,
    );
  }
  return cleaned;
}

function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const PROFILE_HEADER_FIELDS: Record<string, keyof AccountProfile> = (() => {
  const map: Record<string, keyof AccountProfile> = {};
  for (const [column, field] of Object.entries(PROFILE_SHEET_COLUMN_FIELDS) as Array<
    [ProfileSheetColumn, keyof AccountProfile]
  >) {
    map[column] = field;
    map[normalizeHeaderKey(column)] = field;
    map[field] = field;
    map[field.toLowerCase()] = field;
  }
  return map;
})();

export function profileFieldForHeader(
  header: string,
): keyof AccountProfile | undefined {
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  return (
    PROFILE_HEADER_FIELDS[trimmed] ??
    PROFILE_HEADER_FIELDS[normalizeHeaderKey(trimmed)]
  );
}

export function profileSheetValues(
  profile: AccountProfile,
  header: readonly string[] = PROFILE_SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field =
      profileFieldForHeader(col) ??
      PROFILE_SHEET_COLUMN_FIELDS[col as ProfileSheetColumn];
    return field ? profile[field] : "";
  });
}

export function parseAccountProfile(
  header: string[],
  values: string[],
): AccountProfile {
  const profile = emptyAccountProfile();
  header.forEach((col, index) => {
    const field = profileFieldForHeader(col);
    if (field) {
      profile[field] = String(values[index] ?? "").trim();
    }
  });
  profile.email = profile.email.trim().toLowerCase();
  return profile;
}

export function coerceAccountProfile(value: unknown): AccountProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const profile = {
    ...emptyAccountProfile(),
    ...(value as Partial<AccountProfile>),
  };
  if (!profile.email && typeof raw.email === "string") {
    profile.email = raw.email;
  }
  if (!profile.updatedAt && typeof raw.updated_at === "string") {
    profile.updatedAt = raw.updated_at;
  }
  profile.email = String(profile.email ?? "")
    .trim()
    .toLowerCase();
  profile.name = String(profile.name ?? "").trim();
  profile.updatedAt = String(profile.updatedAt ?? "").trim();
  return profile.email ? profile : null;
}
