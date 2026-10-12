"use client";

import { intakeProgressSegments } from "@/lib/intake-catalog";
import type { IntakeAnswers } from "@/lib/types";

/** Bar for the paid intake and the demo. Segments match „Schritt k von n“. */
export function IntakeProgress({ step, answers }: { step: number; answers: IntakeAnswers }) {
  const segments = intakeProgressSegments(step, answers);
  if (!segments.length) return null;
  return (
    <div className="progress" aria-hidden="true">
      {segments.map((state, index) => (
        <i key={index} className={state || undefined} />
      ))}
    </div>
  );
}
