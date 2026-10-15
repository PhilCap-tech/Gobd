"use client";

import { useMemo, useState } from "react";
import { IntakeQuestionnaire } from "@/components/intake-questionnaire";
import type { FirmFacts } from "@/lib/intake-catalog";
import { draftRevision, type IntakeDraft } from "@/lib/intake-draft-shared";
import {
  draftConflictCopy,
  MEMBER_SAVED_MESSAGE,
  MEMBER_SAVE_LABEL,
} from "@/lib/membership-copy";
import { setModulEintrag } from "@/lib/module/status";
import type { IntakeAnswers } from "@/lib/types";

export function MitwirkungModulForm({
  draftKey,
  ownerEmail,
  entityId,
  moduleId,
  step,
  initialAnswers,
  initialRevision,
  initialUpdatedAt,
  firm,
}: {
  draftKey: string;
  ownerEmail: string;
  entityId: string;
  moduleId: string;
  step: number;
  initialAnswers: IntakeAnswers;
  initialRevision: number;
  initialUpdatedAt: string;
  firm: FirmFacts;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [revision, setRevision] = useState(initialRevision);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  const shown = useMemo(() => {
    if (!answers.module) return answers;
    const current = answers.module.status?.[moduleId];
    return setModulEintrag(answers, moduleId, { ...current, status: "tool" });
  }, [answers, moduleId]);

  async function save() {
    if (pending) return;
    setError("");
    setNotice("");
    setPending(true);
    const nextRevision = Math.max(revision, 0) + 1;
    try {
      const response = await fetch("/api/intake/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftKey,
          email: ownerEmail,
          entityId,
          modus: "gesamt",
          step,
          answers,
          revision: nextRevision,
          clientUpdatedAt: updatedAt,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        updatedBy?: string;
        draft?: IntakeDraft;
      };
      if (response.status === 409 && data.draft?.answers) {
        setAnswers(data.draft.answers);
        setRevision(draftRevision(data.draft));
        setUpdatedAt(data.draft.updatedAt ?? "");
        setError(draftConflictCopy(data.updatedBy || data.draft.updatedBy || ""));
        return;
      }
      if (!response.ok) {
        setError(
          data.error?.trim() ||
            "Der Entwurf konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
        );
        return;
      }
      if (data.draft?.answers) {
        setAnswers(data.draft.answers);
        setRevision(draftRevision(data.draft));
        setUpdatedAt(data.draft.updatedAt ?? "");
      } else {
        setRevision(nextRevision);
      }
      setNotice(MEMBER_SAVED_MESSAGE);
    } catch {
      setError("Die Verbindung ist abgebrochen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="banner ok" role="status">
          {notice}
        </p>
      ) : null}
      <IntakeQuestionnaire
        step={step}
        answers={shown}
        onChange={(next) => setAnswers((current) => ({ ...current, katalog: next.katalog }))}
        firm={firm}
      />
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Bitte warten…" : MEMBER_SAVE_LABEL}
        </button>
      </div>
    </form>
  );
}
