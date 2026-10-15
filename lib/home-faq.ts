import type { FaqEntry } from "@/lib/faq-entries";
import type { Crumb } from "@/lib/jsonld";

/**
 * Visible homepage FAQ. JSON-LD must use this same array so the markup
 * matches the text in the details elements.
 */
export const HOME_FAQ: FaqEntry[] = [
  {
    question: "Brauch ich eine Verfahrensdokumentation?",
    answer:
      "Die GoBD erwarten eine nachvollziehbare Verfahrensdokumentation. Viele Betriebe schieben sie auf, weil Vorlagen leer bleiben. Ein geführter Entwurf schafft einen greifbaren Stand.",
  },
  {
    question: "Ist das fertig / reicht das für die Prüfung?",
    answer:
      "Nein — Sie erhalten PDF und offene Punkte aus Ihren Angaben. Sie prüfen und ergänzen vor der Verwendung. Die fachliche Prüfung bleibt bei Ihnen bzw. Ihrem Steuerberater.",
  },
  {
    question: "Reicht ein einmaliges PDF?",
    answer:
      "Für den Moment vielleicht — bis sich Software, Belegwege oder Verantwortliche ändern. Das Abo hält Versionen und Updates verfügbar.",
  },
  {
    question: "Deckt das auch Kasse, Warenwirtschaft oder Lohn ab?",
    answer: "Ja, als Module in Ihrer Gesamtdokumentation, alle inklusive.",
  },
  {
    question: "Ist das Steuerberatung?",
    answer: "Nein. Wir leisten keine Steuerberatung.",
  },
];

export const HOME_CRUMBS: Crumb[] = [{ name: "Startseite", path: "/" }];
