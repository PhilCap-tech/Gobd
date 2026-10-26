"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearIntakeDrafts } from "@/lib/browser-storage-expiry";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
      });
      const loggedOut =
        response.type === "opaqueredirect" ||
        response.status === 303 ||
        response.status === 302;
      if (!loggedOut) {
        setError(
          "Die Abmeldung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.",
        );
        setPending(false);
        return;
      }
    } catch {
      setError(
        "Die Abmeldung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.",
      );
      setPending(false);
      return;
    }
    // Fragebogen-Entwürfe aus dem Browser-Speicher entfernen (Server-Entwurf bleibt).
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        clearIntakeDrafts(storage);
      } catch {
        /* Speicher gesperrt */
      }
    }
    router.refresh();
    window.location.replace("/login");
  }

  return (
    <form action="/api/auth/logout" method="post" className={className} onSubmit={onSubmit}>
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : "Abmelden"}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
