import { latestOwnedInFamily } from "@/lib/documents";
import type { SheetRow } from "@/lib/types";

/** Sichtbar in API und Intake, wenn eine gelieferte Fassung ohne Login geändert werden soll. */
export const LOGIN_TO_CHANGE_COPY =
  "Bitte melden Sie sich an, um Ihre Angaben zu ändern.";

export type DeliveredWrite =
  | { ok: true; kind: "first" }
  | { ok: true; kind: "owner"; ownerEmail: string; row: SheetRow }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Schreiben nach der ersten Lieferung nur mit Login der Dokument-Mail.
 * Keine Zeile heißt: die erste Fassung ist noch erlaubt (Checkout prüft der Aufrufer).
 * `body.email` ist hier kein Argument und bestimmt die Inhaberschaft nicht.
 */
export function authorizeDeliveredWrite(input: {
  sessionEmail?: string | null;
  rows: readonly SheetRow[];
}): DeliveredWrite {
  // `fragen` darf ein Blob-Zeiger sein. Die Zeile bleibt eine gelieferte Fassung,
  // sobald sie eine documentId trägt — der Antwort-JSON muss nicht inline liegen.
  const delivered = input.rows.filter((row) => row.documentId.trim());
  if (delivered.length === 0) return { ok: true, kind: "first" };

  const email = input.sessionEmail?.trim() ?? "";
  if (!email) {
    return { ok: false, status: 401, error: LOGIN_TO_CHANGE_COPY };
  }
  const owned = latestOwnedInFamily([...delivered], email);
  if (!owned) {
    return { ok: false, status: 403, error: "Kein Zugriff." };
  }
  return { ok: true, kind: "owner", ownerEmail: owned.email, row: owned };
}

export type DeliveryLookup = {
  findDocumentById: (documentId: string) => Promise<SheetRow | null>;
  listDocumentFamily: (documentId: string) => Promise<SheetRow[]>;
  findLatestDocumentByStripeSessionId: (sessionId: string) => Promise<SheetRow | null>;
};

/** Zeilen einer schon gelieferten Fassung. Leer, solange zu Session oder Dokument nichts liegt. */
export async function lookupDeliveredRows(
  input: { sessionId?: string; documentId?: string; areaFromDocumentId?: string },
  lookup: DeliveryLookup,
): Promise<SheetRow[]> {
  const anchor = input.documentId?.trim() || input.areaFromDocumentId?.trim() || "";
  if (anchor) {
    const family = await lookup.listDocumentFamily(anchor);
    if (family.length > 0) return family;
    const row = await lookup.findDocumentById(anchor);
    return row?.documentId ? [row] : [];
  }
  const sessionId = input.sessionId?.trim() ?? "";
  if (!sessionId) return [];
  const latest = await lookup.findLatestDocumentByStripeSessionId(sessionId);
  if (!latest?.documentId) return [];
  const family = await lookup.listDocumentFamily(latest.documentId);
  return family.length > 0 ? family : [latest];
}

/**
 * Inhaberschaft der Erstfassung: Stripe-Mail, sonst die Mail aus dem
 * signierten Checkout-Nachweis derselben Session. Nie `body.email`.
 */
export function checkoutOwnerEmail(input: {
  stripeEmail?: string | null;
  stripeSessionId?: string | null;
  grantSessionId?: string | null;
  grantEmail?: string | null;
}): string {
  const stripe = input.stripeEmail?.trim() ?? "";
  if (stripe) return stripe;
  const grantSession = input.grantSessionId?.trim() ?? "";
  const sessionId = input.stripeSessionId?.trim() ?? "";
  if (!grantSession || !sessionId || grantSession !== sessionId) return "";
  return input.grantEmail?.trim() ?? "";
}

const writeTails = new Map<string, Promise<void>>();

/**
 * Eine Checkout-Session schreibt die erste Fassung nur einmal.
 * Parallele Submits warten, sehen danach die Zeile und legen keine zweite an.
 */
export function withSessionWriteLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const name = key.trim() || "anon";
  const previous = writeTails.get(name) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  writeTails.set(name, gate);
  const run = previous.then(
    () => task(),
    () => task(),
  );
  return run.finally(() => {
    release();
    if (writeTails.get(name) === gate) writeTails.delete(name);
  });
}
