"use client";

import { intakeEtappeView, intakeProgressSegments } from "@/lib/intake-catalog";
import type { IntakeAnswers } from "@/lib/types";

/** Bar for the paid intake and the demo. Gesamtdokument: fünf benannte Etappen. */
export function IntakeProgress({ step, answers }: { step: number; answers: IntakeAnswers }) {
  const etappe = intakeEtappeView(step, answers);
  if (etappe) {
    return (
      <div className="etappen-wrap">
        <ol className="etappen" aria-label={etappe.label}>
          {etappe.etappen.map((item) => (
            <li key={item.id} className={item.state || undefined}>
              <span className="etappe-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </span>
              <span className="etappe-name">{item.label}</span>
            </li>
          ))}
        </ol>
        <p className="step-label">{etappe.label}</p>
      </div>
    );
  }
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
