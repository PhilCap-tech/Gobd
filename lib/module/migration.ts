/**
 * Überführung bestehender Bereichs-Dokumentationen (12 Bereiche) in ein
 * Gesamtdokument mit 24 Modulen. Antworten werden übernommen, nicht erfunden:
 * Katalogantworten (Allgemeiner Teil A–I und bereichsspezifische Fragen)
 * werden zusammengeführt, der Betriebs-Check wird nur dort auf „ja“ gesetzt,
 * wo ein Bereich bereits dokumentiert war. Alles andere fragt der Check ab.
 */
import { bereichIdOf } from "@/lib/bereiche";
import { catalogState, withCatalogDraft, type CatalogState } from "@/lib/intake-catalog";
import { ensureGesamt, setCheckAntwort } from "@/lib/module/status";
import type { CheckKey } from "@/lib/module/typen";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

/** Bereich → Betriebs-Check-Fragen, die durch eine bestehende Bereichs-VD belegt sind. */
export const BEREICH_ZU_CHECK: Record<string, CheckKey[]> = {
  kasse: ["bargeld"],
  warenwirtschaft: ["lager"],
  retouren: ["retouren"],
  zeiterfassung: ["personal", "zeiterfassung"],
  lohn: ["personal"],
  ecommerce: ["online", "zahlungsdienstleister"],
  anlagen: ["anlagen"],
  vorsystem: ["branche"],
};

function hasContent(entry: CatalogState[string] | undefined): boolean {
  if (!entry) return false;
  if (entry.status) return true;
  return Boolean(entry.values && Object.keys(entry.values).length);
}

/**
 * Startantworten für ein Gesamtdokument aus den neuesten Fassungen aller
 * Bereichs-Dokumentationen einer Firma. Die erste Quelle mit Inhalt gewinnt
 * je Frage (Reihenfolge: zuletzt geänderte Dokumente zuerst übergeben).
 */
export function answersForGesamt(sources: IntakeAnswers[], company = ""): IntakeAnswers {
  const katalog: CatalogState = {};
  const bereiche = new Set<string>();
  for (const source of sources) {
    if (source.module) {
      // Bereits ein Gesamtdokument: unverändert als Basis verwenden.
      return withCatalogDraft(source, company);
    }
    bereiche.add(bereichIdOf(source));
    const state = catalogState(withCatalogDraft(source, company));
    for (const [id, entry] of Object.entries(state)) {
      if (!hasContent(katalog[id]) && hasContent(entry)) katalog[id] = entry;
    }
  }
  const base = sources[0] ?? emptyAnswers();
  let answers = ensureGesamt({ ...base, katalog, bereich: undefined });
  for (const bereich of bereiche) {
    for (const key of BEREICH_ZU_CHECK[bereich] ?? []) {
      answers = setCheckAntwort(answers, key, "ja");
    }
  }
  return answers;
}
