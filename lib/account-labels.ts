import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";

export const FIRMA_EDIT_LABEL = "Firmendaten bearbeiten";
export const FIRMA_ADD_LABEL = `Weitere Firma hinzufügen (bis zu ${MAX_ENTITIES_PER_ACCOUNT} im Abo)`;
export const CHECKOUT_PREFILL_NOTE = "Vorausgefüllt aus dem Checkout. Bitte prüfen.";

/** Firms 1–5 share one subscription. Each firm after that needs its own. */
export const EXTRA_FIRM_NOTE =
  `Ihr Abo umfasst bis zu ${MAX_ENTITIES_PER_ACCOUNT} Firmen. Für jede weitere Firma ist ein eigenes Abo erforderlich.`;
