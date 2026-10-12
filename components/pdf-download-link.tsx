"use client";

import { useState, type ReactNode } from "react";
import { fetchRetrying503, isPdfResponse, SAVE_PENDING_LABEL } from "@/lib/fetch-retry";
import { SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";

export function PdfDownloadLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetchRetrying503(href);
      if (!isPdfResponse(response)) {
        let text = SHEETS_RETRY_MESSAGE;
        const type = response.headers.get("content-type") ?? "";
        if (type.toLowerCase().includes("json")) {
          const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
          if (data && typeof data.error === "string" && data.error.trim()) text = data.error;
        }
        setMessage(text);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");
      link.download = match?.[1] || "dokument.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage(SHEETS_RETRY_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <a className={className} href={href} onClick={onClick}>
        {pending ? SAVE_PENDING_LABEL : children}
      </a>
      {message ? (
        <p className="error" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
