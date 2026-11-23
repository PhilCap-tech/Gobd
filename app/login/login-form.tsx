"use client";

import { useEffect, useState } from "react";

export function LoginForm({
  next,
  maskedEmail = "",
  resolveOwner = false,
  initialSent = false,
  emailNotice = "",
  emailHint = "",
}: {
  next?: string | null;
  maskedEmail?: string;
  /** Send to the checkout owner resolved from next. The address is not in the browser. */
  resolveOwner?: boolean;
  initialSent?: boolean;
  /** Hinweis direkt am E-Mail-Feld (aria-describedby), z. B. Widerspruchshinweis. */
  emailNotice?: string;
  /** Kurzer Hilfetext am E-Mail-Feld (aria-describedby), nur wo explizit gesetzt. */
  emailHint?: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(initialSent);
  const destination = next || "/fragebogen";
  const buttonLabel =
    resolveOwner && maskedEmail ? `Link an ${maskedEmail} senden` : "Anmeldelink senden";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    button.disabled = true;
    setError("");
    setPending(true);
    setSent(false);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resolveOwner
            ? { next: next || undefined }
            : { email: email.trim(), next: next || undefined },
        ),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(
          data.error ||
            "Der Anmeldelink konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!sent) return;
    const started = Date.now();
    const limit = 20 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const arm = () => {
      clear();
      if (stopped || document.visibilityState !== "visible") return;
      if (Date.now() - started >= limit) return;
      timer = setTimeout(() => void tick(), 3000);
    };
    async function tick() {
      if (stopped || document.visibilityState !== "visible") return;
      if (Date.now() - started >= limit) return;
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { ok?: boolean };
        if (data.ok) {
          stopped = true;
          clear();
          window.location.assign(destination);
          return;
        }
      } catch {
        // Der nächste sichtbare Takt fragt erneut.
      }
      arm();
    }
    document.addEventListener("visibilitychange", arm);
    void tick();
    return () => {
      stopped = true;
      clear();
      document.removeEventListener("visibilitychange", arm);
    };
  }, [sent, destination]);

  return (
    <form className="card" method="post" action="/api/auth/magic-link" onSubmit={onSubmit}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {resolveOwner ? null : (
        <div className="field">
          <label htmlFor="login-email">E-Mail</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-describedby={
              [emailHint ? "login-email-hint" : "", emailNotice ? "email-objection" : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
          {emailHint ? (
            <p className="hint" id="login-email-hint">
              {emailHint}
            </p>
          ) : null}
          {emailNotice ? (
            <p className="hint" id="email-objection">
              {emailNotice}
            </p>
          ) : null}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {sent && (
        <>
          <p className="banner">
            Wenn ein Konto existiert, ist ein Link unterwegs. Er ist 20 Minuten gültig.
          </p>
          <p className="banner">
            Öffnen Sie den Link in diesem Browser. Diese Seite leitet Sie weiter, sobald die Anmeldung geklappt hat.
          </p>
        </>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : buttonLabel}
      </button>
      {maskedEmail ? (
        <p className="hint">Wir senden den Anmeldelink an {maskedEmail}.</p>
      ) : (
        <p className="hint">Kein Passwort. Nur ein Link per E-Mail.</p>
      )}
    </form>
  );
}
