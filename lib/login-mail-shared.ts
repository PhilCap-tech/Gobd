/**
 * Login-link status from POST /api/intake and the /success banner it drives.
 * Shared by the client form and the server page; no server imports.
 *
 * - "sent": a new login-link mail went out now → banner
 * - "duplicate": the dedupe window already had one; nothing new went out
 * - "loggedIn": the owner is signed in; no login link is needed
 */
export type SubmitLoginMail =
  | "sent"
  | "stub"
  | "failed"
  | "skipped"
  | "duplicate"
  | "loggedIn";

/** `anmeldung` query value for /success, or null for none. */
export function anmeldungParam(loginMail: string | undefined): string | null {
  if (loginMail === "sent") return "gesendet";
  if (loginMail === "failed") return "fehler";
  if (loginMail === "stub") return "stub";
  if (loginMail === "skipped") return "keine";
  return null;
}

/** The "Anmeldelink gesendet" banner only follows a real send. */
export function showsLoginLinkSent(anmeldung: string): boolean {
  return anmeldung === "gesendet";
}
