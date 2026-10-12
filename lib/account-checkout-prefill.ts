/**
 * Account hub prefill from a Checkout Session the customer already completed.
 * Reads `customer_details` that `resolveCheckoutSession` already returns.
 * Filled profile and company fields stay as the user left them.
 */
import { CHECKOUT_PREFILL_NOTE, FIRMA_ADD_LABEL, FIRMA_EDIT_LABEL } from "@/lib/account-labels";
import { isStubCheckoutSessionId } from "@/lib/checkout-stub";
import {
  DEFAULT_ENTITY_NAME,
  type CheckoutPrefillState,
  type Entity,
  type EntityInput,
} from "@/lib/entities";
import { PROFILE_NAME_MAX, type AccountProfile } from "@/lib/profile";
import {
  findLatestPaidCheckoutByEmail,
  getAccountProfile,
  ensureAccountEntities,
  updateEntity,
  upsertAccountProfile,
  type AccountEntitiesLoad,
} from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import type { CheckoutIdentity } from "@/lib/types";

export { CHECKOUT_PREFILL_NOTE, FIRMA_ADD_LABEL, FIRMA_EDIT_LABEL };

export type CheckoutAccountFacts = {
  profileName: string;
  companyName: string;
  street: string;
  zip: string;
  city: string;
  ustId: string;
};

export function emptyCheckoutAccountFacts(): CheckoutAccountFacts {
  return {
    profileName: "",
    companyName: "",
    street: "",
    zip: "",
    city: "",
    ustId: "",
  };
}

/** Same cleaning as the profile save, capped so a long checkout name does not throw. */
export function profileNameFromCheckout(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= PROFILE_NAME_MAX) return cleaned;
  return cleaned.slice(0, PROFILE_NAME_MAX).trim();
}

export function checkoutAccountFactsFromIdentity(
  identity: Pick<
    CheckoutIdentity,
    "company" | "customerName" | "businessName" | "billingAddress" | "ustId"
  >,
): CheckoutAccountFacts {
  const company = identity.company?.trim() ?? "";
  const business = identity.businessName?.trim() ?? "";
  return {
    profileName: profileNameFromCheckout(identity.customerName ?? ""),
    companyName: company || business,
    street: identity.billingAddress?.line1?.trim() ?? "",
    zip: identity.billingAddress?.postalCode?.trim() ?? "",
    city: identity.billingAddress?.city?.trim() ?? "",
    ustId: identity.ustId?.trim() ?? "",
  };
}

/**
 * Name to store when the account has no profile row yet.
 * A saved row — including a name the user cleared — is left untouched.
 */
export function profilePrefillName(
  profile: Pick<AccountProfile, "name"> | null,
  facts: CheckoutAccountFacts,
): string | null {
  if (profile) return null;
  const name = profileNameFromCheckout(facts.profileName);
  return name || null;
}

type CompanySnapshot = Pick<
  Entity,
  | "name"
  | "street"
  | "zip"
  | "city"
  | "stnr"
  | "ustId"
  | "createdAt"
  | "updatedAt"
  | "checkoutPrefill"
>;

export type CompanyPrefillMerge = {
  input: EntityInput;
  /** At least one empty field (or the untouched placeholder name) took a checkout value. */
  review: boolean;
};

function checkoutAlreadyApplied(state: CheckoutPrefillState | undefined): boolean {
  return state === "review" || state === "done";
}

/**
 * Fill empty fields on the first company. A non-empty field is a user value.
 * „Meine Firma“ is replaced only when the row was never saved again.
 * `review` / `done` means this already ran, so a later clear stays empty.
 */
export function mergeCheckoutIntoFirstCompany(
  entity: CompanySnapshot,
  facts: CheckoutAccountFacts,
): CompanyPrefillMerge | null {
  if (checkoutAlreadyApplied(entity.checkoutPrefill)) return null;

  const untouched =
    Boolean(entity.createdAt) && entity.createdAt === entity.updatedAt;
  let name = typeof entity.name === "string" ? entity.name : "";
  let review = false;
  if (!name.trim() && facts.companyName) {
    name = facts.companyName;
    review = true;
  } else if (
    untouched &&
    name.trim() === DEFAULT_ENTITY_NAME &&
    facts.companyName &&
    facts.companyName !== name.trim()
  ) {
    name = facts.companyName;
    review = true;
  }

  const fill = (current: unknown, incoming: string) => {
    const text = typeof current === "string" ? current : "";
    if (text.trim() || !incoming.trim()) return text;
    review = true;
    return incoming.trim();
  };

  const input: EntityInput = {
    name,
    street: fill(entity.street, facts.street),
    zip: fill(entity.zip, facts.zip),
    city: fill(entity.city, facts.city),
    stnr: typeof entity.stnr === "string" ? entity.stnr : "",
    ustId: fill(entity.ustId, facts.ustId),
  };
  return { review, input };
}

/** Checkout defaults for „Firma anlegen“ only while the account has no company yet. */
export function firstCompanyFormDefaults(
  entityCount: number,
  facts: CheckoutAccountFacts | null,
): { initial?: EntityInput; showNote: boolean } {
  if (entityCount !== 0 || !facts) return { showNote: false };
  const initial: EntityInput = {
    name: facts.companyName,
    street: facts.street,
    zip: facts.zip,
    city: facts.city,
    ustId: facts.ustId,
  };
  const showNote = Boolean(
    initial.name || initial.street || initial.zip || initial.city || initial.ustId,
  );
  return showNote ? { initial, showNote } : { showNote: false };
}

export async function readCheckoutAccountFacts(
  email: string,
): Promise<CheckoutAccountFacts | null> {
  const paid = await findLatestPaidCheckoutByEmail(email);
  const sessionId = paid?.stripeSessionId.trim() ?? "";
  if (!sessionId || isStubCheckoutSessionId(sessionId)) return null;
  const resolved = await resolveCheckoutSession(sessionId);
  if ("error" in resolved || resolved.stub) return null;
  return checkoutAccountFactsFromIdentity(resolved);
}

export type PreparedAccount = AccountEntitiesLoad & {
  profile: AccountProfile | null;
};

/**
 * One pass on account load. Stripe is consulted only while the profile row
 * is missing or the first company has not been prefilled yet.
 */
export async function prepareAccountCheckout(email: string): Promise<PreparedAccount> {
  const loaded = await ensureAccountEntities(email);
  let profile = await getAccountProfile(email);
  let entities = loaded.entities;
  const first = entities[0];
  const profileOpen = !profile;
  const entityOpen = Boolean(first) && !checkoutAlreadyApplied(first?.checkoutPrefill);
  if (!profileOpen && !entityOpen) {
    return { ...loaded, entities, profile };
  }

  let facts: CheckoutAccountFacts | null = null;
  try {
    facts = await readCheckoutAccountFacts(email);
  } catch (error) {
    console.error("[account] Checkout-Vorausfüllung fehlgeschlagen", error);
    return { ...loaded, entities, profile };
  }
  if (!facts) return { ...loaded, entities, profile };

  if (profileOpen) {
    const name = profilePrefillName(null, facts);
    if (name) {
      try {
        profile = (await upsertAccountProfile(email, name)).profile;
      } catch (error) {
        console.error("[account] Profilname aus Checkout nicht gespeichert", error);
      }
    }
  }

  if (entityOpen && first) {
    const merged = mergeCheckoutIntoFirstCompany(first, facts);
    if (merged) {
      try {
        const updated = await updateEntity(first.entityId, merged.input, email, {
          checkoutPrefill: merged.review ? "review" : "done",
        });
        if (updated) {
          entities = entities.map((row) =>
            row.entityId === updated.entityId ? updated : row,
          );
        }
      } catch (error) {
        console.error("[account] Firma aus Checkout nicht vorausgefüllt", error);
      }
    }
  }

  return { ...loaded, entities, profile };
}
