"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  KANZLEI_TOOLBOX_AUTHORITY_TEXT,
  KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
  KANZLEI_TOOLBOX_FIELDS,
  KANZLEI_TOOLBOX_FORM_TITLE,
  KANZLEI_TOOLBOX_PRIVACY_HINT,
  KANZLEI_TOOLBOX_REPORT_TEXT,
  KANZLEI_TOOLBOX_SUCCESS,
  KANZLEI_TOOLBOX_TERMS_TEXT,
} from "@/lib/kanzlei-toolbox-copy";
import styles from "../home.module.css";

export function ToolboxForm() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [authority, setAuthority] = useState(false);
  const [terms, setTerms] = useState(false);
  const [report, setReport] = useState(false);
  const [fax, setFax] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/kanzlei-toolbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website, email, city, authority, terms, report, fax_number: fax }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Bitte prüfen Sie Ihre Angaben.");
        return;
      }
      setDone(true);
    } catch {
      setError("Bitte prüfen Sie Ihre Angaben.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className={styles.prose} role="status">
        {KANZLEI_TOOLBOX_SUCCESS}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <h3>{KANZLEI_TOOLBOX_FORM_TITLE}</h3>
      <div className="ampel-honeypot" aria-hidden="true">
        <label htmlFor="toolbox-fax">Fax</label>
        <input id="toolbox-fax" name="fax_number" tabIndex={-1} autoComplete="off" value={fax} onChange={(event) => setFax(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="toolbox-name">{KANZLEI_TOOLBOX_FIELDS.name}</label>
        <input id="toolbox-name" name="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="toolbox-website">{KANZLEI_TOOLBOX_FIELDS.website}</label>
        <input id="toolbox-website" name="website" required inputMode="url" placeholder="https://kanzlei.example" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="toolbox-email">{KANZLEI_TOOLBOX_FIELDS.email}</label>
        <input id="toolbox-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="toolbox-city">{KANZLEI_TOOLBOX_FIELDS.city}</label>
        <input id="toolbox-city" name="city" required value={city} onChange={(event) => setCity(event.target.value)} />
      </div>
      <label className={styles.prose} htmlFor="toolbox-authority">
        <input id="toolbox-authority" type="checkbox" checked={authority} onChange={(event) => setAuthority(event.target.checked)} /> {KANZLEI_TOOLBOX_AUTHORITY_TEXT}
      </label>
      <label className={styles.prose} htmlFor="toolbox-terms">
        <input
          id="toolbox-terms"
          type="checkbox"
          checked={terms}
          data-consent-version={KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION}
          onChange={(event) => setTerms(event.target.checked)}
        />{" "}
        {KANZLEI_TOOLBOX_TERMS_TEXT}{" "}
        <Link href="/steuerberater/toolbox-bedingungen">Teilnahmebedingungen (Entwurf)</Link>
      </label>
      <label className={styles.prose} htmlFor="toolbox-report">
        <input id="toolbox-report" type="checkbox" checked={report} onChange={(event) => setReport(event.target.checked)} /> {KANZLEI_TOOLBOX_REPORT_TEXT}
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : "Toolbox anfordern"}
        </button>
      </div>
      <p className="hint">
        {KANZLEI_TOOLBOX_PRIVACY_HINT} <Link href="/datenschutz">Datenschutzerklärung</Link>.{" "}
        <Link href="/steuerberater/toolbox-datenschutz">Entwurf des Abschnitts</Link>
      </p>
    </form>
  );
}
