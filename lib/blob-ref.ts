/**
 * Locator helpers shared by server storage and the client.
 * No Node or Blob SDK imports: the Betriebs-Check is a client component.
 *
 * Sheets may still hold a public Blob URL from before the store was private.
 * The pathname inside that URL is the stable key. New writes store the pathname.
 */

const BLOB_HOST = /(^|\.)blob\.vercel-storage\.com$/i;

export const CUSTOMER_UPLOAD_ROUTE = "/api/module-upload/file";

/** `gobd/...` pathname, or null when the locator is not a Blob object. */
export function blobPathFromLocator(locator: string | null | undefined): string | null {
  const trimmed = locator?.trim() ?? "";
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }
  if (trimmed.startsWith("gobd/")) {
    const path = trimmed.split(/[?#]/, 1)[0] ?? "";
    return path.startsWith("gobd/") ? path : null;
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (!BLOB_HOST.test(url.hostname)) return null;
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!path.startsWith("gobd/") || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

/** Customer uploads live under `gobd/uploads/<owner>/<modul>/<file>`. */
export function isCustomerUploadPath(pathname: string): boolean {
  if (!pathname.startsWith("gobd/uploads/")) return false;
  if (pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return false;
  const parts = pathname.split("/");
  return parts.length >= 5 && parts.every((part) => part.length > 0);
}

/** Owner folder inside `gobd/uploads/<owner>/…`, from a pathname, legacy URL, or local path. */
export function customerUploadOwner(locator: string): string | null {
  const blobPath = blobPathFromLocator(locator);
  if (blobPath) {
    const parts = blobPath.split("/");
    return parts[0] === "gobd" && parts[1] === "uploads" ? parts[2] || null : null;
  }
  const normalized = locator.trim().replaceAll("\\", "/");
  if (!normalized.includes("/uploads/") || normalized.includes("..")) return null;
  const parts = normalized.split("/");
  const at = parts.lastIndexOf("uploads");
  return at >= 0 ? parts[at + 1] || null : null;
}

function isAppUploadHref(value: string): boolean {
  return value.startsWith(`${CUSTOMER_UPLOAD_ROUTE}?`) || value === CUSTOMER_UPLOAD_ROUTE;
}

function isLocalUploadLocator(locator: string): boolean {
  const normalized = locator.replaceAll("\\", "/");
  return normalized.includes("/uploads/") && !normalized.includes("..") && !normalized.includes("\0");
}

/**
 * Href for a stored upload. Legacy public Blob URLs and bare pathnames become
 * the authenticated app route. An href that is already that route is kept.
 */
export function customerUploadHref(locator: string, sessionId?: string): string {
  const trimmed = locator.trim();
  if (!trimmed) return "";
  let href = trimmed;
  if (!isAppUploadHref(trimmed)) {
    const blobPath = blobPathFromLocator(trimmed);
    if (blobPath && isCustomerUploadPath(blobPath)) {
      href = `${CUSTOMER_UPLOAD_ROUTE}?ref=${encodeURIComponent(blobPath)}`;
    } else if (isLocalUploadLocator(trimmed)) {
      href = `${CUSTOMER_UPLOAD_ROUTE}?ref=${encodeURIComponent(trimmed)}`;
    } else {
      return trimmed;
    }
  }
  const sid = sessionId?.trim() ?? "";
  if (sid && !href.includes("session_id=")) {
    href += `${href.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(sid)}`;
  }
  return href;
}
