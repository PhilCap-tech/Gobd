"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  MAGNET_EMAIL_INVALID,
  MAGNET_EMAIL_LABEL,
  MAGNET_LATER,
  MAGNET_MARKETING_CONSENT,
  MAGNET_PRIVACY_NOTE,
  MAGNET_SUBMIT_BUTTON,
  MAGNET_SUBMIT_PENDING,
  MAGNET_SUBMIT_SUCCESS,
} from "@/lib/vorlagen/copy";
import type { CalcSnapshot } from "@/lib/vorlagen/calc";
import type { MagnetId } from "@/lib/vorlagen/ids";
import { magnetBeaconNumber, sendMagnetGateView, sendMagnetStep } from "@/lib/vorlagen/step-beacon";

export function VorlagenGate({
  magnet,
  intro,
  buttonLabel = MAGNET_SUBMIT_BUTTON,
  calc,
}: {
  magnet: MagnetId;
  intro: string;
  buttonLabel?: string;
  calc?: CalcSnapshot | null;
}) {
  const emailId = useId();
  const errorId = useId();
  const privacyId = useId();
  const statusId = useId();
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    sendMagnetGateView(magnet);
  }, [magnet]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
    const n = magnetBeaconNumber(magnet);
    sendMagnetStep({ event: "magnet_submit_click", n, valid });
    if (!valid) {
      setError(MAGNET_EMAIL_INVALID);
      sendMagnetStep({ event: "magnet_submit_result", n, status: "400" });
      return;
    }
    setPending(true);
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/magnet/anfordern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          magnet,
          marketing,
          fax_number: fax,
          ...(calc ? { calc } : {}),
        }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const status = response.status === 400 ? "400" : response.status === 429 ? "429" : response.status >= 500 ? "5xx" : response.ok ? "ok" : "5xx";
      sendMagnetStep({ event: "magnet_submit_result", n, status });
      if (!response.ok) {
        setError(data?.error || MAGNET_LATER);
        return;
      }
      setDone(true);
    } catch {
      sendMagnetStep({ event: "magnet_submit_result", n, status: "timeout" });
      setError(MAGNET_LATER);
    } finally {
      window.clearTimeout(timer);
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="card" role="status" aria-live="polite">
        {MAGNET_SUBMIT_SUCCESS}
      </p>
    );
  }

  return (
    <form className="card" noValidate onSubmit={onSubmit}>
      <p>{intro}</p>
      <div className="ampel-honeypot" aria-hidden="true">
        <label htmlFor={`${emailId}-fax`}>Fax</label>
        <input
          id={`${emailId}-fax`}
          name="fax_number"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fax}
          onChange={(event) => setFax(event.target.value)}
        />
      </div>
      <div className={`field${error ? " field-invalid" : ""}`}>
        <label htmlFor={emailId}>{MAGNET_EMAIL_LABEL}</label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${privacyId}` : privacyId}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <p id={privacyId} className="hint">
          {MAGNET_PRIVACY_NOTE.replace(/Datenschutzerklärung\.$/, "")}
          <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </div>
      <div className="field">
        <label className="check" htmlFor={`${emailId}-marketing`}>
          <input
            id={`${emailId}-marketing`}
            name="marketing"
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
          />
          <span>{MAGNET_MARKETING_CONSENT}</span>
        </label>
      </div>
      <p className="actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? MAGNET_SUBMIT_PENDING : buttonLabel}
        </button>
      </p>
      <p id={statusId} className="field-error" role="alert" aria-live="polite">
        {error ? <span id={errorId}>{error}</span> : null}
      </p>
    </form>
  );
}
