import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { blobMissing } from "@/lib/ampel-blob-slot";
import { compIntakePath } from "@/lib/comp-access";
import { assertLiveWriteAllowed, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getFileFallbackDir } from "@/lib/store";

/**
 * Zugang aus Digistore24-Käufen (Produkte 751404 und 751419).
 * Freigegeben von Philip, 2026-10-26 08:48.
 *
 * Ein JSON-Objekt pro Käufer-Mail im privaten Vercel Blob
 * (`gobd/ds24-access/<sha256(mail)>.json`), sonst im Datei-Fallback.
 * Gespeichert wird nur: Mail, Bestell-ID, Produkt-ID, Status, letzte
 * Zahlungs-ID und Zeitstempel. Keine IP, kein User-Agent, kein IPN-Dump.
 */

export type Ds24OrderStatus = "active" | "blocked";

export type Ds24Order = {
  productId: string;
  status: Ds24OrderStatus;
  /** Letztes verarbeitetes Ereignis, z. B. `on_payment` oder `on_refund`. */
  event: string;
  /** payment_id bzw. transaction_id der letzten Zahlung. */
  paymentId: string;
  /**
   * Nach on_refund oder on_chargeback dauerhaft gesperrt. Eine spätere
   * on_payment-IPN derselben Bestellung hebt die Sperre nie auf.
   */
  permanentBlock?: "on_refund" | "on_chargeback";
  createdAt: string;
  updatedAt: string;
};

export type Ds24AccessRecord = {
  email: string;
  orders: Record<string, Ds24Order>;
};

export type Ds24AccessStore = {
  read(email: string): Promise<Ds24AccessRecord | null>;
  write(record: Ds24AccessRecord): Promise<void>;
};

const DIR_NAME = "ds24-access";
const BLOB_PREFIX = "gobd/ds24-access";

let dirOverride: string | null = null;
let shared: Ds24AccessStore | null = null;

/** Isolierter Datei-Store für den Check. `null` setzt zurück. */
export function setDs24AccessTestHooks(hooks: { dir?: string } | null): void {
  dirOverride = hooks?.dir ?? null;
  shared = null;
}

export function normalizeDs24Email(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || /\s/.test(email)) return "";
  return email;
}

function emailKey(email: string): string {
  return createHash("sha256").update(email, "utf8").digest("hex");
}

function invokedAsRepoScript(): boolean {
  return process.argv.some((arg) => /(?:^|[/\\])scripts[/\\]/.test(arg));
}

/** Checks, Prebuild und Skripte aus `scripts/` schreiben nie in den Produktions-Blob. */
export function ds24AccessStoreKind(): "file" | "blob" {
  if (dirOverride) return "file";
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "file";
  if (automatedRunForbidsLiveWrites()) return "file";
  if (invokedAsRepoScript()) return "file";
  const event = process.env.npm_lifecycle_event ?? "";
  if (event === "postbuild" || event.startsWith("preview")) return "file";
  return "blob";
}

function parseRecord(raw: string, email: string): Ds24AccessRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<Ds24AccessRecord>;
    if (!parsed || normalizeDs24Email(parsed.email) !== email) return null;
    const orders: Record<string, Ds24Order> = {};
    for (const [id, order] of Object.entries(parsed.orders ?? {})) {
      if (!order || typeof order !== "object") continue;
      const permanentBlock =
        order.permanentBlock === "on_refund" || order.permanentBlock === "on_chargeback"
          ? order.permanentBlock
          : undefined;
      // Eine dauerhafte Sperre gilt auch dann, wenn der Status anders gespeichert wäre.
      const status = order.status === "active" && !permanentBlock ? "active" : "blocked";
      orders[id] = {
        productId: String(order.productId ?? ""),
        status,
        event: String(order.event ?? ""),
        paymentId: String(order.paymentId ?? ""),
        ...(permanentBlock ? { permanentBlock } : {}),
        createdAt: String(order.createdAt ?? ""),
        updatedAt: String(order.updatedAt ?? ""),
      };
    }
    return { email, orders };
  } catch {
    return null;
  }
}

function fileStore(): Ds24AccessStore {
  const dir = dirOverride ?? path.join(getFileFallbackDir(), DIR_NAME);
  const file = (email: string) => path.join(dir, `${emailKey(email)}.json`);
  return {
    async read(email) {
      try {
        return parseRecord(await readFile(file(email), "utf8"), email);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async write(record) {
      await mkdir(dir, { recursive: true });
      const target = file(record.email);
      const tmp = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
      await writeFile(tmp, JSON.stringify(record), "utf8");
      await rename(tmp, target);
    },
  };
}

function blobStore(): Ds24AccessStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const pathname = (email: string) => `${BLOB_PREFIX}/${emailKey(email)}.json`;
  return {
    async read(email) {
      try {
        const result = await get(pathname(email), { access: "private", useCache: false, token });
        if (result == null || result.statusCode !== 200 || !result.stream) return null;
        return parseRecord(await new Response(result.stream).text(), email);
      } catch (error) {
        if (blobMissing(error)) return null;
        throw error;
      }
    },
    async write(record) {
      assertLiveWriteAllowed("blob");
      await put(pathname(record.email), JSON.stringify(record), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json; charset=utf-8",
        token,
      });
    },
  };
}

export function ds24AccessStore(): Ds24AccessStore {
  if (!shared) shared = ds24AccessStoreKind() === "blob" ? blobStore() : fileStore();
  return shared;
}

/** Mindestens eine Bestellung ist aktiv. Gesperrte Bestellungen zählen nicht. */
export function recordHasActiveAccess(record: Ds24AccessRecord | null): boolean {
  if (!record) return false;
  return Object.values(record.orders).some((order) => order.status === "active");
}

/**
 * Aktiver Digistore24-Zugang für diese Mail. Ein Lesefehler gilt nie als
 * Zugang (fail closed).
 */
export async function hasDs24Access(
  email: string | null | undefined,
  store: Ds24AccessStore = ds24AccessStore(),
): Promise<boolean> {
  const normalized = normalizeDs24Email(email);
  if (!normalized) return false;
  try {
    return recordHasActiveAccess(await store.read(normalized));
  } catch (error) {
    console.error(
      "[ds24] Zugang nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
    return false;
  }
}

/**
 * Wie compCheckoutRedirect: DS24-Käufer sehen den Stripe-Checkout nicht.
 * Mit Firma direkt zum Fragebogen, sonst zum Konto.
 */
export async function ds24CheckoutRedirect(
  email: string | null | undefined,
  entityId?: string | null,
): Promise<string | null> {
  if (!(await hasDs24Access(email))) return null;
  const id = entityId?.trim() ?? "";
  return id ? compIntakePath(id) : "/account";
}
