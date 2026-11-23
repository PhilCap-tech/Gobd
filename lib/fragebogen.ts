import { DRAFT_DEFAULT_ENTITY } from "@/lib/intake-draft-shared";

/** Neues Preismodell, Login zuerst: Pfade des Fragebogens vor der Zahlung. */
export const FRAGEBOGEN_PATH = "/fragebogen";
export const FRAGEBOGEN_PAKET_PATH = "/fragebogen/paket";
export const FRAGEBOGEN_BEZAHLT_PATH = "/fragebogen/bezahlt";

/**
 * `?entity_id=default` wählt den ungebundenen Login-Entwurf
 * (`email:…:default:…`). Das ist kein Firmen-Schlüssel.
 */
export const FRAGEBOGEN_DEFAULT_ENTITY = DRAFT_DEFAULT_ENTITY;

/** Fragebogen-URL. Leer bleibt /fragebogen; eine Id (auch `default`) wird als entity_id gesetzt. */
export function fragebogenHref(
  entityId?: string,
  extra?: { schritt?: string; modul?: string },
): string {
  const params = new URLSearchParams();
  const id = entityId?.trim() ?? "";
  if (id) params.set("entity_id", id);
  const schritt = extra?.schritt?.trim() ?? "";
  const modul = extra?.modul?.trim() ?? "";
  if (schritt) params.set("schritt", schritt);
  if (modul) params.set("modul", modul);
  const query = params.toString();
  return query ? `${FRAGEBOGEN_PATH}?${query}` : FRAGEBOGEN_PATH;
}

export type FragebogenEntitySelection<T extends { entityId: string }> = {
  entities: T[];
  initialEntityId: string;
};

/**
 * Welche Firma /fragebogen öffnet.
 *
 * - `?entity_id=<id>` nur, wenn die Id zu diesem Konto gehört.
 * - `?entity_id=default` hält den ungebundenen Entwurf. Die erste Firma
 *   wird dann nicht eingesetzt, auch wenn das Konto inzwischen eine hat.
 * - Fehlende oder fremde Id: bisheriges Verhalten (erste Firma, sonst keine).
 *   Eine fremde Id wird nicht an das Formular gegeben.
 *
 * Ohne `entity_id` wird nicht nach einem vorhandenen default-Entwurf gesucht.
 * Den Marker setzt nur der Link aus dem Konto.
 */
export function fragebogenEntitiesForQuery<T extends { entityId: string }>(
  entities: readonly T[],
  entityIdParam: string | null | undefined,
): FragebogenEntitySelection<T> {
  const requested = entityIdParam?.trim() ?? "";
  if (requested === FRAGEBOGEN_DEFAULT_ENTITY) {
    return { entities: [], initialEntityId: "" };
  }
  if (requested) {
    const match = entities.find((entity) => entity.entityId === requested);
    if (match) return { entities: [match], initialEntityId: match.entityId };
  }
  const first = entities[0];
  return {
    entities: first ? [first] : [],
    initialEntityId: first?.entityId ?? "",
  };
}

/** Growth landing-v3 Abschnitt 3 (1:1). */
export const PAKET_H1 = "Ihre Angaben sind gespeichert. Wählen Sie Ihr Paket.";
export const PAKET_INTRO =
  "Mit der Zahlung wird Ihre Verfahrensdokumentation als PDF erstellt. Bis dahin haben Sie nichts bezahlt.";
