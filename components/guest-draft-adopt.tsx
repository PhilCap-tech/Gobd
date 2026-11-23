"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  GUEST_ADOPT_BROWSER_LABEL,
  GUEST_CONFLICT_PROMPT,
  GUEST_DRAFT_LIMIT_HINT,
  GUEST_KEEP_ACCOUNT_LABEL,
  GUEST_KEEP_LOCAL_HINT,
  GUEST_WAIT_LABEL,
  commitGuestAdoption,
  guestAdoptPutBody,
  planGuestAdoption,
  readGuestDraftSnapshot,
  removeGuestDraftEntry,
  type GuestAdoptFacts,
} from "@/lib/guest-start";
import type { IntakeDraftSnapshot } from "@/lib/intake-draft-shared";

/**
 * Nach der Anmeldung im selben Browser: lokalen Gast-Entwurf in den
 * unbezahlten Konto-Entwurf übernehmen. Ein vorhandener Server-Entwurf
 * wird nur nach Wahl ersetzt. Bei drei offenen Entwürfen bleibt alles liegen.
 */
export function GuestDraftAdopt({ facts, children }: { facts: GuestAdoptFacts; children: ReactNode }) {
  const [phase, setPhase] = useState<"check" | "ask" | "limit" | "unknown" | "failed" | "ready">("check");
  const [pending, setPending] = useState(false);
  const [snapshot, setSnapshot] = useState<IntakeDraftSnapshot | null>(null);

  useEffect(() => {
    let local: IntakeDraftSnapshot | null = null;
    try {
      local = readGuestDraftSnapshot(window.localStorage, Date.now());
    } catch {
      local = null;
    }
    if (!local) {
      setPhase("ready");
      return;
    }
    setSnapshot(local);
    if (facts.status === "unknown") {
      setPhase("unknown");
      return;
    }
    const action = planGuestAdoption({
      hasLocalDraft: true,
      targetExists: facts.targetExists,
      openUnpaidCount: facts.openUnpaidCount,
    });
    if (action === "limit") {
      setPhase("limit");
      return;
    }
    if (action === "ask") {
      setPhase("ask");
      return;
    }
    if (action === "adopt") {
      void run("adopt", undefined, local);
      return;
    }
    setPhase("ready");
    // facts ist für diese Sitzung fest; der lokale Stand wird einmal gelesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(
    action: "adopt" | "ask",
    choice: "browser" | "account" | undefined,
    local: IntakeDraftSnapshot | null,
  ) {
    const draft = local ?? snapshot;
    if (!draft) {
      setPhase("ready");
      return;
    }
    setPending(true);
    const result = await commitGuestAdoption({
      action,
      choice,
      put: async () => {
        const response = await fetch("/api/intake/draft", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            guestAdoptPutBody({
              draftKey: facts.draftKey,
              email: facts.email,
              entityId: facts.entityId,
              modus: facts.modus,
              snapshot: draft,
              serverRevision: facts.targetRevision,
            }),
          ),
        });
        return response.ok;
      },
      remove: () => removeGuestDraftEntry(window.localStorage),
    });
    setPending(false);
    if (result === "failed") {
      setPhase("failed");
      return;
    }
    setPhase("ready");
  }

  if (phase === "check" || pending) {
    return <p className="hint">{GUEST_WAIT_LABEL}</p>;
  }
  if (phase === "ask") {
    return (
      <div className="card">
        <p id="guest-draft-choice">{GUEST_CONFLICT_PROMPT}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => void run("ask", "browser", snapshot)}>
            {GUEST_ADOPT_BROWSER_LABEL}
          </button>
          <button type="button" className="btn ghost" onClick={() => void run("ask", "account", snapshot)}>
            {GUEST_KEEP_ACCOUNT_LABEL}
          </button>
        </div>
      </div>
    );
  }
  if (phase === "limit") {
    return (
      <>
        <p className="banner" role="status">
          {GUEST_DRAFT_LIMIT_HINT}
        </p>
        {children}
      </>
    );
  }
  if (phase === "unknown" || phase === "failed") {
    return (
      <>
        <p className="banner" role="status">
          {GUEST_KEEP_LOCAL_HINT}
        </p>
        {children}
      </>
    );
  }
  return children;
}
