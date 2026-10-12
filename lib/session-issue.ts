/**
 * Welche Firma an eine neue oder überarbeitete Doku gebunden wird.
 * Ohne Login für genau diese Adresse keine bestehende Firma: der
 * Checkout-Nachweis gilt nur für die gerade gekaufte Doku.
 */
export function intakeEntityBinding(input: {
  loggedInAsBuyer: boolean;
  requestedEntityId: string;
  resolvedEntityId: string;
  revising: boolean;
  ownedEntityIds: string[];
}): { entityId: string; needsFirmChoice: boolean } {
  if (!input.loggedInAsBuyer) {
    const onThisDocument = input.resolvedEntityId.trim();
    if (input.revising && onThisDocument) {
      return { entityId: onThisDocument, needsFirmChoice: false };
    }
    return { entityId: "", needsFirmChoice: false };
  }

  const requested = input.requestedEntityId.trim();
  if (requested && input.ownedEntityIds.includes(requested)) {
    return { entityId: requested, needsFirmChoice: false };
  }
  if (!input.revising && input.ownedEntityIds.length === 1) {
    return { entityId: input.ownedEntityIds[0] ?? "", needsFirmChoice: false };
  }
  if (!input.revising && input.ownedEntityIds.length > 1) {
    return { entityId: "", needsFirmChoice: true };
  }
  return {
    entityId: input.revising ? input.resolvedEntityId.trim() : "",
    needsFirmChoice: false,
  };
}
