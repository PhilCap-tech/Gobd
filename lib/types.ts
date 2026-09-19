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
] as const;

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

export function toSheetRow(input: {
  identity: CheckoutIdentity;
  answers?: Partial<IntakeAnswers>;
  status: string;
  deliveryStatus: string;
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
  };
}

export function sheetRowValues(row: SheetRow): string[] {
  return [
    row.timestamp,
    row.stripeSessionId,
    row.stripeCustomerId,
    row.email,
    row.company,
    row.branchen,
    row.rechtsform,
    row.mitarbeitende,
    row.fibu,
    row.weitereSysteme,
    row.eingangsbelege,
    row.ausgangsrechnungen,
    row.archiv,
    row.hosting,
    row.backup,
    row.zugriff,
    row.gf,
    row.buchhaltung,
    row.it,
    row.steuerberater,
    row.status,
    row.deliveryStatus,
  ];
}
