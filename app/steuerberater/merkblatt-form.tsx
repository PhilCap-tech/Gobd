"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  KANZLEI_CONSENT_TEXT_VERSION,
  KANZLEI_DISCLAIMER,
  KANZLEI_EMAIL_HINT,
  KANZLEI_EMAIL_INVALID,
  KANZLEI_EMAIL_LABEL,
  KANZLEI_FORM_BENEFITS,
  KANZLEI_FORM_LEAD,
  KANZLEI_FORM_TITLE,
  KANZLEI_MERKBLATT_FILENAME,
  KANZLEI_OPT_IN,
  KANZLEI_SUBMIT_LABEL,
  KANZLEI_SUCCESS_FALLBACK_LEAD,
  KANZLEI_SUCCESS_OPT_IN_CONFIRM,
  KANZLEI_SUCCESS_OPT_IN_SENT,
  KANZLEI_SUCCESS_OPT_IN_WITHOUT,
  KANZLEI_SUCCESS_TITLE,
} from "@/lib/kanzlei-copy";
import styles from "../home.module.css";

type Done = { downloadUrl: string; mailed: boolean; email: string };

function EmailHint() {
  const marker = "Datenschutzerklärung";
  const at = KANZLEI_EMAIL_HINT.indexOf(marker);
  if (at < 0) return <>{KANZLEI_EMAIL_HINT}</>;
  return (
    <>
      {KANZLEI_EMAIL_HINT.slice(0, at)}
      <Link href="/datenschutz#kanzlei-merkblatt">{marker}</Link>
      {KANZLEI_EMAIL_HINT.slice(at + marker.length)}
    </>
  );
}

export function MerkblattForm() {
  const [email, setEmail] = useState("");
  const [optin, setOptin] = useState(false);
  const [fax, setFax] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  function startDownload(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = KANZLEI_MERKBLATT_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/kanzlei-merkblatt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          optin,
          fax_number: fax,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        downloadUrl?: string;
        mailed?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok || !data.downloadUrl) {
        setError(data?.error || KANZLEI_EMAIL_INVALID);
        return;
      }
      setDone({ downloadUrl: data.downloadUrl, mailed: data.mailed === true, email: email.trim() });
      startDownload(data.downloadUrl);
    } catch {
      setError(KANZLEI_EMAIL_INVALID);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h2>{KANZLEI_FORM_TITLE}</h2>
      <p className={styles.sub}>{KANZLEI_FORM_LEAD}</p>
      <ul className={styles.cardList}>
        {KANZLEI_FORM_BENEFITS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {done ? (
        <p className={styles.prose} role="status">
          <strong>{KANZLEI_SUCCESS_TITLE}</strong>
          <br />
          {KANZLEI_SUCCESS_FALLBACK_LEAD}{" "}
          <a className={styles.inlineLink} href={done.downloadUrl} download={KANZLEI_MERKBLATT_FILENAME}>
            {KANZLEI_SUBMIT_LABEL}
          </a>
          {done.mailed ? (
            <>
              <br />
              <br />
              {KANZLEI_SUCCESS_OPT_IN_SENT} {done.email} gesendet. {KANZLEI_SUCCESS_OPT_IN_CONFIRM}{" "}
              {KANZLEI_SUCCESS_OPT_IN_WITHOUT}
            </>
          ) : null}
        </p>
      ) : (
        <form noValidate onSubmit={onSubmit}>
          <div className="ampel-honeypot" aria-hidden="true">
            <label htmlFor="merkblatt-fax">Fax</label>
            <input
              id="merkblatt-fax"
              name="fax_number"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={fax}
              onChange={(event) => setFax(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="merkblatt-email">
              {KANZLEI_EMAIL_LABEL} <span aria-hidden="true">*</span>
            </label>
            <input
              id="merkblatt-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@kanzlei.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="hint">
              <EmailHint />
            </p>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <label className={styles.prose} htmlFor="merkblatt-optin">
            <input
              id="merkblatt-optin"
              name="optin"
              type="checkbox"
              value="kanzlei-infos"
              data-consent-version={KANZLEI_CONSENT_TEXT_VERSION}
              checked={optin}
              onChange={(event) => setOptin(event.target.checked)}
            />{" "}
            {KANZLEI_OPT_IN}
          </label>
          <div className="actions">
            <button className="btn" type="submit" disabled={pending}>
              {KANZLEI_SUBMIT_LABEL}
            </button>
          </div>
          <p className="hint">
            Hinweise zur Verarbeitung Ihrer Daten, einschließlich Ihres Widerspruchsrechts, finden Sie in unserer{" "}
            <Link href="/datenschutz#kanzlei-merkblatt">Datenschutzerklärung</Link>.
          </p>
        </form>
      )}
      <p className={styles.fine}>
        {KANZLEI_DISCLAIMER}
        <br />
        {LEGAL_OPERATOR.name} · {LEGAL_OPERATOR.street} · {LEGAL_OPERATOR.zipCity} ·{" "}
        <Link href="/impressum">Impressum</Link>
      </p>
    </div>
  );
}
