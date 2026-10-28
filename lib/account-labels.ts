import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { isPricingV2 } from "@/lib/pricing-model";

/** Neues Preismodell (v3): Server liest PRICING_MODEL, Client das eingebettete GOBD_PRICING_NEW_MODEL. */
const NEW_MODEL = isPricingV2() || process.env.GOBD_PRICING_NEW_MODEL === "1";

/** v3: eine Firma je Konto (Wortlaut Philip 28.10.). */
export const V3_ONE_FIRM_MESSAGE =
  "Für jede weitere Firma legen Sie bitte ein eigenes Konto mit einer eigenen E-Mail-Adresse an.";

export const FIRMA_EDIT_LABEL = "Firmendaten bearbeiten";
export const FIRMA_ADD_LABEL = NEW_MODEL
  ? "Weitere Firma hinzufügen"
  : `Weitere Firma hinzufügen (bis zu ${MAX_ENTITIES_PER_ACCOUNT} im Abo)`;
export const CHECKOUT_PREFILL_NOTE = "Vorausgefüllt aus dem Checkout. Bitte prüfen.";

/** Firms 1–5 share one subscription. Each firm after that needs its own. */
export const EXTRA_FIRM_NOTE = NEW_MODEL
  ? V3_ONE_FIRM_MESSAGE
  : `Ihr Abo umfasst bis zu ${MAX_ENTITIES_PER_ACCOUNT} Firmen. Für jede weitere Firma ist ein eigenes Abo erforderlich.`;

/** Shown beside the checkout price unless the extra-firm note already applies. */
export const INCLUDED_FIRM_NOTE = NEW_MODEL
  ? ""
  : `Ein Abo umfasst bis zu ${MAX_ENTITIES_PER_ACCOUNT} Firmen.`;
