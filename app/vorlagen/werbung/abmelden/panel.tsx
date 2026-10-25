"use client";

import { useState } from "react";
import {
  MAGNET_LINK_INVALID,
  MAGNET_UNSUBSCRIBE_BODY,
  MAGNET_UNSUBSCRIBE_BUTTON,
  MAGNET_UNSUBSCRIBE_TITLE,
} from "@/lib/vorlagen/copy";

export function MagnetUnsubscribePanel({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "ok" | "invalid">("idle");

  async function withdraw() {
    setState("pending");
    try {
      const response = await fetch("/api/magnet/werbung/abmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(response.ok ? "ok" : "invalid");
    } catch {
      setState("invalid");
    }
  }

  if (state === "ok") {
    return (
      <>
        <h1>{MAGNET_UNSUBSCRIBE_TITLE}</h1>
        <p>{MAGNET_UNSUBSCRIBE_BODY}</p>
      </>
    );
  }
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        void withdraw();
      }}
    >
      <p className="actions">
        <button className="btn" type="submit" disabled={state === "pending"}>
          {MAGNET_UNSUBSCRIBE_BUTTON}
        </button>
      </p>
      {state === "invalid" ? <p className="field-error" role="alert">{MAGNET_LINK_INVALID}</p> : null}
    </form>
  );
}
