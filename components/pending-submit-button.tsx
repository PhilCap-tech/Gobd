"use client";

import { useState } from "react";

/**
 * Disables a mail submit on the first click, before the next paint,
 * so a double click cannot post twice.
 */
export function PendingSubmitButton({
  children,
  pendingLabel = "Bitte warten…",
  className = "btn",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (event.currentTarget.disabled) {
          event.preventDefault();
          return;
        }
        event.currentTarget.disabled = true;
        setPending(true);
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
