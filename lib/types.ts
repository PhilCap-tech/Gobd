export type IntakeAnswers = {
  branchen: string[];
  rechtsform: string;
  mitarbeitende: string;
  fibu: string[];
  weitereSysteme: string;
  eingangsbelege: string[];
  ausgangsrechnungen: string[];
  archiv: string;
  hosting: string;
  backup: string[];
  zugriff: string;
  gf: string;
  buchhaltung: string;
  it: string;
  steuerberater: string;
  /** MVP Fragenkatalog. Absent on rows from the older five-step intake. */
  standort?: string;
  geltung?: string;
  vorsysteme?: string;
  seitWann?: string;
  formate?: string[];
  originalErhalt?: string;
  anbieterUnterlagen?: string;
  sichtung?: string;
  papierannahme?: string;
  scanZweck?: string;
  scanAufbewahrung?: string;
  papierlager?: string;
  erechnungVerfahren?: string;
  sachlichePruefung?: string;
  belegId?: string;
  loeschfreigabe?: string;
  wiederherstellungstest?: string;
  kontrollen?: string;
  dokumentenpflege?: string;
  anlagenliste?: string;
  fassungsrahmen?: string;
  fragen?: Partial<
    Record<string, { status: "bestätigt" | "geplant" | "unbekannt" | "nicht zutreffend"; text?: string }>
  >;
};

export type CheckoutIdentity = {
  email: string;
  company: string;
  stripeSessionId: string;
  stripeCustomerId: string;
  stub: boolean;
  entityId?: string;
};

export type SheetRow = {
  timestamp: string;
  stripeSessionId: string;
  stripeCustomerId: string;
  email: string;
  company: string;
  branchen: string;
  rechtsform: string;
  mitarbeitende: string;
  fibu: string;
  weitereSysteme: string;
  eingangsbelege: string;
  ausgangsrechnungen: string;
  archiv: string;
  hosting: string;
  backup: string;
  zugriff: string;
  gf: string;
  buchhaltung: string;
  it: string;
  steuerberater: string;
  status: string;
  deliveryStatus: string;
  documentId: string;
  parentDocumentId: string;
  pdfUrl: string;
  version: string;
  chapterContent: string;
  entityId: string;
  /** ISO date `YYYY-MM-DD`. Empty on rows created before versioning metadata. */
  validFrom: string;
  /** ISO date `YYYY-MM-DD`. Empty means “until the next Gültig-ab” (derived in the UI). */
  validTo: string;
  /** Why this version exists (Kurz-Changelog). */
  changeSummary: string;
  /** Who recorded the version (session email or free text). */
  changedBy: string;
  /** JSON map of MVP question statuses. Empty on older rows. */
  fragen: string;
};

export const SHEET_COLUMNS = [
  "timestamp",
  "stripe_session_id",
  "stripe_customer_id",
  "email",
  "company",
  "branchen",
  "rechtsform",
  "mitarbeitende",
  "fibu",
  "weitere_systeme",
  "eingangsbelege",
  "ausgangsrechnungen",
  "archiv",
  "hosting",
  "backup",
  "zugriff",
  "gf",
  "buchhaltung",
  "it",
  "steuerberater",
  "status",
  "delivery_status",
  "document_id",
  "pdf_url",
  "version",
  "parent_document_id",
  "chapter_content",
  "entity_id",
  "valid_from",
  "valid_to",
  "change_summary",
  "changed_by",
  "fragen",
] as const;

export type SheetColumn = (typeof SHEET_COLUMNS)[number];

export const SHEET_COLUMN_FIELDS = {
  timestamp: "timestamp",
  stripe_session_id: "stripeSessionId",
  stripe_customer_id: "stripeCustomerId",
  email: "email",
  company: "company",
  branchen: "branchen",
  rechtsform: "rechtsform",
  mitarbeitende: "mitarbeitende",
  fibu: "fibu",
  weitere_systeme: "weitereSysteme",
  eingangsbelege: "eingangsbelege",
  ausgangsrechnungen: "ausgangsrechnungen",
  archiv: "archiv",
  hosting: "hosting",
  backup: "backup",
  zugriff: "zugriff",
  gf: "gf",
  buchhaltung: "buchhaltung",
  it: "it",
  steuerberater: "steuerberater",
  status: "status",
  delivery_status: "deliveryStatus",
  document_id: "documentId",
  pdf_url: "pdfUrl",
  version: "version",
  parent_document_id: "parentDocumentId",
  chapter_content: "chapterContent",
  entity_id: "entityId",
  valid_from: "validFrom",
  valid_to: "validTo",
  change_summary: "changeSummary",
  changed_by: "changedBy",
  fragen: "fragen",
} as const satisfies Record<SheetColumn, keyof SheetRow>;

export function emptyAnswers(): IntakeAnswers {
  return {
    branchen: [],
    rechtsform: "",
    mitarbeitende: "",
    fibu: [],
    weitereSysteme: "",
    eingangsbelege: [],
    ausgangsrechnungen: [],
    archiv: "",
    hosting: "",
    backup: [],
    zugriff: "",
    gf: "",
    buchhaltung: "",
    it: "",
    steuerberater: "",
    standort: "",
    geltung: "",
    vorsysteme: "",
    seitWann: "",
    formate: [],
    originalErhalt: "",
    anbieterUnterlagen: "",
    sichtung: "",
    papierannahme: "",
    scanZweck: "",
    scanAufbewahrung: "",
    papierlager: "",
    erechnungVerfahren: "",
    sachlichePruefung: "",
    belegId: "",
    loeschfreigabe: "",
    wiederherstellungstest: "",
    kontrollen: "",
    dokumentenpflege: "",
    anlagenliste: "",
    fassungsrahmen: "",
    fragen: {},
  };
}

export function emptySheetRow(): SheetRow {
  return {
    timestamp: "",
    stripeSessionId: "",
    stripeCustomerId: "",
    email: "",
    company: "",
    branchen: "",
    rechtsform: "",
    mitarbeitende: "",
    fibu: "",
    weitereSysteme: "",
    eingangsbelege: "",
    ausgangsrechnungen: "",
    archiv: "",
    hosting: "",
    backup: "",
    zugriff: "",
    gf: "",
    buchhaltung: "",
    it: "",
    steuerberater: "",
    status: "",
    deliveryStatus: "",
    documentId: "",
    parentDocumentId: "",
    pdfUrl: "",
    version: "",
    chapterContent: "",
    entityId: "",
    validFrom: "",
    validTo: "",
    changeSummary: "",
    changedBy: "",
    fragen: "",
  };
}

export function toSheetRow(input: {
  identity: CheckoutIdentity;
  answers?: Partial<IntakeAnswers>;
  status: string;
  deliveryStatus: string;
  documentId?: string;
  parentDocumentId?: string;
  pdfUrl?: string;
  version?: string;
  chapterContent?: string;
  entityId?: string;
  validFrom?: string;
  validTo?: string;
  changeSummary?: string;
  changedBy?: string;
}): SheetRow {
  const a = { ...emptyAnswers(), ...input.answers };
  const join = (values: string[]) => values.join(", ");
  return {
    timestamp: new Date().toISOString(),
    stripeSessionId: input.identity.stripeSessionId,
    stripeCustomerId: input.identity.stripeCustomerId,
    email: input.identity.email,
    company: input.identity.company,
    branchen: join(a.branchen),
    rechtsform: a.rechtsform,
    mitarbeitende: a.mitarbeitende,
    fibu: join(a.fibu),
    weitereSysteme: a.weitereSysteme,
    eingangsbelege: join(a.eingangsbelege),
    ausgangsrechnungen: join(a.ausgangsrechnungen),
    archiv: a.archiv,
    hosting: a.hosting,
    backup: join(a.backup),
    zugriff: a.zugriff,
    gf: a.gf,
    buchhaltung: a.buchhaltung,
    it: a.it,
    steuerberater: a.steuerberater,
    status: input.status,
    deliveryStatus: input.deliveryStatus,
    documentId: input.documentId ?? "",
    parentDocumentId: input.parentDocumentId ?? "",
    pdfUrl: input.pdfUrl ?? "",
    version: input.version ?? "",
    chapterContent: input.chapterContent ?? "",
    entityId: input.entityId ?? "",
    validFrom: input.validFrom ?? "",
    validTo: input.validTo ?? "",
    changeSummary: input.changeSummary ?? "",
    changedBy: input.changedBy ?? "",
    fragen: JSON.stringify(a.fragen ?? {}),
  };
}

function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const SHEET_HEADER_FIELDS: Record<string, keyof SheetRow> = (() => {
  const map: Record<string, keyof SheetRow> = {};
  for (const [column, field] of Object.entries(SHEET_COLUMN_FIELDS) as Array<
    [SheetColumn, keyof SheetRow]
  >) {
    map[column] = field;
    map[normalizeHeaderKey(column)] = field;
    map[field] = field;
    map[field.toLowerCase()] = field;
  }
  return map;
})();

/** Maps a Sheets header cell (`stripe_session_id`, camelCase, spaced) to a row field. */
export function sheetFieldForHeader(header: string): keyof SheetRow | undefined {
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  return (
    SHEET_HEADER_FIELDS[trimmed] ??
    SHEET_HEADER_FIELDS[normalizeHeaderKey(trimmed)]
  );
}

export function sheetRowValues(
  row: SheetRow,
  header: readonly string[] = SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field = sheetFieldForHeader(col) ?? SHEET_COLUMN_FIELDS[col as SheetColumn];
    return field ? row[field] : "";
  });
}

export function parseSheetRow(header: string[], values: string[]): SheetRow {
  const row = emptySheetRow();
  header.forEach((col, index) => {
    const field = sheetFieldForHeader(col);
    if (field) {
      row[field] = String(values[index] ?? "").trim();
    }
  });
  return row;
}

/** Alias used by Sheets reads — same mapping as `parseSheetRow`. */
export function sheetRowFromValues(
  header: string[],
  values: string[],
): SheetRow {
  return parseSheetRow(header, values);
}

export function coerceSheetRow(value: unknown): SheetRow | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const row = { ...emptySheetRow(), ...(value as Partial<SheetRow>) };
  const aliases: Array<[keyof SheetRow, string]> = [
    ["entityId", "entity_id"],
    ["validFrom", "valid_from"],
    ["validTo", "valid_to"],
    ["changeSummary", "change_summary"],
    ["changedBy", "changed_by"],
    ["fragen", "fragen"],
  ];
  for (const [field, column] of aliases) {
    if (!row[field] && typeof raw[column] === "string") {
      row[field] = raw[column];
    }
  }
  return row;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseFragen(raw: string): IntakeAnswers["fragen"] {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as IntakeAnswers["fragen"];
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function answersFromSheetRow(row: SheetRow): IntakeAnswers {
  return {
    ...emptyAnswers(),
    branchen: splitList(row.branchen),
    rechtsform: row.rechtsform,
    mitarbeitende: row.mitarbeitende,
    fibu: splitList(row.fibu),
    weitereSysteme: row.weitereSysteme,
    eingangsbelege: splitList(row.eingangsbelege),
    ausgangsrechnungen: splitList(row.ausgangsrechnungen),
    archiv: row.archiv,
    hosting: row.hosting,
    backup: splitList(row.backup),
    zugriff: row.zugriff,
    gf: row.gf,
    buchhaltung: row.buchhaltung,
    it: row.it,
    steuerberater: row.steuerberater,
    fragen: parseFragen(row.fragen),
  };
}

export function identityFromSheetRow(row: SheetRow): CheckoutIdentity {
  return {
    email: row.email,
    company: row.company,
    stripeSessionId: row.stripeSessionId,
    stripeCustomerId: row.stripeCustomerId,
    stub: row.status.includes("stub"),
    entityId: row.entityId || undefined,
  };
}

export function emailsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
