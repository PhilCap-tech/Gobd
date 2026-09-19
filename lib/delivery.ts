import type { IntakeAnswers } from "@/lib/types";

/**
 * GoBD Delivery — Stub.
 *
 * TODO: Intake → Kapitelgerüst → PDF + Offene-Punkte-Liste.
 * Hier keine echten GoBD-/Steuerrechtstexte erfinden.
 */
export type DeliveryChapter = {
  id: string;
  title: string;
  source: "placeholder";
  intakeHint: string;
};

export type DeliveryOpenItem = {
  id: string;
  title: string;
  status: "open";
};

export type DeliveryPlan = {
  status: "queued_stub";
  chapters: DeliveryChapter[];
  openItems: DeliveryOpenItem[];
  pdf: null;
};

export function planDelivery(answers: IntakeAnswers): DeliveryPlan {
  return {
    status: "queued_stub",
    chapters: [
      {
        id: "allgemein",
        title: "Allgemeines / Unternehmen",
        source: "placeholder",
        intakeHint: answers.branchen.join(", ") || "Branche fehlt",
      },
      {
        id: "systeme",
        title: "Systeme / Software",
        source: "placeholder",
        intakeHint: answers.fibu.join(", ") || "FiBu fehlt",
      },
      {
        id: "belegwege",
        title: "Belegwege",
        source: "placeholder",
        intakeHint: answers.eingangsbelege.join(", ") || "Eingang fehlt",
      },
      {
        id: "it",
        title: "IT / Zugriff / Archiv",
        source: "placeholder",
        intakeHint: answers.hosting || "Hosting fehlt",
      },
      {
        id: "rollen",
        title: "Verantwortlichkeiten",
        source: "placeholder",
        intakeHint: answers.gf || "GF fehlt",
      },
    ],
    openItems: [
      {
        id: "steuerberater-abstimmung",
        title: "Entwurf mit Steuerberater abstimmen",
        status: "open",
      },
      {
        id: "pdf-render",
        title: "PDF erzeugen (Delivery-Job)",
        status: "open",
      },
    ],
    pdf: null,
  };
}

function emptyStubPlan(): DeliveryPlan {
  return {
    status: "queued_stub",
    chapters: [],
    openItems: [
      {
        id: "steuerberater-abstimmung",
        title: "Entwurf mit Steuerberater abstimmen",
        status: "open",
      },
      {
        id: "pdf-render",
        title: "PDF erzeugen (Delivery-Job)",
        status: "open",
      },
    ],
    pdf: null,
  };
}

export async function enqueueDelivery(input: {
  sessionId: string;
  answers: IntakeAnswers;
}): Promise<DeliveryPlan> {
  try {
    const plan = planDelivery(input.answers);
    // TODO: Job-Queue / Worker: Kapitel füllen, PDF schreiben, Offene Punkte persistieren.
    console.info("[delivery] queued stub", {
      sessionId: input.sessionId,
      chapters: plan.chapters.map((c) => c.id),
    });
    return plan;
  } catch (error) {
    console.error("[delivery] stub failed", error);
    return emptyStubPlan();
  }
}
