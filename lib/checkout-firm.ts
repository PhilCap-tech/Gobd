/**
 * A purchase belongs to the checkout email. A firm id from another
 * mailbox is ignored. The buyer gets their own firm, with the billing
 * address marked for review when Stripe sent one.
 *
 * The webhook and the checkout return both call this. A durable claim
 * keeps the two from creating two firms when they overlap.
 */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { mergeCheckoutIntoFirstCompany } from "@/lib/account-checkout-prefill";
import { isBlobConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { emailsEqual } from "@/lib/types";
import {
  DEFAULT_ENTITY_NAME,
  entityOwnedByEmail,
  type CheckoutPrefillState,
  type Entity,
  type EntityInput,
} from "@/lib/entities";
import {
  createEntity,
  getEntity,
  getFileFallbackDir,
  listEntitiesByEmail,
  updateEntity,
} from "@/lib/store";

export type BuyerFirmRequest = {
  email: string;
  company?: string;
  entityId?: string;
  sessionId?: string;
  street?: string;
  zip?: string;
  city?: string;
  ustId?: string;
};

export type BuyerFirmStore = {
  getEntity: (entityId: string) => Promise<Entity | null>;
  listEntitiesByEmail: (email: string) => Promise<Entity[]>;
  createEntity: (
    email: string,
    input: EntityInput,
    options?: { checkoutPrefill?: CheckoutPrefillState },
  ) => Promise<{ entity: Entity }>;
  updateEntity: (
    entityId: string,
    input: Partial<EntityInput>,
    email?: string,
    options?: { checkoutPrefill?: CheckoutPrefillState },
  ) => Promise<Entity | null>;
};

const defaultStore: BuyerFirmStore = {
  getEntity,
  listEntitiesByEmail,
  createEntity,
  updateEntity,
};

const inflight = new Map<string, Promise<string>>();

function hasBillingFacts(input: BuyerFirmRequest): boolean {
  return Boolean(
    input.street?.trim() || input.zip?.trim() || input.city?.trim() || input.ustId?.trim(),
  );
}

async function fillEmptyAddress(
  entity: Entity,
  email: string,
  input: BuyerFirmRequest,
  store: BuyerFirmStore,
): Promise<void> {
  if (!hasBillingFacts(input) && !input.company?.trim()) return;
  const merged = mergeCheckoutIntoFirstCompany(entity, {
    profileName: "",
    companyName: input.company?.trim() ?? "",
    street: input.street?.trim() ?? "",
    zip: input.zip?.trim() ?? "",
    city: input.city?.trim() ?? "",
    ustId: input.ustId?.trim() ?? "",
  });
  if (!merged?.review) return;
  await store.updateEntity(entity.entityId, merged.input, email, { checkoutPrefill: "review" });
}

async function ensureUnlocked(
  input: BuyerFirmRequest,
  store: BuyerFirmStore,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return "";
  const requested = input.entityId?.trim() ?? "";
  if (requested) {
    const entity = await store.getEntity(requested);
    if (entity && entityOwnedByEmail(entity, email) && emailsEqual(entity.userEmail, email)) {
      await fillEmptyAddress(entity, email, input, store);
      return entity.entityId;
    }
  }

  const existing = await store.listEntitiesByEmail(email);
  if (existing.length === 1 && existing[0]) {
    await fillEmptyAddress(existing[0], email, input, store);
    return existing[0].entityId;
  }
  if (existing.length > 1) return "";

  return createBuyerFirmOnce(input, store);
}

async function createBuyerFirmOnce(
  input: BuyerFirmRequest,
  store: BuyerFirmStore,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let slot: "claimed" | "held";
    try {
      slot = await tryCreateFirmClaim(email);
    } catch (error) {
      console.error(
        "[checkout] Firmen-Anspruch nicht gespeichert",
        error instanceof Error ? error.name : "error",
      );
      const created = await store.createEntity(email, firmInput(input), {
        checkoutPrefill: hasBillingFacts(input) ? "review" : "",
      });
      return created.entity.entityId;
    }
    if (slot === "claimed") {
      try {
        const created = await store.createEntity(email, firmInput(input), {
          checkoutPrefill: hasBillingFacts(input) ? "review" : "",
        });
        await saveFirmClaim(email, created.entity.entityId);
        return created.entity.entityId;
      } catch (error) {
        await deleteFirmClaim(email).catch(() => undefined);
        throw error;
      }
    }
    const waited = await waitForClaimedFirm(email, store);
    if (waited) return waited;
    const still = await readFirmClaim(email);
    if (still?.entityId) return still.entityId;
    if (still) return "";
  }
  return "";
}

function firmInput(input: BuyerFirmRequest): EntityInput {
  return {
    name: input.company?.trim() || DEFAULT_ENTITY_NAME,
    street: input.street,
    zip: input.zip,
    city: input.city,
    ustId: input.ustId,
  };
}

/** Firm id owned by the checkout email, or "" when several firms already exist. */
export async function ensureBuyerFirmForCheckout(
  input: BuyerFirmRequest,
  store: BuyerFirmStore = defaultStore,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return "";
  if (store !== defaultStore) return ensureUnlocked(input, store);
  const pending = inflight.get(email);
  if (pending) return pending;
  const run = ensureUnlocked({ ...input, email }, store).finally(() => {
    inflight.delete(email);
  });
  inflight.set(email, run);
  return run;
}

const CLAIM_FRESH_MS = 30_000;
const CLAIM_WAIT_MS = 50;
const CLAIM_POLLS = 40;

type FirmClaimRecord = { email: string; entityId: string; at: string };

function claimHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
}

function claimUsesBlob(): boolean {
  if (automatedRunForbidsLiveWrites()) return false;
  return isBlobConfigured() && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function claimToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function claimFile(email: string): string {
  return path.join(getFileFallbackDir(), "checkout-firms", `${claimHash(email)}.json`);
}

function claimBlobPath(email: string): string {
  return `gobd/checkout-firms/${claimHash(email)}.json`;
}

function parseClaim(raw: string): FirmClaimRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FirmClaimRecord>;
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.at !== "string") return null;
    return {
      email: parsed.email,
      entityId: typeof parsed.entityId === "string" ? parsed.entityId : "",
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

function claimAge(record: FirmClaimRecord): number {
  const at = Date.parse(record.at);
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return Date.now() - at;
}

function blobMissing(error: unknown): boolean {
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobNotFoundError";
}

function blobConflict(error: unknown): boolean {
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

async function readFirmClaim(email: string): Promise<FirmClaimRecord | null> {
  if (claimUsesBlob()) {
    try {
      const result = await get(claimBlobPath(email), {
        access: "private",
        useCache: false,
        token: claimToken(),
      });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return parseClaim(await new Response(result.stream).text());
    } catch (error) {
      if (blobMissing(error)) return null;
      throw error;
    }
  }
  try {
    return parseClaim(await readFile(claimFile(email), "utf8"));
  } catch (error) {
    if ((error as { code?: unknown }).code === "ENOENT") return null;
    throw error;
  }
}

async function exclusiveClaim(email: string, record: FirmClaimRecord): Promise<"created" | "exists"> {
  const body = JSON.stringify(record);
  if (claimUsesBlob()) {
    try {
      await put(claimBlobPath(email), body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json; charset=utf-8",
        token: claimToken(),
      });
      return "created";
    } catch (error) {
      if (blobConflict(error)) return "exists";
      throw error;
    }
  }
  const file = claimFile(email);
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx");
  } catch (error) {
    if ((error as { code?: unknown }).code === "EEXIST") return "exists";
    throw error;
  }
  try {
    await handle.writeFile(body, "utf8");
  } finally {
    await handle.close();
  }
  return "created";
}

async function saveFirmClaim(email: string, entityId: string): Promise<void> {
  const body = JSON.stringify({
    email,
    entityId,
    at: new Date().toISOString(),
  } satisfies FirmClaimRecord);
  if (claimUsesBlob()) {
    await put(claimBlobPath(email), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      token: claimToken(),
    });
    return;
  }
  const file = claimFile(email);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

async function deleteFirmClaim(email: string): Promise<void> {
  if (claimUsesBlob()) {
    try {
      await del(claimBlobPath(email), { token: claimToken() });
    } catch (error) {
      if (!blobMissing(error)) throw error;
    }
    return;
  }
  try {
    await unlink(claimFile(email));
  } catch (error) {
    if ((error as { code?: unknown }).code !== "ENOENT") throw error;
  }
}

/** Test helper. Removes the cross-request firm claim. */
export async function forgetCheckoutFirmClaim(email: string): Promise<void> {
  const id = email.trim().toLowerCase();
  if (!id) return;
  await deleteFirmClaim(id);
}

async function tryCreateFirmClaim(email: string): Promise<"claimed" | "held"> {
  const existing = await readFirmClaim(email);
  if (existing) {
    const abandoned = !existing.entityId && claimAge(existing) > CLAIM_FRESH_MS;
    if (!abandoned) return "held";
    await deleteFirmClaim(email);
  }
  const created = await exclusiveClaim(email, {
    email,
    entityId: "",
    at: new Date().toISOString(),
  });
  return created === "created" ? "claimed" : "held";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForClaimedFirm(email: string, store: BuyerFirmStore): Promise<string> {
  for (let i = 0; i < CLAIM_POLLS; i += 1) {
    const claim = await readFirmClaim(email);
    if (claim?.entityId) {
      const entity = await store.getEntity(claim.entityId);
      if (entity && entityOwnedByEmail(entity, email)) return entity.entityId;
      if (!entity && claimAge(claim) < CLAIM_FRESH_MS) return claim.entityId;
      if (entity && !entityOwnedByEmail(entity, email)) return "";
    }
    const existing = await store.listEntitiesByEmail(email);
    if (existing.length === 1 && existing[0]) return existing[0].entityId;
    if (existing.length > 1) return "";
    if (!claim) return "";
    await sleep(CLAIM_WAIT_MS);
  }
  return "";
}
