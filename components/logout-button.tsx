"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "follow",
      });
    } catch {
      // The full navigation below still drops the cached view.
    }
    router.refresh();
    window.location.replace("/login");
  }

  return (
    <form action="/api/auth/logout" method="post" className={className} onSubmit={onSubmit}>
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : "Abmelden"}
      </button>
    </form>
  );
}
