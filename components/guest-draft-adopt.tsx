"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  GUEST_ADOPT_BROWSER_LABEL,
  GUEST_ADOPT_LOCK_NAME,
  GUEST_CONFLICT_PROMPT,
  GUEST_DRAFT_LIMIT_HINT,
  GUEST_KEEP_ACCOUNT_LABEL,
  GUEST_KEEP_LOCAL_HINT,
  GUEST_WAIT_LABEL,
  commitGuestAdoption,
  guestAdoptPutBody,
  removeGuestDraftEntry,
  runGuestAdoptAttempt,
  type GuestAdoptFacts,
  type GuestAdoptIntent,
  type GuestAdoptLock,
  type GuestAdoptRunResult,
} from "@/lib/guest-start";
import type { IntakeDraftSnapshot } from "@/lib/intake-draft-shared";

/** Ein Refresh je Seitenleben, damit ein wartender Tab nicht in einer Schleife lädt. */
let guestAdoptDidRefresh = false;

function guestAdoptLock(): GuestAdoptLock | null {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== "function") return null;
  // Exklusiv und wartend, ohne Optionen. Die Typen wickeln das Promise nicht aus;
  // der Browser löst mit dem Wert der Callback-Promise auf.
  return async (run) => (await locks.request(GUEST_ADOPT_LOCK_NAME, () => run())) as Awaited<ReturnType<typeof run>>;
}

/**
 * Nach der Anmeldung im selben Browser: lokalen Gast-Entwurf in den
 * unbezahlten Konto-Entwurf übernehmen. Ein vorhandener Server-Entwurf
 * wird nur nach Wahl ersetzt. Bei drei offenen Entwürfen bleibt alles liegen.
 * Zwei Tabs teilen sich ein Web Lock, damit derselbe Gast-Eintrag nur einmal
 * geschrieben wird.
 */
export function GuestDraftAdopt({ facts, children }: { facts: GuestAdoptFacts; children: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"check" | "ask" | "limit" | "unknown" | "failed" | "ready">("check");
  const [pending, setPending] = useState(false);

  async function putSnapshot(snapshot: IntakeDraftSnapshot): Promise<boolean> {
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
          snapshot,
          serverRevision: facts.targetRevision,
        }),
      ),
    });
    return response.ok;
  }

  async function attempt(intent: GuestAdoptIntent): Promise<void> {
    setPending(true);
    const result = await runGuestAdoptAttempt({
      storage: window.localStorage,
      now: () => Date.now(),
      facts,
      lock: guestAdoptLock(),
      intent,
      put: putSnapshot,
      remove: () => removeGuestDraftEntry(window.localStorage),
      commit: commitGuestAdoption,
    });
    setPending(false);
    applyResult(result, () => router.refresh());
  }

  function applyResult(result: GuestAdoptRunResult, refresh: () => void): void {
    if (result.refresh) {
      if (!guestAdoptDidRefresh) {
        guestAdoptDidRefresh = true;
        refresh();
      }
      setPhase("ready");
      return;
    }
    if (result.status === "ask") {
      setPhase("ask");
      return;
    }
    if (result.status === "limit") {
      setPhase("limit");
      return;
    }
    if (result.status === "unknown") {
      setPhase("unknown");
      return;
    }
    if (result.status === "failed") {
      setPhase("failed");
      return;
    }
    setPhase("ready");
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await runGuestAdoptAttempt({
        storage: window.localStorage,
        now: () => Date.now(),
        facts,
        lock: guestAdoptLock(),
        intent: "mount",
        put: putSnapshot,
        remove: () => removeGuestDraftEntry(window.localStorage),
        commit: commitGuestAdoption,
      });
      if (cancelled) return;
      applyResult(result, () => router.refresh());
    })();
    return () => {
      cancelled = true;
    };
    // facts und router sind für diese Sitzung fest. Der Lock liest den Speicher neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "check" || pending) {
    return <p className="hint">{GUEST_WAIT_LABEL}</p>;
  }
  if (phase === "ask") {
    return (
      <div className="card">
        <p id="guest-draft-choice">{GUEST_CONFLICT_PROMPT}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => void attempt("browser")}>
            {GUEST_ADOPT_BROWSER_LABEL}
          </button>
          <button type="button" className="btn ghost" onClick={() => void attempt("account")}>
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
