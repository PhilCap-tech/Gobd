/**
 * A purchase belongs to the checkout email. A firm id from another
 * mailbox is ignored. The buyer gets their own firm, with the billing
 * address marked for review when Stripe sent one.
 */
import { mergeCheckoutIntoFirstCompany } from "@/lib/account-checkout-prefill";
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

  const created = await store.createEntity(
    email,
    {
      name: input.company?.trim() || DEFAULT_ENTITY_NAME,
      street: input.street,
      zip: input.zip,
      city: input.city,
      ustId: input.ustId,
    },
    { checkoutPrefill: hasBillingFacts(input) ? "review" : "" },
  );
  return created.entity.entityId;
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
