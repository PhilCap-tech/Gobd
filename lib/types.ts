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
};

export type CheckoutIdentity = {
  email: string;
  company: string;
  stripeSessionId: string;
  stripeCustomerId: string;
  stub: boolean;
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
  };
}

export function sheetRowValues(
  row: SheetRow,
  header: readonly string[] = SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field = SHEET_COLUMN_FIELDS[col as SheetColumn];
    return field ? row[field] : "";
  });
}

export function parseSheetRow(header: string[], values: string[]): SheetRow {
  const row = emptySheetRow();
  header.forEach((col, index) => {
    const field = SHEET_COLUMN_FIELDS[col as SheetColumn];
    if (field) {
      row[field] = values[index] ?? "";
    }
  });
  return row;
}

export function coerceSheetRow(value: unknown): SheetRow | null {
  if (!value || typeof value !== "object") return null;
  return { ...emptySheetRow(), ...(value as Partial<SheetRow>) };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function answersFromSheetRow(row: SheetRow): IntakeAnswers {
  return {
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
  };
}

export function identityFromSheetRow(row: SheetRow): CheckoutIdentity {
  return {
    email: row.email,
    company: row.company,
    stripeSessionId: row.stripeSessionId,
    stripeCustomerId: row.stripeCustomerId,
    stub: row.status.includes("stub"),
  };
}

export function emailsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
